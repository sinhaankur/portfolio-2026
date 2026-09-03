/**
 * WebLLM assistant turn — runs the Universe Assistant on the in-browser tiny
 * model (no key, no server). A 0.5–1B model can't drive a reliable multi-tool
 * agentic loop, so we take the honest, grounded shape that matches the project's
 * "deterministic core, LLM for phrasing" philosophy:
 *
 *   1. GROUND — pull the most relevant catalog entries for the user's message
 *      from the deterministic search (real data, no hallucination surface).
 *   2. ACT — if the message reads as "take me to X / fly to X / show me X" and
 *      X resolves to a real body, run the flyToBody tool directly (deterministic,
 *      not model-decided) so navigation always works even if the model is weak.
 *   3. EXPLAIN — feed the grounded facts to the tiny model and let it phrase a
 *      short, friendly answer. Streams token-by-token into the same callbacks
 *      the Anthropic/OpenAI paths use, so the UI is provider-oblivious.
 *
 * If WebGPU is unavailable, the model step is skipped and we return the grounded
 * facts directly — the assistant degrades to a fast deterministic answer.
 */

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import type { ContentBlock, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages"
import { ZERO_USAGE, type AssistantUsage } from "@/lib/anthropic-client"
import { searchUniverseCatalog, executeAssistantTool } from "@/lib/assistant-tools"
import { getWebLLMEngine, isWebGPUAvailable, type WebLLMProgress } from "@/lib/webllm-engine"
import { howWeObserve, kindFromClassification } from "@/lib/observe"
import { answerSpaceQuestion } from "@/lib/space-qa"

export type WebLLMTurnOptions = {
  model: string
  history: MessageParam[]
  signal?: AbortSignal
  onTextDelta: (delta: string) => void
  onToolStart: (info: { name: string }) => void
  onToolEnd: (info: { name: string; result: string; isError: boolean }) => void
  onModelProgress?: (p: WebLLMProgress) => void
}

export type WebLLMTurnResult = {
  finalAssistantContent: ContentBlock[]
  toolResultsForHistory: ContentBlockParam[]
  totalUsage: AssistantUsage
}

/** Pull the latest user text out of the Anthropic-shaped history. */
function lastUserText(history: MessageParam[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.role !== "user") continue
    if (typeof m.content === "string") return m.content
    const text = m.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim()
    if (text) return text
  }
  return ""
}

/** Words that mean "the thing we were just talking about" — resolved to the
 *  last-mentioned body from context so "fly there" / "take me to it" work. */
const PRONOUN_TARGET = /^(there|here|it|that|this|this one|that one|them)$/i

/** Detect a navigation intent + the target name. Deterministic, so it works
 *  regardless of model quality. Returns the raw target phrase, or the sentinel
 *  "$LAST" when the user referred to it by a pronoun (resolve from context). */
