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

export type LLMProviderId = "webllm" | "anthropic" | "lmstudio" | "ollama"

export const PROVIDER_LABELS: Record<LLMProviderId, string> = {
  webllm: "On-device (in-browser)",
  anthropic: "Anthropic (cloud)",
  lmstudio: "LM Studio (local)",
  ollama: "Ollama (local)",
}

export const PROVIDER_DEFAULTS: Record<LLMProviderId, { baseUrl: string; model: string }> = {
  // In-browser tiny model — no server, so baseUrl is unused; model is an MLC id.
  webllm: { baseUrl: "", model: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" },
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" },
  lmstudio: { baseUrl: "http://localhost:1234/v1", model: "" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "" },
}

/**
 * Per-provider configuration the runtime needs to actually fire a
 * request. For Anthropic, the key + model. For local providers, the
 * base URL + model. For webllm, just the on-device model id (no network).
 */
export type ProviderConfig =
  | {
      provider: "webllm"
      model: string
    }
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
  webllmModel: "assistant.webllm-model",
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
  if (v === "webllm" || v === "anthropic" || v === "lmstudio" || v === "ollama") return v
  // Default to the on-device model so the assistant works for everyone with no
  // key + no setup. (Falls back to deterministic tools if WebGPU is absent.)
  return "webllm"
}

export function readWebLLMModel(): string {
  return read(STORAGE_KEYS.webllmModel) ?? PROVIDER_DEFAULTS.webllm.model
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
  if (provider === "webllm") {
    // No key/URL to validate — the model runs in the browser. WebGPU support is
    // checked at call time (the runtime falls back to deterministic tools).
    return { provider, model: readWebLLMModel() }
  }
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

export function writeWebLLMModel(model: string): void {
  write(STORAGE_KEYS.webllmModel, model)
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

export type LocalEndpointProbe = {
  label: string
  baseUrl: string
  reachable: boolean
  models: string[]
  error?: string
}

export type LocalProviderDetection = {
  lmstudio: LocalEndpointProbe
  ollama: LocalEndpointProbe
  compatible: LocalEndpointProbe[]
}

const COMMON_OPENAI_COMPAT_BASE_URLS = [
  "http://localhost:8000/v1",
  "http://127.0.0.1:8000/v1",
  "http://localhost:8080/v1",
  "http://127.0.0.1:8080/v1",
]

async function probeOpenAICompatEndpoint(
  label: string,
  baseUrl: string,
  timeoutMs = 2200,
): Promise<LocalEndpointProbe> {
  if (typeof window === "undefined") {
    return {
      label,
      baseUrl,
      reachable: false,
      models: [],
      error: "Detection is available in the browser only.",
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      signal: controller.signal,
    })
    if (!res.ok) {
      return {
        label,
        baseUrl,
        reachable: false,
        models: [],
        error: `${res.status} ${res.statusText}`,
      }
    }
    const body = await res.json()
    const models = Array.isArray(body?.data)
      ? body.data
        .map((m: { id?: string }) => m.id)
        .filter((id?: string): id is string => Boolean(id))
      : []
    return {
      label,
      baseUrl,
      reachable: true,
      models,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      label,
      baseUrl,
      reachable: false,
      models: [],
      error:
        msg.includes("aborted") || msg.includes("AbortError")
          ? "Timeout"
          : msg,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function detectLocalLLMProviders(): Promise<LocalProviderDetection> {
  const [lmstudio, ollama, ...compatibles] = await Promise.all([
    probeOpenAICompatEndpoint("LM Studio", PROVIDER_DEFAULTS.lmstudio.baseUrl),
    probeOpenAICompatEndpoint("Ollama", PROVIDER_DEFAULTS.ollama.baseUrl),
    ...COMMON_OPENAI_COMPAT_BASE_URLS.map((url) =>
      probeOpenAICompatEndpoint("OpenAI-compatible", url),
    ),
  ])

  const taken = new Set([
    PROVIDER_DEFAULTS.lmstudio.baseUrl.replace(/\/$/, ""),
    PROVIDER_DEFAULTS.ollama.baseUrl.replace(/\/$/, ""),
  ])

  return {
    lmstudio,
    ollama,
    compatible: compatibles.filter((entry) => {
      const normalized = entry.baseUrl.replace(/\/$/, "")
      return !taken.has(normalized)
    }),
  }
}

export async function validateProviderConfig(
  cfg: ProviderConfig,
): Promise<ValidationResult> {
  if (cfg.provider === "webllm") {
    // No server + no key to validate; the model runs in the browser. Just
    // report whether the device can run it (WebGPU).
    const { isWebGPUAvailable } = await import("@/lib/webllm-engine")
    return isWebGPUAvailable()
      ? { ok: true, models: [cfg.model] }
      : { ok: false, error: "This browser has no WebGPU — the on-device model can't run here. The assistant will still answer from the catalog." }
  }
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
