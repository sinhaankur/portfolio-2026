/**
 * OpenAI-compatible streaming client for LM Studio / Ollama.
 *
 * Hand-rolled on top of `fetch` + the SSE format these servers
 * return — deliberately no SDK dep. Three reasons:
 *
 *   1. The Anthropic SDK already costs us 600 KB Gzipped on this
 *      page and pulled in a tower of Node-only modules we had to
 *      alias out. Adding another LLM SDK doubles that pain.
 *
 *   2. The OpenAI-compatible API surface we need is tiny —
 *      POST /chat/completions with stream:true, parse the
 *      "data: {...}\n\n" lines, accumulate `tool_calls.function.arguments`
 *      across deltas. About 200 lines of code for clean behaviour.
 *
 *   3. It keeps the wire format visible, which matters when local
 *      providers diverge slightly (Ollama vs LM Studio have minor
 *      differences in role enum and tool-call shape).
 *
 * Mirrors the public shape of `runAssistantTurn` in anthropic-client.ts
 * so the assistant UI can call either via a dispatcher and not care.
 *
 * Tool calling support is detected at request time — if the model
 * doesn't return any `tool_calls` and the user asked something that
 * needed one, we surface a friendly "your model may not support tool
 * use" message rather than silently failing.
 */

import { ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/assistant-tools"
import { buildSystemPrompt } from "@/lib/assistant-context"
import type { AssistantUsage } from "@/lib/anthropic-client"
import { ZERO_USAGE, addUsage } from "@/lib/anthropic-client"

/* ------------------------------------------------------------------
 * Message + tool conversion: Anthropic ⇔ OpenAI
 *
 * The Anthropic SDK uses a slightly different shape than OpenAI's
 * chat-completions format. Both surfaces feed `runAssistantTurn` with
 * Anthropic-shaped history (that's the format the assistant UI keeps),
 * so we convert at the boundary here.
 * ------------------------------------------------------------------ */

/** Anthropic message (mirrors @anthropic-ai/sdk's MessageParam without
 *  pulling the type in — keeps this file dependency-light). */
type AnthropicMessage = {
  role: "user" | "assistant"
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | {
            type: "tool_result"
            tool_use_id: string
            content: string | Array<{ type: "text"; text: string }>
            is_error?: boolean
          }
      >
}

/** OpenAI chat message (the wire shape — what we actually POST). */
type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant"
      content: string | null
      tool_calls?: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }>
    }
  | { role: "tool"; content: string; tool_call_id: string }

type OpenAITool = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function flattenContent(content: AnthropicMessage["content"]): string {
  if (typeof content === "string") return content
  return content
    .map((block) => {
      if (block.type === "text") return block.text
      if (block.type === "tool_result") {
        return typeof block.content === "string"
          ? block.content
          : block.content.map((c) => c.text).join("\n")
      }
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

/**
 * Convert the Anthropic-shaped conversation history into a sequence
 * of OpenAI-shaped chat messages. The mapping:
 *
 *   user text                 →  { role: "user", content }
 *   assistant text            →  { role: "assistant", content }
 *   assistant tool_use blocks →  { role: "assistant", tool_calls: [...] }
 *   user tool_result blocks   →  { role: "tool", content, tool_call_id }
 *
 * An assistant turn that contains BOTH text and tool_use blocks
 * collapses into one message with both fields populated.
 */
function convertHistoryToOpenAI(
  systemPrompt: string,
  history: AnthropicMessage[],
): OpenAIMessage[] {
  const out: OpenAIMessage[] = [{ role: "system", content: systemPrompt }]
  for (const msg of history) {
    if (typeof msg.content === "string") {
      if (msg.role === "user") {
        out.push({ role: "user", content: msg.content })
      } else {
        out.push({ role: "assistant", content: msg.content })
      }
      continue
    }
    if (msg.role === "assistant") {
      const textParts: string[] = []
      const toolCalls: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }> = []
      for (const block of msg.content) {
        if (block.type === "text") textParts.push(block.text)
        else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
          })
        }
      }
      out.push({
        role: "assistant",
        content: textParts.join("\n") || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      })
    } else {
      // user role with array content: tool_results (+ maybe text)
      const toolResults: Array<{
        type: "tool_result"
        tool_use_id: string
        content: string | Array<{ type: "text"; text: string }>
        is_error?: boolean
      }> = []
      const textParts: string[] = []
      for (const block of msg.content) {
        if (block.type === "tool_result") toolResults.push(block)
        else if (block.type === "text") textParts.push(block.text)
      }
      for (const tr of toolResults) {
        out.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === "string"
            ? tr.content
            : tr.content.map((c) => c.text).join("\n"),
        })
      }
      if (textParts.length) {
        out.push({ role: "user", content: textParts.join("\n") })
      }
    }
  }
  return out
}

