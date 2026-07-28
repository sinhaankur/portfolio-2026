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
  const m = t.match(
    /\b(?:fly|go|take me|navigate|show me|jump|travel|warp|zoom)\s+(?:me\s+)?(?:to\s+|into\s+|toward\s+)?(.+)/i,
  )
  if (!m) return null
  const target = m[1].replace(/[.?!,]+$/, "").replace(/\bplease\b/i, "").trim()
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

const SYSTEM = `You are the Universe Engine assistant. You help people explore a real, data-driven 3D model of the universe. Answer in 1-3 short sentences, warm and clear, for a curious non-expert. Use ONLY the facts provided in the context — if the context doesn't cover it, say what you do know briefly and suggest exploring. Never invent numbers.`

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
  let flewTo: string | null = null
  let flyFailed = false
  if (flyTarget) {
    options.onToolStart({ name: "flyToBody" })
    const { content, isError } = await executeAssistantTool("flyToBody", { name: flyTarget })
    options.onToolEnd({ name: "flyToBody", result: content, isError })
    toolResults.push({
      type: "tool_result",
      tool_use_id: `webllm-fly-${Date.now()}`,
      content,
    } as ContentBlockParam)
    if (isError) flyFailed = true
    else flewTo = flyTarget
  }

  // 3. ANSWER. If we FLEW, confirm the real action deterministically — no model,
  // no hollow "you can fly to any location, journey may vary" filler. The camera
  // is already moving; the assistant just states what it did. This is what makes
  // it actionable instead of a shell.
  let answer = ""
  if (flewTo) {
    const hit = searchUniverseCatalog(flewTo, 1)[0]
    answer = `Flying you to ${hit?.name ?? flewTo} now${hit?.subtitle ? ` — ${hit.subtitle}` : ""}.`
    options.onTextDelta(answer)
    const finalAssistantContent: ContentBlock[] = [
      { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
    ]
    return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
  }
  if (flyFailed && flyTarget) {
    answer = `I couldn't find "${flyTarget}" to fly to. Try a body name like Mars, the Orion Nebula, or Voyager 1.`
    options.onTextDelta(answer)
    const finalAssistantContent: ContentBlock[] = [
      { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
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
    } catch (err) {
      // Model load / run failed → deterministic fallback.
      answer = groundedFallback(hits, flyTarget)
      options.onTextDelta(answer)
    }
  } else {
    answer = groundedFallback(hits, flyTarget)
    options.onTextDelta(answer)
  }

  const finalAssistantContent: ContentBlock[] = [
    { type: "text", text: answer, citations: [] } as unknown as ContentBlock,
  ]

  return { finalAssistantContent, toolResultsForHistory: toolResults, totalUsage: ZERO_USAGE }
}

/**
 * A genuinely useful answer built purely from real catalog data — NO model.
 * This is the seamless, zero-resource path: it grounds on the catalogue hit,
 * adds how we OBSERVE the object (the EM band — radio/IR/visible/X-ray, from
 * lib/observe.ts), and offers to fly there. So even with no LLM the assistant
 * teaches something true rather than a one-line stub.
 */
function groundedFallback(
  hits: ReturnType<typeof searchUniverseCatalog>,
  flyTarget: string | null,
): string {
  if (!hits.length) {
    return "I couldn't find that in the catalog. Try a planet, moon, comet, a black hole like Cygnus X-1, or a deep-sky object like the Orion Nebula."
  }
  const top = hits[0]
  const obs = howWeObserve(kindFromClassification(top.kind), top.name) ?? howWeObserve(top.kind, top.name)
  const seeLine = obs ? ` ${obs.how}` : ""
  if (flyTarget) {
    return `Flying you to ${top.name} now${top.subtitle ? ` — ${top.subtitle}` : ""}.${seeLine}`
  }
  return `${top.name}${top.subtitle ? ` — ${top.subtitle}` : ""}.${seeLine} Ask me to fly you there, or ask about another body.`
}
