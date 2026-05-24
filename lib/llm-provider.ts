/**
 * Shared LLM-provider layer.
 *
 * The portfolio currently has two surfaces that call out to an LLM:
 *
 *   1. Universe Engine Assistant (lab/universe-assistant) — chat +
 *      tool use against the engine's dataset.
 *
 *   2. Usability Engine (/usability) — automatable heuristic audits
 *      that can be run against arbitrary inputs.
 *
 * Both should share the same "which model do I want to use?" UX: pick
 * a provider (Anthropic with a key, LM Studio running locally, or
 * Ollama running locally), configure it once, and let either surface
 * use it. That's what this module gives them.
 *
 * Storage shape (localStorage):
 *
 *   assistant.provider              — "anthropic" | "lmstudio" | "ollama"
 *   assistant.anthropic-key         — sk-ant-...
 *   assistant.anthropic-model       — claude-sonnet-4-6 | etc.
 *   assistant.lmstudio-base-url     — http://localhost:1234/v1
 *   assistant.lmstudio-model        — model identifier reported by LM Studio
 *   assistant.ollama-base-url       — http://localhost:11434/v1
 *   assistant.ollama-model          — model name (e.g. "llama3.2:latest")
 *
 * The browser is the only place these values live; we never round-
 * trip them to any server we control.
 */

export type LLMProviderId = "anthropic" | "lmstudio" | "ollama"

export const PROVIDER_LABELS: Record<LLMProviderId, string> = {
  anthropic: "Anthropic (cloud)",
  lmstudio: "LM Studio (local)",
  ollama: "Ollama (local)",
}

export const PROVIDER_DEFAULTS: Record<LLMProviderId, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" },
  lmstudio: { baseUrl: "http://localhost:1234/v1", model: "" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "" },
}

/**
 * Per-provider configuration the runtime needs to actually fire a
 * request. For Anthropic, the key + model. For local providers, the
 * base URL + model.
 */
export type ProviderConfig =
  | {
      provider: "anthropic"
      apiKey: string
      model: "claude-sonnet-4-6" | "claude-haiku-4-5" | "claude-opus-4-7"
    }
  | {
      provider: "lmstudio" | "ollama"
      baseUrl: string
      model: string
      apiKey?: string
    }

/* ------------------------------------------------------------------
 * localStorage adapters — small, no-deps wrappers that gracefully
 * fall back when storage is unavailable (Safari private browsing,
 * old browsers, server-rendered first paint).
 * ------------------------------------------------------------------ */

const STORAGE_KEYS = {
  provider: "assistant.provider",
  anthropicKey: "assistant.anthropic-key",
  anthropicModel: "assistant.model",
  lmstudioBaseUrl: "assistant.lmstudio-base-url",
  lmstudioModel: "assistant.lmstudio-model",
  ollamaBaseUrl: "assistant.ollama-base-url",
  ollamaModel: "assistant.ollama-model",
} as const

function read(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* noop — storage may be disabled */
  }
}

/* ------------------------------------------------------------------
 * Public reads
 * ------------------------------------------------------------------ */

export function readActiveProvider(): LLMProviderId {
  const v = read(STORAGE_KEYS.provider)
  if (v === "anthropic" || v === "lmstudio" || v === "ollama") return v
  return "anthropic"
}

export function readAnthropicKey(): string | null {
  return read(STORAGE_KEYS.anthropicKey)
}

export type AnthropicModelId =
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "claude-opus-4-7"

export function readAnthropicModel(): AnthropicModelId {
  // Direct union narrow — ProviderConfig["model"] degrades to `string`
  // through the union variant where model is a free-form local name.
  const v = read(STORAGE_KEYS.anthropicModel)
  if (v === "claude-sonnet-4-6" || v === "claude-haiku-4-5" || v === "claude-opus-4-7") {
    return v
  }
  return "claude-sonnet-4-6"
}