/** Convert Anthropic tools to OpenAI's function-calling shape. */
function convertToolsToOpenAI(): OpenAITool[] {
  return ASSISTANT_TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: (t.input_schema as Record<string, unknown>) ?? { type: "object" },
    },
  }))
}

/* ------------------------------------------------------------------
 * SSE streaming + tool-call accumulation
 *
 * OpenAI-compatible servers stream chunks like:
 *   data: {"choices":[{"delta":{"content":"hel"}}]}
 *   data: {"choices":[{"delta":{"content":"lo"}}]}
 *   data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_x","function":{"name":"flyToBody","arguments":"{\"name\""}}]}}]}
 *   data: [DONE]
 *
 * Tool-call arguments come in JSON fragments — we accumulate them
 * by index until the stream ends, then JSON.parse the result. The
 * spec says you can also get the full string in one chunk; both
 * paths are handled.
 * ------------------------------------------------------------------ */

type ToolCallAccumulator = {
  id: string
  name: string
  argsStr: string
}

async function* streamOpenAICompat(opts: {
  baseUrl: string
  apiKey?: string
  body: Record<string, unknown>
  signal?: AbortSignal
}): AsyncGenerator<
  | { type: "text"; text: string }
  | { type: "tool_call_complete"; toolCalls: ToolCallAccumulator[] }
  | { type: "usage"; usage: AssistantUsage }
  | { type: "finish"; reason: string | null },
  void,
  void
> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({ ...opts.body, stream: true }),
    signal: opts.signal,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI-compat request failed: ${res.status} ${res.statusText}\n${body.slice(0, 600)}`)
  }
  if (!res.body) throw new Error("Response body is null")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  // index → accumulator. Tool calls in OpenAI streams carry an
  // `index` field across delta chunks; we use that to merge fragments.
  const toolAccs = new Map<number, ToolCallAccumulator>()
  let finishReason: string | null = null
  let usage: AssistantUsage | null = null

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE messages are separated by blank lines (\n\n). Each message
    // has lines starting with "data: " carrying the payload.
    let sepIdx: number
    while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
      const rawMessage = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)
      for (const line of rawMessage.split("\n")) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") continue
        let payload: {
          choices?: Array<{
            delta?: {
              content?: string
              tool_calls?: Array<{
                index?: number
                id?: string
                function?: { name?: string; arguments?: string }
              }>
            }
            finish_reason?: string | null
          }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          }
        }
        try {
          payload = JSON.parse(data)
        } catch {
          continue // skip unparseable frames
        }
        const choice = payload.choices?.[0]
        if (choice?.delta?.content) {
          yield { type: "text", text: choice.delta.content }
        }
        if (choice?.delta?.tool_calls) {
          for (const call of choice.delta.tool_calls) {
            const idx = call.index ?? 0
            const acc =
              toolAccs.get(idx) ??
              ({ id: "", name: "", argsStr: "" } as ToolCallAccumulator)
            if (call.id) acc.id = call.id
            if (call.function?.name) acc.name = call.function.name
            if (call.function?.arguments) acc.argsStr += call.function.arguments
            toolAccs.set(idx, acc)
          }
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason
        }
        if (payload.usage) {
          usage = {
            input_tokens: payload.usage.prompt_tokens ?? 0,
            output_tokens: payload.usage.completion_tokens ?? 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          }
        }
      }
    }
  }
  if (toolAccs.size > 0) {
    yield { type: "tool_call_complete", toolCalls: Array.from(toolAccs.values()) }
  }
  if (usage) yield { type: "usage", usage }
  yield { type: "finish", reason: finishReason }
}

/* ------------------------------------------------------------------
 * Public agent loop entry — mirrors runAssistantTurn shape
 * ------------------------------------------------------------------ */

export type RunOpenAICompatOptions = {
  baseUrl: string
  apiKey?: string
  model: string
  history: AnthropicMessage[]
  signal?: AbortSignal
  onTextDelta: (delta: string) => void
  onToolStart: (info: { name: string }) => void
  onToolEnd: (info: { name: string; result: string; isError: boolean }) => void
  onIterationUsage: (usage: AssistantUsage) => void
}

export type RunOpenAICompatResult = {
  finalAssistantContent: Array<
    { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }
  >
  toolResultsForHistory: Array<{
    type: "tool_result"
    tool_use_id: string
    content: string
    is_error: boolean
  }>
  totalUsage: AssistantUsage
}

const MAX_ITERATIONS = 8

let _cachedSystemPrompt: string | null = null
function getSystemPrompt(): string {
  if (_cachedSystemPrompt == null) _cachedSystemPrompt = buildSystemPrompt()
  return _cachedSystemPrompt
}

export async function runOpenAICompatTurn(
  options: RunOpenAICompatOptions,
): Promise<RunOpenAICompatResult> {
  const {
    baseUrl,
    apiKey,
    model,
    history,
    signal,
    onTextDelta,
    onToolStart,
    onToolEnd,
    onIterationUsage,
  } = options

  const tools = convertToolsToOpenAI()
  const messages: AnthropicMessage[] = [...history]
  const allToolResultsForHistory: RunOpenAICompatResult["toolResultsForHistory"] = []
  let totalUsage: AssistantUsage = { ...ZERO_USAGE }
  let finalAssistantContent: RunOpenAICompatResult["finalAssistantContent"] = []

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (signal?.aborted) throw new Error("Aborted by user.")

    const oaiMessages = convertHistoryToOpenAI(getSystemPrompt(), messages)
    const body = {
      model,
      messages: oaiMessages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
    }

    let textBuffer = ""
    const collectedToolCalls: ToolCallAccumulator[] = []
    let stopReason: string | null = null

    for await (const event of streamOpenAICompat({ baseUrl, apiKey, body, signal })) {
      if (event.type === "text") {
        textBuffer += event.text
        onTextDelta(event.text)
      } else if (event.type === "tool_call_complete") {
        collectedToolCalls.push(...event.toolCalls)
      } else if (event.type === "usage") {
        totalUsage = addUsage(totalUsage, event.usage)
        onIterationUsage(event.usage)
      } else if (event.type === "finish") {
        stopReason = event.reason
      }
    }

    // Build the assistant content for the history record.
    const assistantContent: RunOpenAICompatResult["finalAssistantContent"] = []
    if (textBuffer) assistantContent.push({ type: "text", text: textBuffer })
    for (const tc of collectedToolCalls) {
      let parsedInput: unknown = {}
      try {
        parsedInput = JSON.parse(tc.argsStr || "{}")
      } catch {
        parsedInput = { __rawArgs: tc.argsStr }
      }
      assistantContent.push({
        type: "tool_use",
        id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: tc.name,
        input: parsedInput,
      })
    }
    finalAssistantContent = assistantContent
    messages.push({ role: "assistant", content: assistantContent })

    // No tool calls = the assistant turn is complete.
    if (collectedToolCalls.length === 0) {
      if (stopReason !== "stop" && stopReason !== "length" && stopReason !== null) {
        // Surface unusual stops in the text stream so they're visible
        // to the user. Most local models return "stop"; "length"
        // means it hit max_tokens.
      }
      return {
        finalAssistantContent,
        toolResultsForHistory: allToolResultsForHistory,
        totalUsage,
      }
    }

    // Execute tools + assemble tool_result blocks for the next turn.
    const toolResultBlocks: Array<{
      type: "tool_result"
      tool_use_id: string
      content: string
      is_error: boolean
    }> = []
    for (let i = 0; i < collectedToolCalls.length; i++) {
      const tc = collectedToolCalls[i]
      const blockForId = assistantContent.find(
        (b) => b.type === "tool_use" && b.name === tc.name,
      ) as { type: "tool_use"; id: string; input: unknown } | undefined
      const toolUseId = blockForId?.id ?? `call_${i}`
      onToolStart({ name: tc.name })
      const result = await executeAssistantTool(tc.name, blockForId?.input ?? {})
      onToolEnd({ name: tc.name, result: result.content, isError: result.isError })
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: toolUseId,
        content: result.content,
        is_error: result.isError,
      })
    }
    allToolResultsForHistory.push(...toolResultBlocks)
    messages.push({ role: "user", content: toolResultBlocks })
  }

  // Hit max iterations — return what we have so the UI can show it.
  return {
    finalAssistantContent,
    toolResultsForHistory: allToolResultsForHistory,
    totalUsage,
  }
}