function detectFlyIntent(text: string): string | null {
  const t = text.trim()
  // Bare verbs with no target ("fly", "take me", "go there") → last body.
  if (/^(?:fly|go|take me|navigate|jump|travel|warp|zoom)(?:\s+me)?(?:\s+(?:there|here|to it|to that))?[.?!]?$/i.test(t)) {
    return "$LAST"
  }
  // A broad set of natural phrasings, all meaning "put the camera on X":
  //   fly to / go to / take me to / show me / navigate to / jump to /
  //   I want to see / bring me to / let's see / visit / find / where is / look at
  const m = t.match(
    /\b(?:fly|go|take me|navigate|show me|jump|travel|warp|zoom|(?:i(?:'d| would)? (?:want|like) to see)|(?:can you (?:take|show) me)|bring me|let'?s (?:see|go|visit)|visit|find|(?:where(?:'s| is)?)|look at)\s+(?:me\s+)?(?:to\s+|into\s+|toward\s+|at\s+)?(.+)/i,
  )
  if (!m) return null
  const target = m[1]
    // Cut off a trailing compound clause ("...and show how it was sent",
    // "...to its origin") so the target is just the body name.
    .split(/\s+(?:and|also|then|plus|,|to (?:its|the|see|show))\s+/i)[0]
    .replace(/[.?!,]+$/, "")
    .replace(/\bplease\b/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .trim()
  if (!target || PRONOUN_TARGET.test(target)) return "$LAST"
  return target
}

/** The last real body name mentioned in the conversation (assistant or user),
 *  so a pronoun reference ("there") resolves to it. Scans newest → oldest and
 *  returns the first catalog hit found in any message's text. */
function lastMentionedBody(history: MessageParam[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    const text = typeof m.content === "string"
      ? m.content
      : m.content.map((b) => (b.type === "text" ? b.text : "")).join(" ")
    if (!text) continue
    // Take the strongest catalog hit whose name actually appears in the text.
    const hits = searchUniverseCatalog(text, 8)
    const named = hits.find((h) => text.toLowerCase().includes(h.name.toLowerCase()))
    if (named) return named.name
  }
  return null
}

/** Does the user want the ORIGIN / launch / journey story of a craft? Broad on
 *  purpose — 'how it was sent', 'show how it was launched', 'its journey/path/
 *  origin/route', 'how it got there', 'left Earth'. */
function wantsJourney(text: string): boolean {
  return /\b(sent|launch(?:ed)?|journey|origin|route|trajectory|how (?:it|they|.+) (?:got|travel|left|reach|made))\b/i.test(text)
}

/** Does the user want the body AT PERIHELION (closest to the Sun)? Returns which
 *  perihelion ("next"/"previous"/"nearest") or null. Deterministic so "take me to
 *  Halley's Comet at perihelion" flies AND sets the date without needing the LLM. */
function wantsPerihelion(text: string): "next" | "previous" | "nearest" | null {
  if (!/\b(perihelion|closest (?:approach )?to the sun|nearest the sun|closest to the sun)\b/i.test(text)) {
    return null
  }
  if (/\b(last|previous|prior|1986|most recent)\b/i.test(text)) return "previous"
  if (/\b(nearest|closest) (?:in )?time\b/i.test(text)) return "nearest"
  return "next"
}

/** Strip a trailing "at perihelion" clause so the target resolves to just the
 *  body name (e.g. "Halley's Comet at perihelion" → "Halley's Comet"). */
function stripPerihelion(target: string): string {
  return target
    .replace(/\s+(?:at|during|near|around)\s+(?:its\s+)?(?:perihelion|closest.*|nearest.*)$/i, "")
    .replace(/\s+perihelion$/i, "")
    .trim()
}

/**
 * The real "how it was sent" story for the deep-space craft — launch year + site
 * + the gravity-assist route that flung it outward, ending at where it is now.
 * Real history; keyed by the exact namedBody name so it composes with a fly-to.
 */
const CRAFT_JOURNEY: Record<string, string> = {
  "Voyager 1": "Launched September 5, 1977 from Cape Canaveral on a Titan IIIE-Centaur. It flew past Jupiter (1979) and Saturn (1980), stealing orbital energy from each in a gravity assist that flung it up and out of the planetary plane — now the most distant human-made object, over 24 billion km out, coasting into interstellar space.",
  "Voyager 2": "Launched August 20, 1977 from Cape Canaveral — two weeks BEFORE Voyager 1. On the slower 'Grand Tour' path, it used gravity assists at Jupiter, Saturn, Uranus and Neptune (the only craft to visit all four), each flyby bending and speeding it toward its eventual escape to the south.",
  "Pioneer 10": "Launched March 2, 1972 — the first craft to cross the asteroid belt and fly by Jupiter (1973), whose gravity threw it onto solar-escape velocity. Now silent, drifting toward Aldebaran.",
  "Pioneer 11": "Launched April 5, 1973. A Jupiter flyby (1974) slingshot it across the solar system to become the first craft to visit Saturn (1979), then out toward the constellation Aquila.",
  "New Horizons": "Launched January 19, 2006 as the fastest craft ever off Earth — a direct Jupiter gravity assist (2007) cut years off the trip to Pluto (2015) and on to the Kuiper Belt object Arrokoth (2019).",
  "Parker Solar Probe": "Launched August 12, 2018. It uses repeated Venus gravity assists to shed orbital energy and spiral ever closer to the Sun — the opposite of the escaping probes, diving inward to touch the corona.",
  "James Webb Space Telescope": "Launched December 25, 2021 on an Ariane 5 from Kourou. It cruised a month out to the Sun–Earth L2 point, 1.5 million km beyond Earth, where it orbits the balance point in permanent cold shadow.",
}

// A tiny (0.5–1.5B) model follows EXAMPLES far better than instructions, so the
// prompt is few-shot: strict rules + three worked answers that fix the exact
// voice, length, and "ground in the context, never invent" behaviour. This is
// what makes a small on-device model punch above its weight.
const SYSTEM = `You are the Universe Engine assistant — a warm, precise guide to a real, data-driven 3D map of the universe.

Rules:
- Answer in 1–2 short sentences. No preamble, no "As an AI", no bullet lists.
- Use ONLY facts in the provided Context. NEVER invent a number, distance, or date.
- If the Context doesn't cover it, say briefly what you do know and suggest exploring that body.
- Prefer the concrete: what it is, and how we observe it (the wavelength band), if given.

Examples:

Context:
- Mars (planet): Terrestrial planet [observed in visible/infrared: Planets shine by reflecting sunlight; infrared reveals their heat and atmospheres.]
User: what is mars
Answer: Mars is a terrestrial planet — a cold, rusty desert world. We see it by reflected sunlight, and infrared reveals its thin atmosphere and surface heat.

Context:
- Voyager 1 (spacecraft): Voyager 1 · NASA · 1977 [observed in radio: Deep-space probes are found only by their faint radio signal — Voyager 1's 22-watt carrier takes 22+ hours to reach us.]
User: tell me about voyager 1
Answer: Voyager 1 is the most distant human-made object, launched in 1977. We don't see it — we listen: its faint 22-watt radio signal now takes over 22 hours to reach Earth.

Context:
(no direct catalog match)
User: what's the best pizza
Answer: I'm the guide to this universe map, so I can't help with pizza — but ask me about a planet, a comet, a black hole, or a satellite and I'll take you there.`

export async function runWebLLMTurn(options: WebLLMTurnOptions): Promise<WebLLMTurnResult> {
  const userText = lastUserText(options.history)

  // 1. GROUND — real catalog hits for this query, each enriched with HOW WE
  // OBSERVE it (the EM band) so the answer can teach how we actually see it.
  const hits = searchUniverseCatalog(userText, 6)
  const context = hits.length
    ? hits.map((h) => {
        const obs = howWeObserve(kindFromClassification(h.kind), h.name) ?? howWeObserve(h.kind, h.name)
        const obsStr = obs ? ` [observed in ${obs.bands.join("/")}: ${obs.how}]` : ""
        return `- ${h.name}${h.kind ? ` (${h.kind})` : ""}${h.subtitle ? `: ${h.subtitle}` : ""}${obsStr}`
      }).join("\n")
    : "(no direct catalog match)"

  const toolResults: ContentBlockParam[] = []

  // 2. ACT — deterministic navigation if the user asked to go somewhere. This is
  // the source of truth: if the user says "fly there", we ACTUALLY fly (no
  // hollow "you can fly to any location…" text). Resolve a pronoun target
  // ("there"/"it") to the last body mentioned in the conversation.
  let flyTarget = detectFlyIntent(userText)
  if (flyTarget === "$LAST") flyTarget = lastMentionedBody(options.history)
  // "...at perihelion" upgrades the plain fly-to into a perihelion jump: set the
  // clock to closest approach AND fly + follow, in one deterministic call.
  const periWhich = flyTarget ? wantsPerihelion(userText) : null
  if (flyTarget && periWhich) flyTarget = stripPerihelion(flyTarget)
  let flewTo: string | null = null
  let flyFailed = false
  let periResult: string | null = null
  let flyResultLine: string | null = null
  if (flyTarget) {
    const toolName = periWhich ? "flyToBodyAtPerihelion" : "flyToBody"
    const toolInput = periWhich ? { name: flyTarget, which: periWhich } : { name: flyTarget }
    options.onToolStart({ name: toolName })
    const { content, isError } = await executeAssistantTool(toolName, toolInput)
    options.onToolEnd({ name: toolName, result: content, isError })
    toolResults.push({
      type: "tool_result",
      tool_use_id: `webllm-fly-${Date.now()}`,
      content,
    } as ContentBlockParam)
    // HONESTY: the tool reports "not found" as a plain string, not an error —
    // treating that as success used to produce a confident "Flying you to X
    // now." while the camera went nowhere (the hollow-shell failure mode).
    if (isError || /not found/i.test(content)) flyFailed = true
    else {
      flewTo = flyTarget
      if (periWhich) periResult = content
      // The tool's own line names the REAL resolved object (a satellite pick
      // resolves "the ISS" → "ISS (ZARYA)"); the catalog search below doesn't
      // know satellites, so keep this as the authoritative confirmation.
      if (content.startsWith("Flying to ") || content.startsWith("At perihelion")) flyResultLine = content
    }
  }

  // 3. ANSWER. If we FLEW, confirm the real action deterministically — no model,
  // no hollow "you can fly to any location, journey may vary" filler. The camera
  // is already moving; the assistant just states what it did. This is what makes
  // it actionable instead of a shell.
  let answer = ""
  if (flewTo) {
    const hit = searchUniverseCatalog(flewTo, 1)[0]
    const name = hit?.name ?? flewTo
    // A perihelion jump already carries the real date + distance in its result —
    // surface that rather than the generic "flying you to X" line. Likewise a
    // satellite fly-to: the tool line names the real resolved craft.
    answer = periResult
      ? periResult
      : flyResultLine
      ? flyResultLine
      : `Flying you to ${name} now${hit?.subtitle ? ` — ${hit.subtitle}` : ""}.`
    // If the user asked HOW it was sent / launched / its journey, narrate the
    // real launch + gravity-assist route that took it from Earth to where it is.
    // (Flying to a spacecraft already draws its escape trajectory in the scene.)
    if (wantsJourney(userText)) {
      const journey = CRAFT_JOURNEY[name] ?? Object.entries(CRAFT_JOURNEY).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1]
      if (journey) answer += ` ${journey} You can see its path traced out from here.`
    }
    options.onTextDelta(answer)
    const finalAssistantContent: ContentBlock[] = [
      { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
    ]
    return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
  }
  if (flyFailed && flyTarget) {
    answer = `I couldn't find "${flyTarget}" to fly to. Try a body name like Mars, the Orion Nebula, Voyager 1 — or a satellite like the ISS or NOAA 19.`
    options.onTextDelta(answer)
    const finalAssistantContent: ContentBlock[] = [
      { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
    ]
    return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
  }

  // Journey question WITHOUT a fly ("how was Voyager 1 sent?") — answer the real
  // launch/route story directly, deterministically, and offer to fly there.
  if (wantsJourney(userText) && hits.length) {
    const jName = Object.keys(CRAFT_JOURNEY).find((k) => hits.some((h) => h.name === k) || userText.toLowerCase().includes(k.toLowerCase()))
    if (jName) {
      answer = `${jName}: ${CRAFT_JOURNEY[jName]} Ask me to take you there to see its path.`
      options.onTextDelta(answer)
      const finalAssistantContent: ContentBlock[] = [
        { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
      ]
      return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
    }
  }

  // Deterministic FACT Q&A — superlatives (biggest/hottest/farthest planet),
  // counts (how many planets/satellites/moons), a body's distance, "how far back
  // can we go", "first spacecraft". Answered from real data, never invented, so
  // these land correctly regardless of model quality (or with no model at all).
  const factAnswer = answerSpaceQuestion(userText)
  if (factAnswer) {
    options.onTextDelta(factAnswer)
    const finalAssistantContent: ContentBlock[] = [
      { type: "text", text: factAnswer, citations: [] } as unknown as ContentBlock,
    ]
    return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
  }

  // Otherwise EXPLAIN — phrase an answer with the tiny model, streaming. If
  // WebGPU is missing, fall back to a plain grounded reply (no model).
  if (isWebGPUAvailable()) {
    try {
      const engine = await getWebLLMEngine(options.model, options.onModelProgress)
      const prompt = `Context:\n${context}\n\nUser: ${userText}\n\nAnswer:`
      // web-llm supports streaming via async iterator; fall back to non-stream.
      const stream = (await engine.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 220,
        stream: true,
      })) as unknown as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>

      for await (const chunk of stream) {
        if (options.signal?.aborted) break
        const delta = chunk.choices?.[0]?.delta?.content ?? ""
        if (delta) {
          answer += delta
          options.onTextDelta(delta)
        }
      }
    } catch {
      // Model load / run failed → deterministic fallback.
      answer = await groundedFallback(hits, flyTarget)
      options.onTextDelta(answer)
    }
  } else {
    answer = await groundedFallback(hits, flyTarget)
    options.onTextDelta(answer)
  }

  const finalAssistantContent: ContentBlock[] = [
    { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
  ]

  return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
}

/** Pull the top hit's REAL fact from the dataset (getBodyDetails) so the no-model
 *  answer can quote a true sentence rather than just a subtitle. */
async function realFactFor(name: string): Promise<string | null> {
  try {
    const { content } = await executeAssistantTool("getBodyDetails", { name })
    const data = JSON.parse(content) as { fact?: string }
    const f = data?.fact
    if (!f) return null
    // Keep it to the first sentence or two so the answer stays glanceable.
    const trimmed = f.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")
    return trimmed.length > 300 ? trimmed.slice(0, 297) + "…" : trimmed
  } catch { return null }
}

/**
 * A genuinely useful answer built purely from real catalog data — NO model.
 * The seamless, zero-resource path: it grounds on the catalogue hit, quotes the
 * body's REAL fact from the dataset, adds how we OBSERVE it (the EM band), and
 * offers to fly there. So with no LLM at all the assistant still gives a true,
 * substantive answer — not a one-line stub.
 */
async function groundedFallback(
  hits: ReturnType<typeof searchUniverseCatalog>,
  flyTarget: string | null,
): Promise<string> {
  if (!hits.length) {
    return "I couldn't find that in the catalog. Try a planet, moon, comet, a black hole like Cygnus X-1, or a deep-sky object like the Orion Nebula."
  }
  const top = hits[0]
  const fact = await realFactFor(top.name)
  const obs = howWeObserve(kindFromClassification(top.kind), top.name) ?? howWeObserve(top.kind, top.name)
  const seeLine = obs ? ` ${obs.how}` : ""
  if (flyTarget) {
    return `Flying you to ${top.name} now${top.subtitle ? ` — ${top.subtitle}` : ""}.${fact ? ` ${fact}` : ""}`.trim()
  }
  // Lead with the real fact when we have one; else the subtitle + observe line.
  const lead = fact
    ? `${top.name} — ${fact}`
    : `${top.name}${top.subtitle ? ` — ${top.subtitle}` : ""}.`
  return `${lead}${seeLine} Ask me to fly you there, or about another body.`
}
