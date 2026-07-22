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

/* ══════════════════════════════════════════════════════════════════════════
 * ARTICLE MODE — news-portal editorial bias.
 *
 * A social FEED and a news ARTICLE are different bias problems. A feed's bias is
 * the ALGORITHM (what it picks to feed you); an article's bias is the EDITORIAL
 * (framing, loaded words, who's cast as hero vs villain, sensational headline vs
 * body). BrainRot auto-detects which it's looking at and applies the right lens.
 * ══════════════════════════════════════════════════════════════════════════ */

export type PageMode = "feed" | "article"

/** Decide whether we're looking at a personalised FEED (many short repeated
 *  items) or a single long ARTICLE. Heuristic: one dominant long body = article;
 *  several similar-length short items = feed. */
export function detectMode(items: FeedItem[]): PageMode {
  if (items.length <= 2) {
    // A single sustained body over ~280 chars reads as an article, not a caption.
    const longest = Math.max(0, ...items.map((i) => i.text.length))
    return longest > 280 ? "article" : "feed"
  }
  const lengths = items.map((i) => i.text.length)
  const total = lengths.reduce((a, b) => a + b, 0)
  const max = Math.max(...lengths)
  // If one block dominates (>55% of all text) and is long, it's an article.
  if (max > 500 && max / total > 0.55) return "article"
  return "feed"
}

// Loaded / emotive language that editorializes rather than reports. Neutral
// reporting states facts; loaded language tells you how to feel about them.
const LOADED_WORDS = [
  "slammed", "blasted", "shocking", "outrageous", "disgraceful", "radical", "extremist",
  "regime", "so-called", "claims", "admits", "refuses", "controversial", "bombshell",
  "chaos", "crisis", "disaster", "failed", "botched", "desperate", "stunning", "brazen",
  "unprecedented", "damning", "explosive", "meltdown", "scathing", "furious", "backlash",
  "allegedly", "reportedly", "insiders say", "critics say", "sparked outrage", "erupted",
]

// Sensational headline cues — a headline should inform; these are engagement bait.
const SENSATIONAL_HEADLINE = [
  /\byou won'?t believe\b/i, /\bhere'?s (why|what|how)\b/i, /\bshocking\b/i,
  /\bthis is (what|why|how)\b/i, /\bgoes viral\b/i, /\bbreaks? (the )?internet\b/i,
  /\b(destroys?|slams?|blasts?|owns?)\b/i, /[!?]{2,}/, /\bwhat happened next\b/i,
]

// Simple partisan lexicons — presence of BOTH sides = balanced; heavy one-side
// framing signals slant. (Direction, not truth — we flag lean, not correctness.)
const LEFT_FRAME = ["progressive", "social justice", "climate crisis", "gun control", "reproductive rights", "systemic", "marginalized", "far-right", "misinformation"]
const RIGHT_FRAME = ["woke", "radical left", "illegal aliens", "law and order", "traditional values", "second amendment", "big government", "far-left", "mainstream media"]

export type ArticleAnalysis = {
  mode: "article"
  /** Loaded/emotive words found (editorializing language). */
  loadedWords: string[]
  /** 0..1 — density of loaded language (higher = more editorial, less neutral). */
  loadedDensity: number
  /** Overall sentiment of the piece (−1..+1). */
  sentiment: number
  /** Is the headline sensational (bait), based on the first line? */
  sensationalHeadline: boolean
  /** Framing lean from partisan cue words: −1 (one side) … +1 (the other), 0 balanced. */
  frameLean: number
  frameLabel: "left-leaning frame" | "right-leaning frame" | "mixed / balanced framing"
  /** Named-ish entities and the sentiment of the sentences that mention them. */
  entities: { name: string; sentiment: number; mentions: number }[]
  /** Plain-language read of the article's editorial bias. */
  mirror: string
}

/** Pull crude "entities" — capitalised multi-word or single proper nouns — and
 *  the mean sentiment of sentences that mention them. Deterministic, no NER. */
function entitySentiment(text: string): { name: string; sentiment: number; mentions: number }[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const scores = new Map<string, { s: number; n: number }>()
  // Match sequences of Capitalised Words (2+ chars), skipping sentence starts is
  // imperfect but fine for a lightweight signal.
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g
  for (const sent of sentences) {
    const { sentiment } = scoreSentiment(sent)
    const seen = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(sent))) {
      const name = m[1]
      // filter common non-entities
      if (name.length < 4 || /^(The|This|That|These|Those|And|But|Here|There|When|While|After|Before)\b/.test(name)) continue
      if (seen.has(name)) continue
      seen.add(name)
      const cur = scores.get(name) ?? { s: 0, n: 0 }
      cur.s += sentiment; cur.n += 1
      scores.set(name, cur)
    }
  }
  return [...scores.entries()]
    .filter(([, v]) => v.n >= 1) // any named entity with a sentiment-bearing mention
    .map(([name, v]) => ({ name, sentiment: v.s / v.n, mentions: v.n }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 6)
}

export function analyzeArticle(text: string): ArticleAnalysis {
  const lower = text.toLowerCase()
  const ws = words(text)
  const loadedWords = LOADED_WORDS.filter((w) => lower.includes(w))
  const loadedDensity = Math.min(1, loadedWords.length / Math.max(30, ws.length / 25))
  const { sentiment } = scoreSentiment(text)
  const headline = (text.split(/\n/)[0] || text.slice(0, 120)).trim()
  const sensationalHeadline = SENSATIONAL_HEADLINE.some((re) => re.test(headline))
  const leftHits = LEFT_FRAME.filter((w) => lower.includes(w)).length
  const rightHits = RIGHT_FRAME.filter((w) => lower.includes(w)).length
  const denom = leftHits + rightHits
  const frameLean = denom === 0 ? 0 : (rightHits - leftHits) / denom
  const frameLabel =
    denom === 0 || Math.abs(frameLean) < 0.34 ? "mixed / balanced framing"
    : frameLean < 0 ? "left-leaning frame" : "right-leaning frame"
  const entities = entitySentiment(text)

  return {
    mode: "article",
    loadedWords, loadedDensity, sentiment, sensationalHeadline,
    frameLean, frameLabel, entities,
    mirror: buildArticleMirror(loadedWords, loadedDensity, sensationalHeadline, frameLabel, entities),
  }
}

function buildArticleMirror(
  loaded: string[], density: number, sensational: boolean,
  frameLabel: string, entities: { name: string; sentiment: number; mentions: number }[],
): string {
  const parts: string[] = []
  if (density > 0.5) parts.push(`This reads as **opinion dressed as news** — heavy loaded language (${loaded.slice(0, 4).join(", ")}…)`)
  else if (density > 0.2) parts.push(`Mostly reporting, but it editorialises in places (${loaded.slice(0, 3).join(", ")})`)
  else parts.push(`Fairly neutral wording`)
  if (sensational) parts.push(`the headline is engineered for clicks, not clarity`)
  if (frameLabel !== "mixed / balanced framing") parts.push(`and it's written from a **${frameLabel}**`)
  const hero = entities.find((e) => e.sentiment > 0.2)
  const villain = entities.find((e) => e.sentiment < -0.2)
  if (hero && villain) parts.push(`— it casts **${hero.name}** favourably and **${villain.name}** negatively`)
  else if (villain) parts.push(`— it frames **${villain.name}** negatively`)
  else if (hero) parts.push(`— it frames **${hero.name}** favourably`)
  return parts.join(", ").replace(/, —/g, " —") + "."
}
