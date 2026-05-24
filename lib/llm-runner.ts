/**
 * Simple text-in / text-out LLM runner.
 *
 * The Assistant runtime in lib/assistant-runtime.ts is a streaming
 * agentic loop with tool use — appropriate for chat. The Usability
 * Engine needs something simpler: send one prompt, get one answer,
 * use it. No tools, no multi-turn, no streaming.
 *
 * This module dispatches that simpler call against the same active
 * provider config the Assistant uses (Anthropic / LM Studio / Ollama).
 * Same provider toggle in settings, two different shapes of work.
 */

import type { ProviderConfig } from "@/lib/llm-provider"
import { readActiveConfig } from "@/lib/llm-provider"

export type RunTextOptions = {
  /** Optional override; otherwise resolved from localStorage via
   *  readActiveConfig(). Returns an error result if no provider is
   *  configured. */
  config?: ProviderConfig
  /** System-style instructions framing the task. */
  system: string
  /** The user's actual request. */
  prompt: string
  /** Per-call budget — local models often need a smaller value to
   *  stay fast; cloud models default higher. */
  maxTokens?: number
  /** Lower → more deterministic. The Usability Engine wants judgement
   *  consistency, not creativity; 0.3 is a sensible default. */
  temperature?: number
  /** Optional abort signal. */
  signal?: AbortSignal
}

export type RunTextResult =
  | { ok: true; text: string; tokensIn: number; tokensOut: number }
  | { ok: false; error: string }

/* ------------------------------------------------------------------
 * Anthropic path — uses the SDK so we get the same auth + caching
 * we already wired up for the Assistant.
 * ------------------------------------------------------------------ */

async function runViaAnthropic(
  cfg: Extract<ProviderConfig, { provider: "anthropic" }>,
  opts: RunTextOptions,
): Promise<RunTextResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true })
  try {
    const message = await client.messages.create(
      {
        model: cfg.model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      },
      { signal: opts.signal },
    )
    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
    return {
      ok: true,
      text,
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/* ------------------------------------------------------------------
 * OpenAI-compatible path — fetch against LM Studio / Ollama.
 * Non-streaming (`stream: false`) since the Usability Engine doesn't
 * need token-by-token rendering; it needs a verdict.
 * ------------------------------------------------------------------ */

async function runViaOpenAICompat(
  cfg: Extract<ProviderConfig, { provider: "lmstudio" | "ollama" }>,
  opts: RunTextOptions,
): Promise<RunTextResult> {
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      signal: opts.signal,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.3,
        stream: false,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return {
        ok: false,
        error: `${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`,
      }
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const text = json.choices?.[0]?.message?.content ?? ""
    return {
      ok: true,
      text,
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: msg.includes("Failed to fetch") || msg.includes("NetworkError")
        ? `Couldn't reach ${cfg.baseUrl}. Make sure the server is running + CORS is enabled.`
        : msg,
    }
  }
}

/* ------------------------------------------------------------------
 * Public entry
 * ------------------------------------------------------------------ */

export async function runText(opts: RunTextOptions): Promise<RunTextResult> {
  const cfg = opts.config ?? readActiveConfig()
  if (!cfg) {
    return {
      ok: false,
      error: "No LLM provider configured. Open the LLM settings to set one up.",
    }
  }
  if (cfg.provider === "anthropic") return runViaAnthropic(cfg, opts)
  return runViaOpenAICompat(cfg, opts)
}
