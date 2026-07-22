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

/** Detect a navigation intent + the target name. Deterministic, so it works
 *  regardless of model quality. */
function detectFlyIntent(text: string): string | null {
  const m = text.match(
    /\b(?:fly|go|take me|navigate|show me|jump|travel|warp|zoom)\s+(?:me\s+)?(?:to\s+|into\s+|toward\s+)?(.+)/i,
  )
  if (!m) return null
  // Trim trailing punctuation / filler.
  return m[1].replace(/[.?!,]+$/, "").replace(/\bplease\b/i, "").trim()
}

const SYSTEM = `You are the Universe Engine assistant. You help people explore a real, data-driven 3D model of the universe. Answer in 1-3 short sentences, warm and clear, for a curious non-expert. Use ONLY the facts provided in the context — if the context doesn't cover it, say what you do know briefly and suggest exploring. Never invent numbers.`

export async function runWebLLMTurn(options: WebLLMTurnOptions): Promise<WebLLMTurnResult> {
  const userText = lastUserText(options.history)

  // 1. GROUND — real catalog hits for this query.
  const hits = searchUniverseCatalog(userText, 6)
  const context = hits.length
    ? hits.map((h) => `- ${h.name}${h.kind ? ` (${h.kind})` : ""}${h.subtitle ? `: ${h.subtitle}` : ""}`).join("\n")
    : "(no direct catalog match)"

  const toolResults: ContentBlockParam[] = []

  // 2. ACT — deterministic navigation if the user asked to go somewhere.
  const flyTarget = detectFlyIntent(userText)
  if (flyTarget) {
    options.onToolStart({ name: "flyToBody" })
    const { content, isError } = await executeAssistantTool("flyToBody", { name: flyTarget })
    options.onToolEnd({ name: "flyToBody", result: content, isError })
    toolResults.push({
      type: "tool_result",
      tool_use_id: `webllm-fly-${Date.now()}`,
      content,
    } as ContentBlockParam)
  }

  // 3. EXPLAIN — phrase an answer with the tiny model, streaming. If WebGPU is
  // missing, fall back to a plain grounded reply (no model).
  let answer = ""
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

/** A concise, honest answer built purely from real catalog data (no model). */
function groundedFallback(
  hits: ReturnType<typeof searchUniverseCatalog>,
  flyTarget: string | null,
): string {
  if (flyTarget && hits.length) {
    return `Taking you to ${hits[0].name}. ${hits[0].subtitle ?? ""}`.trim()
  }
  if (hits.length) {
    const top = hits[0]
    return `${top.name}${top.subtitle ? ` — ${top.subtitle}` : ""}. Explore it in the scene, or ask about another body.`
  }
  return "I couldn't find that in the catalog. Try a planet, moon, comet, or a deep-sky object like the Orion Nebula."
}
