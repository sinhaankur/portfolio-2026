/**
 * Anthropic client — browser-direct streaming + tool-call loop.
 *
 * Architecture choices made explicit:
 *
 *  1. Browser-direct.
 *     Anthropic supports `anthropic-dangerous-direct-browser-access: true`
 *     for BYO-key static-site setups. We pass `dangerouslyAllowBrowser: true`
 *     to the SDK; the user's API key only ever lives in localStorage and
 *     request headers — never on any server we run.
 *
 *  2. Streaming.
 *     `client.messages.stream()` with the same param shape as
 *     `messages.create()`. The Stream emits typed events; we read text
 *     deltas live and use `stream.finalMessage()` to collect the full
 *     `Message` (including tool_use blocks + usage) when each iteration
 *     completes. Per the claude-api skill: don't wrap `.on()` in `new
 *     Promise()` — `finalMessage()` resolves with the final message and
 *     handles error/abort/completion internally.
 *
 *  3. Manual agentic loop.
 *     We could use the SDK's `toolRunner()`, but the loop here is short
 *     enough to read explicitly + gives us a hook to dispatch each tool
 *     event into the live engine refs. Roughly: stream → finalMessage
 *     → if stop_reason is "tool_use", execute all tool_use blocks
 *     against the engine, append a single `user` message of
 *     tool_result blocks, and loop. Stop on "end_turn".
 *
 *  4. Prompt caching.
 *     The system prompt + tool definitions + injected dataset are all
 *     stable across requests. We mark them with
 *     `cache_control: { type: "ephemeral" }` so every call after the
 *     first reads from the cache at ~10% of input cost. The varying
 *     part — the conversation messages — sits after the last cache
 *     breakpoint.
 *
 *  5. Adaptive thinking.
 *     Sonnet 4.6 supports `thinking: { type: "adaptive" }` — the model
 *     decides when to reason. For tool-using conversational agents
 *     this is the right default.
 */

import Anthropic from "@anthropic-ai/sdk"
import type {
  ContentBlock,
  ContentBlockParam,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages"

import { ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/assistant-tools"
import { buildSystemPrompt } from "@/lib/assistant-context"

export type AssistantModel =
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "claude-opus-4-7"

/** Default model — Sonnet 4.6 per the user's pick.
 *  Per the claude-api skill, this is the exact model ID string;
 *  do not append a date suffix. */
export const DEFAULT_MODEL: AssistantModel = "claude-sonnet-4-6"

/** Lazy-initialised system prompt. The dataset is large; we serialise
 *  it once per page load and reuse. Stable bytes are required for the
 *  prompt cache to hit. */
let _cachedSystemPrompt: string | null = null
function getSystemPrompt(): string {
  if (_cachedSystemPrompt == null) _cachedSystemPrompt = buildSystemPrompt()
  return _cachedSystemPrompt
}

/* ------------------------------------------------------------------
 * Per-request usage (cost transparency)
 * ------------------------------------------------------------------ */

export type AssistantUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/** Per-model input/output $/M tokens. Cache reads are ~10% of input.
 *  Cache writes (5-minute TTL) are ~1.25× input. */
const PRICING: Record<AssistantModel, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
}

export function estimateCostUSD(
  usage: AssistantUsage,
  model: AssistantModel,
): number {
  const rate = PRICING[model]
  const inputCost = (usage.input_tokens / 1_000_000) * rate.input
  const cacheReadCost =
    (usage.cache_read_input_tokens / 1_000_000) * rate.input * 0.1
  const cacheWriteCost =
    (usage.cache_creation_input_tokens / 1_000_000) * rate.input * 1.25
  const outputCost = (usage.output_tokens / 1_000_000) * rate.output
  return inputCost + cacheReadCost + cacheWriteCost + outputCost
}

export function addUsage(a: AssistantUsage, b: AssistantUsage): AssistantUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens:
      a.cache_read_input_tokens + b.cache_read_input_tokens,
    cache_creation_input_tokens:
      a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  }
}

export const ZERO_USAGE: AssistantUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

