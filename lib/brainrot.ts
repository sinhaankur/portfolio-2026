/**
 * BrainRot — the analysis core.
 *
 * A "mirror" for your feed: given a list of posts/videos, it scores each one's
 * SENTIMENT, EMOTION, TOPIC, and the MANIPULATION techniques it uses, then rolls
 * those up into a profile of what the algorithm thinks you are and how it's
 * hooking you. "Reverse Bias" = taking the feed's hidden bias and reflecting it
 * back so you can SEE it.
 *
 * This module is the DETERMINISTIC core — pure functions, lexicon-based, no
 * network, no model. It always works (offline, private, explainable). A tiny
 * on-device LLM can OPTIONALLY deepen the read on top (see the page), following
 * the same "deterministic core, LLM optional" shape as the rest of the site.
 *
 * Nothing here leaves the device.
 */

export type FeedItem = {
  id: string
  /** Author / handle, if known. */
  author?: string
  /** The caption / title / transcript text of the post or video. */
  text: string
  /** Optional platform label (tiktok, reels, shorts, x…). */
  platform?: string
}

export type Emotion = "anger" | "fear" | "outrage" | "desire" | "joy" | "awe" | "sadness" | "neutral"

export type Manipulation =
  | "rage-bait"
  | "doomscroll"
  | "fomo"
  | "outrage-farming"
  | "parasocial"
  | "cliffhanger"
  | "us-vs-them"
  | "envy-bait"

export type Topic =
  | "politics" | "money" | "relationships" | "fitness" | "tech" | "celebrity"
  | "food" | "conspiracy" | "self-improvement" | "gaming" | "news" | "other"

export type ItemAnalysis = {
  item: FeedItem
  /** -1 (very negative) … +1 (very positive). */
  sentiment: number
  emotion: Emotion
  /** 0..1 — how emotionally charged (|sentiment| plus intensifiers). */
  intensity: number
  topic: Topic
  manipulations: Manipulation[]
  /** 0..1 — overall "engineered to hook you" score. */
  hookScore: number
}

/* ── Lexicons ─────────────────────────────────────────────────────────────── */

const EMOTION_WORDS: Record<Exclude<Emotion, "neutral">, string[]> = {
  anger: ["angry", "furious", "rage", "hate", "disgusting", "outrageous", "insane", "unacceptable", "sick of", "fed up", "destroyed", "slammed", "owned", "wrecked"],
  fear: ["danger", "warning", "threat", "scary", "terrifying", "collapse", "crisis", "crash", "recession", "toxic", "avoid", "before it's too late", "they don't want you to know"],
  outrage: ["how dare", "unbelievable", "shameful", "cancel", "exposed", "corrupt", "scandal", "betrayed", "hypocrite", "gone wrong", "worst"],
  desire: ["want", "need this", "obsessed", "must have", "dream", "luxury", "rich", "millionaire", "secret", "hack", "trick", "you need to", "buy"],
  joy: ["love", "amazing", "beautiful", "wholesome", "happy", "best", "wonderful", "grateful", "blessed", "cute", "adorable"],
  awe: ["insane", "unreal", "mind-blowing", "incredible", "wait for it", "you won't believe", "epic", "legendary", "goat", "wild"],
  sadness: ["heartbreaking", "tragic", "lost", "grief", "alone", "depressed", "cry", "miss", "gone", "rip"],
}

const TOPIC_WORDS: Record<Exclude<Topic, "other">, string[]> = {
  politics: ["election", "president", "government", "senator", "vote", "left", "right", "liberal", "conservative", "policy", "biden", "trump", "woke", "border"],
  money: ["money", "invest", "stock", "crypto", "bitcoin", "rich", "wealth", "passive income", "side hustle", "salary", "debt", "millionaire", "financial"],
  relationships: ["boyfriend", "girlfriend", "dating", "ex", "situationship", "toxic", "love", "breakup", "marriage", "red flag", "cheating"],
  fitness: ["gym", "workout", "abs", "diet", "protein", "shredded", "bulk", "cardio", "gains", "body", "weight loss"],
  tech: ["ai", "app", "phone", "iphone", "android", "code", "startup", "gpt", "robot", "gadget", "software"],
  celebrity: ["celebrity", "kardashian", "drama", "feud", "red carpet", "leaked", "dating rumor", "famous", "star"],
  food: ["recipe", "cooking", "restaurant", "food", "eat", "viral recipe", "mukbang", "snack", "meal"],
  conspiracy: ["they don't want", "cover up", "the truth about", "wake up", "sheep", "mainstream media", "hidden", "secret agenda", "control"],
  "self-improvement": ["morning routine", "discipline", "mindset", "productivity", "habits", "grind", "5am", "successful people", "level up", "glow up"],
  gaming: ["game", "gaming", "stream", "twitch", "fortnite", "clip", "speedrun", "loot", "boss", "gg"],
  news: ["breaking", "report", "update", "developing", "sources say", "just in", "confirmed"],
}

