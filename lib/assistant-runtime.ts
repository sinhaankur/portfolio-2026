/**
 * Assistant runtime — single entry point the UI calls.
 *
 * Routes per-turn execution to the right backend based on the
 * provider config. The shape `runAssistantConversationTurn` exposes
 * is identical regardless of provider — same callbacks, same return
 * value — so the UI stays oblivious to which model is actually
 * running on the other side of the wire.
 */

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import type { AssistantUsage } from "@/lib/anthropic-client"
import { runAssistantTurn, ZERO_USAGE, addUsage, estimateCostUSD } from "@/lib/anthropic-client"
import { runOpenAICompatTurn } from "@/lib/openai-compat-client"
import type { ProviderConfig } from "@/lib/llm-provider"
import { readActiveConfig } from "@/lib/llm-provider"

export type AssistantTurnOptions = {
  /** Resolved provider config (key/model/baseUrl/etc.). Pull from
   *  `readActiveConfig()` or pass an override for testing. */
  config: ProviderConfig
  /** Full conversation history including the new user message. */
  history: MessageParam[]
  /** Optional abort signal. */
  signal?: AbortSignal
  onTextDelta: (delta: string) => void
  onToolStart: (info: { name: string }) => void
  onToolEnd: (info: { name: string; result: string; isError: boolean }) => void
  onIterationUsage: (usage: AssistantUsage) => void
}

export type AssistantTurnResult = {
  /** Final assistant content blocks to append to history. Anthropic
   *  shape — the OpenAI-compat path converts its output to match so
   *  the UI's history representation is uniform. */
  finalAssistantContent: import("@anthropic-ai/sdk/resources/messages").ContentBlock[]
  /** Tool results emitted during the loop, in the form the next user
   *  turn expects. */
  toolResultsForHistory: import("@anthropic-ai/sdk/resources/messages").ContentBlockParam[]
  totalUsage: AssistantUsage
}

/**
 * Run one assistant turn against whichever provider is active.
 *
 * Anthropic: full streaming + tool_use loop with prompt caching,
 *   adaptive thinking. Best quality, costs API credits.
 *
 * LM Studio / Ollama: same streaming + tool-use loop but talking
 *   to a local OpenAI-compatible endpoint. No prompt caching, no
 *   adaptive thinking — those are Anthropic-only. Costs nothing
 *   beyond the visitor's electricity.
 */
export async function runAssistantConversationTurn(
  options: AssistantTurnOptions,
): Promise<AssistantTurnResult> {
  const { config } = options
  if (config.provider === "anthropic") {
    return runAssistantTurn({
      apiKey: config.apiKey,
      model: config.model,
      history: options.history,
      signal: options.signal,
      onTextDelta: options.onTextDelta,
      onToolStart: options.onToolStart,
      onToolEnd: options.onToolEnd,
      onIterationUsage: options.onIterationUsage,
    })
  }
  // LM Studio + Ollama: hand-rolled OpenAI-compatible client.
  // History is in Anthropic shape; the client converts internally.
  const result = await runOpenAICompatTurn({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    // The OpenAI-compat client uses a slightly relaxed message type
    // (no strict MessageParam discrimination — string OR block array).
    // MessageParam is structurally compatible with that.
    history: options.history as unknown as Parameters<typeof runOpenAICompatTurn>[0]["history"],
    signal: options.signal,
    onTextDelta: options.onTextDelta,
    onToolStart: options.onToolStart,
    onToolEnd: options.onToolEnd,
    onIterationUsage: options.onIterationUsage,
  })
  // The OpenAI-compat client returns Anthropic-shaped content already
  // (we converted on the way out), but ContentBlock has a few more
  // fields the SDK adds. Cast through unknown to satisfy the strict
  // types without forcing the client to import the SDK.
  return {
    finalAssistantContent: result.finalAssistantContent as unknown as AssistantTurnResult["finalAssistantContent"],
    toolResultsForHistory: result.toolResultsForHistory as unknown as AssistantTurnResult["toolResultsForHistory"],
    totalUsage: result.totalUsage,
  }
}

// Re-export the helpers the UI needs so it can import from a single
// runtime entry point.
export { ZERO_USAGE, addUsage, estimateCostUSD, readActiveConfig }
export type { AssistantUsage }