export function readLmStudioConfig(): { baseUrl: string; model: string } {
  return {
    baseUrl: read(STORAGE_KEYS.lmstudioBaseUrl) ?? PROVIDER_DEFAULTS.lmstudio.baseUrl,
    model: read(STORAGE_KEYS.lmstudioModel) ?? "",
  }
}

export function readOllamaConfig(): { baseUrl: string; model: string } {
  return {
    baseUrl: read(STORAGE_KEYS.ollamaBaseUrl) ?? PROVIDER_DEFAULTS.ollama.baseUrl,
    model: read(STORAGE_KEYS.ollamaModel) ?? "",
  }
}

/**
 * Assemble the fully-resolved config for whichever provider is active.
 * Returns null if the active provider isn't configured enough to
 * actually fire a request — that's the UI's signal to show "set up
 * your provider" instead of letting the user try and fail.
 */
export function readActiveConfig(): ProviderConfig | null {
  const provider = readActiveProvider()
  if (provider === "anthropic") {
    const apiKey = readAnthropicKey()
    if (!apiKey) return null
    return { provider, apiKey, model: readAnthropicModel() }
  }
  const c = provider === "lmstudio" ? readLmStudioConfig() : readOllamaConfig()
  if (!c.baseUrl || !c.model) return null
  return { provider, ...c }
}

/* ------------------------------------------------------------------
 * Public writes
 * ------------------------------------------------------------------ */

export function writeActiveProvider(p: LLMProviderId): void {
  write(STORAGE_KEYS.provider, p)
}

export function writeAnthropicKey(key: string | null): void {
  write(STORAGE_KEYS.anthropicKey, key)
}

export function writeAnthropicModel(m: ProviderConfig["model"]): void {
  write(STORAGE_KEYS.anthropicModel, m)
}

export function writeLmStudioConfig(c: { baseUrl: string; model: string }): void {
  write(STORAGE_KEYS.lmstudioBaseUrl, c.baseUrl)
  write(STORAGE_KEYS.lmstudioModel, c.model)
}

export function writeOllamaConfig(c: { baseUrl: string; model: string }): void {
  write(STORAGE_KEYS.ollamaBaseUrl, c.baseUrl)
  write(STORAGE_KEYS.ollamaModel, c.model)
}

/* ------------------------------------------------------------------
 * Provider validation
 *
 * Quick connectivity check per provider — the UI uses this to give
 * a "saved + ready" confirmation, and to surface CORS / connection
 * failures before the user tries a real query.
 * ------------------------------------------------------------------ */

export type ValidationResult =
  | { ok: true; models?: string[] }
  | { ok: false; error: string }

export async function validateProviderConfig(
  cfg: ProviderConfig,
): Promise<ValidationResult> {
  if (cfg.provider === "anthropic") {
    // Imported lazily so we don't pull the Anthropic SDK into pages
    // that don't need it.
    const { validateApiKey } = await import("@/lib/anthropic-client")
    return validateApiKey(cfg.apiKey)
  }
  // LM Studio + Ollama both serve a GET /models endpoint at the
  // base URL. We use that to (a) verify the server is reachable and
  // (b) list models so the UI can show what's actually loaded.
  try {
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/models`
    const res = await fetch(url, {
      headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
    })
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 0
            ? `Couldn't reach ${cfg.baseUrl}. Is the server running + CORS enabled?`
            : `Server returned ${res.status}: ${res.statusText}`,
      }
    }
    const body = await res.json()
    const models = Array.isArray(body?.data)
      ? body.data.map((m: { id?: string }) => m.id).filter((id?: string): id is string => !!id)
      : []
    return { ok: true, models }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: msg.includes("Failed to fetch") || msg.includes("NetworkError")
        ? `Couldn't reach ${cfg.baseUrl}. Make sure the server is running and CORS is enabled (Ollama: OLLAMA_ORIGINS=*).`
        : msg,
    }
  }
}