const MANIP_PATTERNS: Record<Manipulation, RegExp[]> = {
  "rage-bait": [/\b(unbelievable|outrageous|how dare|you won't believe|insane|disgusting)\b/i, /\b(destroyed|slammed|owned|wrecked|exposed)\b/i],
  doomscroll: [/\b(collapse|crisis|crash|recession|the end of|last chance|before it's too late)\b/i, /\b(warning|danger|toxic|avoid this)\b/i],
  fomo: [/\b(only \d+ left|don't miss|last chance|everyone is|trending|before it's gone|limited)\b/i, /\b(you're missing out|while you (still )?can)\b/i],
  "outrage-farming": [/\b(cancel|corrupt|scandal|hypocrite|betrayed|shameful)\b/i, /\b(they|the media|politicians) (don't|won't|lied)\b/i],
  parasocial: [/\b(day \d+ of|come with me|get ready with me|grwm|my routine|my life|storytime)\b/i, /\bwe (need to talk|have to talk)\b/i],
  cliffhanger: [/\b(wait for it|part \d+|watch (till|until) the end|you won't believe what|the ending)\b/i, /\.\.\.$/],
  "us-vs-them": [/\b(them|they|those people|the elite|sheep|normies|npcs?)\b/i, /\b(real ones|if you know you know|iykyk)\b/i],
  "envy-bait": [/\b(my \$?\d+[km]?|luxury|dream (home|car|life)|rich|millionaire|you'll never)\b/i, /\b(broke people|poor mindset|while you)\b/i],
}

const INTENSIFIERS = ["very", "so", "extremely", "insanely", "literally", "actually", "absolutely", "!!!", "🔥", "😱", "💀", "🚨", "‼️"]
const POSITIVE = new Set(["love", "amazing", "beautiful", "best", "great", "happy", "wonderful", "grateful", "blessed", "cute", "wholesome", "incredible", "perfect", "win", "wholesome"])
const NEGATIVE = new Set(["hate", "worst", "terrible", "awful", "disgusting", "toxic", "broke", "fail", "crisis", "danger", "scary", "corrupt", "sad", "tragic", "angry", "insane"])

/* ── Scoring ──────────────────────────────────────────────────────────────── */

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean)
}

function scoreSentiment(text: string): { sentiment: number; intensity: number } {
  const ws = words(text)
  let pos = 0, neg = 0
  for (const w of ws) {
    if (POSITIVE.has(w)) pos++
    if (NEGATIVE.has(w)) neg++
  }
  const t = text.toLowerCase()
  let boost = 1
  for (const i of INTENSIFIERS) if (t.includes(i)) boost += 0.15
  const raw = (pos - neg) / Math.max(4, ws.length / 3)
  const sentiment = Math.max(-1, Math.min(1, raw * boost))
  const intensity = Math.max(0, Math.min(1, (pos + neg) / Math.max(6, ws.length / 3) * boost))
  return { sentiment, intensity }
}

function classify<T extends string>(text: string, lex: Record<string, string[]>, fallback: T): T {
  const t = text.toLowerCase()
  let bestKey = fallback as string
  let best = 0
  for (const [key, terms] of Object.entries(lex)) {
    let hits = 0
    for (const term of terms) if (t.includes(term)) hits++
    if (hits > best) { best = hits; bestKey = key }
  }
  return bestKey as T
}

function detectManipulations(text: string): Manipulation[] {
  const out: Manipulation[] = []
  for (const [name, patterns] of Object.entries(MANIP_PATTERNS) as [Manipulation, RegExp[]][]) {
    if (patterns.some((re) => re.test(text))) out.push(name)
  }
  return out
}

/** Analyze a single feed item deterministically. */
export function analyzeItem(item: FeedItem): ItemAnalysis {
  const { sentiment, intensity } = scoreSentiment(item.text)
  // Emotion first tries the emotion lexicon directly (charged feeds are full of
  // emotion words even when the +/- sentiment nets out near zero); only truly
  // flat text falls through to neutral.
  const emoGuess = classify<Emotion | "none">(item.text, EMOTION_WORDS, "none")
  const emotion: Emotion =
    emoGuess !== "none" ? emoGuess
    : intensity < 0.08 ? "neutral"
    : sentiment < -0.1 ? "anger" : "joy"
  const topic = classify<Topic>(item.text, TOPIC_WORDS, "other")
  const manipulations = detectManipulations(item.text)
  // Hook score: emotional charge + manipulation stacking, capped at 1.
  const hookScore = Math.min(1, intensity * 0.6 + manipulations.length * 0.18)
  return { item, sentiment, emotion, intensity, topic, manipulations, hookScore }
}

/* ── Roll-up: the mirror ──────────────────────────────────────────────────── */

export type FeedProfile = {
  count: number
  /** Dominant topics, most-fed first, with share 0..1. */
  topics: { topic: Topic; share: number }[]
  /** Emotion mix, share 0..1. */
  emotions: { emotion: Emotion; share: number }[]
  /** Manipulation techniques the feed leans on, by frequency. */
  manipulations: { name: Manipulation; count: number }[]
  /** Mean sentiment (−1..+1) — is your feed keeping you angry or content? */
  meanSentiment: number
  /** Mean hook score (0..1) — how engineered your feed is overall. */
  meanHook: number
  /** Echo-chamber score 0..1 — how concentrated into one topic/emotion. */
  echoChamber: number
  /** A short, plain-language read of who the algorithm thinks you are. */
  mirror: string
}

function share<T extends string>(counts: Map<T, number>, total: number): { key: T; share: number }[] {
  return [...counts.entries()]
    .map(([key, n]) => ({ key, share: n / total }))
    .sort((a, b) => b.share - a.share)
}

/** Herfindahl concentration (0 = perfectly spread, 1 = all one thing). */
function concentration(counts: Map<string, number>, total: number): number {
  let h = 0
  for (const n of counts.values()) h += (n / total) ** 2
  return h
}

export function profileFeed(analyses: ItemAnalysis[]): FeedProfile {
  const n = Math.max(1, analyses.length)
  const topicC = new Map<Topic, number>()
  const emoC = new Map<Emotion, number>()
  const manipC = new Map<Manipulation, number>()
  let sent = 0, hook = 0
  for (const a of analyses) {
    topicC.set(a.topic, (topicC.get(a.topic) ?? 0) + 1)
    emoC.set(a.emotion, (emoC.get(a.emotion) ?? 0) + 1)
    for (const m of a.manipulations) manipC.set(m, (manipC.get(m) ?? 0) + 1)
    sent += a.sentiment
    hook += a.hookScore
  }
  const topics = share(topicC, n).map((x) => ({ topic: x.key, share: x.share }))
  const emotions = share(emoC, n).map((x) => ({ emotion: x.key, share: x.share }))
  const manipulations = [...manipC.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  const meanSentiment = sent / n
  const meanHook = hook / n
  const echoChamber = Math.max(concentration(topicC as Map<string, number>, n), concentration(emoC as Map<string, number>, n))

  return {
    count: analyses.length,
    topics, emotions, manipulations,
    meanSentiment, meanHook, echoChamber,
    mirror: buildMirror(topics, emotions, manipulations, meanSentiment, meanHook, echoChamber),
  }
}

function buildMirror(
  topics: { topic: Topic; share: number }[],
  emotions: { emotion: Emotion; share: number }[],
  manipulations: { name: Manipulation; count: number }[],
  meanSentiment: number,
  meanHook: number,
  echoChamber: number,
): string {
  const topTopic = topics[0]
  const topEmotion = emotions.find((e) => e.emotion !== "neutral") ?? emotions[0]
  const mood = meanSentiment < -0.15 ? "keep you agitated" : meanSentiment > 0.15 ? "keep you comfortable" : "keep you scrolling"
  const echo = echoChamber > 0.4 ? "a tight echo chamber" : echoChamber > 0.25 ? "a fairly narrow lane" : "a mixed feed"
  const topManip = manipulations[0]?.name
  const parts: string[] = []
  if (topTopic) parts.push(`The algorithm has decided you're mostly here for **${topTopic.topic}** (${Math.round(topTopic.share * 100)}% of what it fed you)`)
  if (topEmotion && topEmotion.emotion !== "neutral") parts.push(`and it leans on **${topEmotion.emotion}** to ${mood}`)
  parts.push(`It's serving you ${echo}`)
  if (topManip) parts.push(`built largely on **${topManip.replace(/-/g, " ")}**`)
  if (meanHook > 0.5) parts.push(`— and it's working hard: ${Math.round(meanHook * 100)}% of these posts are engineered to hook you`)
  return parts.join(" ") + "."
}

/** Antidote — the counter-topics + a balancing suggestion for the echo chamber. */
const TOPIC_OPPOSITES: Partial<Record<Topic, string>> = {
  politics: "long-form, cross-partisan explainers instead of hot takes",
  money: "boring index-fund/personal-finance basics instead of get-rich-quick",
  conspiracy: "primary sources and fact-checks on the same claims",
  celebrity: "the people actually doing the work, not the drama around them",
  news: "a weekly digest instead of a minute-by-minute doom feed",
  "self-improvement": "rest and 'good enough' instead of relentless grind content",
  relationships: "healthy, undramatic relationship content instead of red-flag rage-bait",
  fitness: "sustainable habits instead of extreme transformation clips",
}
export function antidoteFor(profile: FeedProfile): { topic: Topic; suggestion: string }[] {
  return profile.topics
    .filter((t) => t.share >= 0.1 && TOPIC_OPPOSITES[t.topic])
    .slice(0, 3)
    .map((t) => ({ topic: t.topic, suggestion: TOPIC_OPPOSITES[t.topic]! }))
}

export const MANIPULATION_LABELS: Record<Manipulation, string> = {
  "rage-bait": "Rage-bait",
  doomscroll: "Doomscroll hook",
  fomo: "FOMO",
  "outrage-farming": "Outrage farming",
  parasocial: "Parasocial pull",
  cliffhanger: "Cliffhanger",
  "us-vs-them": "Us-vs-them",
  "envy-bait": "Envy-bait",
}