/* ------------------------------------------------------------------
 * Public message shape consumed by the UI.
 *
 * We keep this separate from the Anthropic SDK's MessageParam type so
 * the UI can render in-progress states cleanly (streaming text, tool
 * use indicators) without leaking the SDK's discriminated unions into
 * every component.
 * ------------------------------------------------------------------ */

export type AssistantUIMessage =
  | { role: "user"; text: string; id: string }
  | {
      role: "assistant"
      id: string
      // The model's interleaved output: text + tool-use indicators.
      blocks: AssistantUIBlock[]
      // Once the turn is fully resolved, this is set.
      usage?: AssistantUsage
    }

export type AssistantUIBlock =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; resultPreview?: string }

/* ------------------------------------------------------------------
 * Client construction
 * ------------------------------------------------------------------ */

function buildClient(apiKey: string): Anthropic {
  // dangerouslyAllowBrowser is required for browser-direct use.
  // Anthropic surfaces this with the "anthropic-dangerous-direct-
  // browser-access" header automatically when the SDK sees the flag.
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })
}

/* ------------------------------------------------------------------
 * Validation — ping the API with a tiny request to confirm the key.
 * ------------------------------------------------------------------ */

export async function validateApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return { ok: false, error: "API key should start with 'sk-ant-'." }
  }
  try {
    const client = buildClient(apiKey)
    await client.models.list({ limit: 1 })
    return { ok: true }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Invalid API key." }
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `API error: ${err.message}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/* ------------------------------------------------------------------
 * The agent loop — streaming tool use with prompt caching.
 *
 * Callback signature is intentionally chunky so the UI can render
 * a single assistant message that mutates as the model thinks +
 * dispatches tools + emits text. This avoids React having to
 * reconcile a list-of-messages where each turn might spawn N
 * intermediate states.
 * ------------------------------------------------------------------ */

export type RunAssistantOptions = {
  /** The user's BYO Anthropic key. Must start with sk-ant-. */
  apiKey: string
  /** Model to use (defaults to Sonnet 4.6). */
  model?: AssistantModel
  /** Full conversation so far, including the freshly added user message. */
  history: MessageParam[]
  /** Optional abort signal — lets the UI cancel an in-flight stream. */
  signal?: AbortSignal
  /** Callbacks driving the UI. */
  onTextDelta: (delta: string) => void
  onToolStart: (info: { name: string }) => void
  onToolEnd: (info: { name: string; result: string; isError: boolean }) => void
  onIterationUsage: (usage: AssistantUsage) => void
}

export type RunAssistantResult = {
  /** Final assistant content blocks (what to append to history). */
  finalAssistantContent: ContentBlock[]
  /** All tool results emitted during the loop, in the form the API
   *  expects on the next user turn. Empty if no tools were used. */
  toolResultsForHistory: ContentBlockParam[]
  /** Aggregated usage across every API call in the loop. */
  totalUsage: AssistantUsage
}

const MAX_ITERATIONS = 8 // safety stop — should never reach this in normal use

export async function runAssistantTurn(
  options: RunAssistantOptions,
): Promise<RunAssistantResult> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    history,
    signal,
    onTextDelta,
    onToolStart,
    onToolEnd,
    onIterationUsage,
  } = options

  const client = buildClient(apiKey)

  // Build the cached system prompt. We use the structured form
  // (array of text blocks) so we can attach cache_control to the
  // final block — the entire system prompt becomes a single cache
  // breakpoint, and tools (which render before system) ride along.
  const system: TextBlockParam[] = [
    {
      type: "text",
      text: getSystemPrompt(),
      cache_control: { type: "ephemeral" },
    },
  ]

  // Mark the tool list as cached too. Tools render before system in
  // the API, so a breakpoint on the LAST tool definition caches the
  // entire tool block. With 13 tools rarely changing, this is a clean
  // ~30KB cacheable prefix.
  const tools: Tool[] = ASSISTANT_TOOLS.map((tool, idx, arr) =>
    idx === arr.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" } }
      : tool,
  )

  // Working copy of the conversation. We append to this in-loop as
  // tools come back so subsequent iterations see the full state.
  const messages: MessageParam[] = [...history]
  const allToolResultsForHistory: ContentBlockParam[] = []
  let totalUsage: AssistantUsage = { ...ZERO_USAGE }
  let finalAssistantContent: ContentBlock[] = []

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (signal?.aborted) {
      throw new Error("Aborted by user.")
    }

    const stream = client.messages.stream({
      model,
      max_tokens: 4096, // chat-sized; raise if we want long-form output
      system,
      tools,
      thinking: { type: "adaptive" }, // Sonnet 4.6 supports adaptive
      messages,
    })

    // Stream text deltas live to the UI. We use the SDK's typed
    // event helpers — `.on("text", ...)` gives us just the delta.
    stream.on("text", (delta) => {
      onTextDelta(delta)
    })

    // finalMessage() resolves with the complete Message object once
    // the stream ends, including tool_use blocks + usage. This is
    // the SDK pattern from the skill docs (don't hand-roll Promise).
    const message = await stream.finalMessage()

    const iterUsage: AssistantUsage = {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
    }
    totalUsage = addUsage(totalUsage, iterUsage)
    onIterationUsage(iterUsage)

    // Append the assistant's full content to the working history so
    // the next iteration sees the tool_use blocks. This is required
    // even when we stop here — the API needs the assistant turn to
    // be present in the messages array.
    messages.push({ role: "assistant", content: message.content })
    finalAssistantContent = message.content

    if (message.stop_reason === "end_turn") {
      // Normal completion — model is done.
      return {
        finalAssistantContent,
        toolResultsForHistory: allToolResultsForHistory,
        totalUsage,
      }
    }

    if (message.stop_reason === "tool_use") {
      // Execute every tool_use block, then loop with results.
      const toolResultBlocks: ToolResultBlockParam[] = []
      for (const block of message.content) {
        if (block.type !== "tool_use") continue
        onToolStart({ name: block.name })
        const result = await executeAssistantTool(block.name, block.input)
        onToolEnd({ name: block.name, result: result.content, isError: result.isError })
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.content,
          is_error: result.isError,
        })
      }
      // The next user message contains all tool results in one block.
      messages.push({ role: "user", content: toolResultBlocks })
      // Track this for the calling code's persistent history.
      allToolResultsForHistory.push(...toolResultBlocks)
      continue
    }

    if (message.stop_reason === "max_tokens") {
      // Output truncated. Surface what we have; calling code can decide.
      return {
        finalAssistantContent,
        toolResultsForHistory: allToolResultsForHistory,
        totalUsage,
      }
    }

    if (message.stop_reason === "refusal") {
      return {
        finalAssistantContent,
        toolResultsForHistory: allToolResultsForHistory,
        totalUsage,
      }
    }

    // Any other stop_reason — break the loop to avoid infinite spin.
    break
  }

  // If we exit the loop without an explicit return, the loop hit
  // MAX_ITERATIONS or an unrecognised stop_reason. Return what we have.
  return {
    finalAssistantContent,
    toolResultsForHistory: allToolResultsForHistory,
    totalUsage,
  }
}

/* ------------------------------------------------------------------
 * Local-storage helpers for BYO-key persistence.
 *
 * Keep the API isolated from window/localStorage access so the
 * component can keep the actual side effects in one spot.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "assistant.anthropic-key"
const MODEL_STORAGE_KEY = "assistant.model"

export function readStoredApiKey(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredApiKey(key: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (key == null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, key)
  } catch {
    /* noop — storage may be disabled */
  }
}

export function readStoredModel(): AssistantModel {
  if (typeof window === "undefined") return DEFAULT_MODEL
  try {
    const v = window.localStorage.getItem(MODEL_STORAGE_KEY)
    if (v === "claude-sonnet-4-6" || v === "claude-haiku-4-5" || v === "claude-opus-4-7") {
      return v
    }
    return DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

export function writeStoredModel(model: AssistantModel): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model)
  } catch {
    /* noop */
  }
}
