/**
 * In-browser tiny-LLM engine — runs a small language model entirely on the
 * visitor's device via WebGPU (MLC WebLLM). No API key, no server, no cloud:
 * the whole point is that the Universe Assistant works for everyone out of the
 * box, on-device, matching the portfolio's privacy-first ethos.
 *
 * Cost model: the library + WASM are lazy-loaded (dynamic import, kept out of
 * the main bundle), and the MODEL weights (~300 MB–1 GB) stream from the MLC
 * CDN on first use and are cached by the browser thereafter. WebGPU is required
 * (Chrome/Edge, Safari TP) — callers must gate on `isWebGPUAvailable()` and fall
 * back to the deterministic tools where it isn't.
 *
 * One shared engine instance per tab (model load is expensive); we hand back a
 * ready MLCEngine the assistant runtime drives via the OpenAI-compatible API.
 */

/** The default tiny model — smallest download, runs on modest laptops. The
 *  assistant works WITHOUT any model (deterministic path), so the default stays
 *  small; the labels below guide users who want stronger phrasing to a 1B model. */
export const DEFAULT_WEBLLM_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"

/** The recommended "better answers" model — bigger download, noticeably nicer
 *  prose while still fully on-device. Surfaced in the settings picker. */
export const QUALITY_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC"

export const WEBLLM_MODEL_LABELS: Record<string, string> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "Qwen2.5 0.5B · ~380 MB · fastest, smallest",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "Llama 3.2 1B · ~880 MB · better answers",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC": "Qwen2.5 1.5B · ~1.1 GB · best (needs a strong GPU)",
}

/** Feature-detect WebGPU without importing the heavy library. */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator
}

export type WebLLMProgress = {
  /** 0..1 overall load progress. */
  progress: number
  /** Human text, e.g. "Fetching param cache[12/38]…". */
  text: string
}

// Minimal shape of the MLCEngine we depend on (keeps this file import-light).
export interface WebLLMEngine {
  chat: {
    completions: {
      create: (req: {
        messages: { role: string; content: string }[]
        temperature?: number
        max_tokens?: number
        stream?: boolean
      }) => Promise<{ choices: { message: { content: string | null } }[] }>
    }
  }
}

let enginePromise: Promise<WebLLMEngine> | null = null
let loadedModel: string | null = null

/**
 * Get (or lazily create) the shared in-browser engine for `model`. Reuses the
 * instance across calls; re-inits only if the requested model changed. Reports
 * download/compile progress via `onProgress`. Throws if WebGPU is unavailable.
 */
export async function getWebLLMEngine(
  model: string = DEFAULT_WEBLLM_MODEL,
  onProgress?: (p: WebLLMProgress) => void,
): Promise<WebLLMEngine> {
  if (!isWebGPUAvailable()) {
    throw new Error("WebGPU is not available in this browser.")
  }
  if (enginePromise && loadedModel === model) return enginePromise

  loadedModel = model
  enginePromise = (async () => {
    // Lazy-load the library so its WASM never touches the initial page bundle.
    const webllm = await import("@mlc-ai/web-llm")
    const engine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: (report: { progress: number; text: string }) => {
        onProgress?.({ progress: report.progress ?? 0, text: report.text ?? "" })
      },
    })
    return engine as unknown as WebLLMEngine
  })()

  return enginePromise
}

/** True once the engine for the current model has finished loading. */
export function isWebLLMReady(model: string = DEFAULT_WEBLLM_MODEL): boolean {
  return loadedModel === model && enginePromise !== null
}
