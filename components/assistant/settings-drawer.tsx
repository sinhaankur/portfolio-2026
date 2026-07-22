"use client"

/**
 * Settings drawer — provider selector + per-provider config + session cost.
 *
 * Three providers supported:
 *   Anthropic (cloud)   — BYO API key, billed to the visitor's Anthropic Console.
 *   LM Studio (local)   — OpenAI-compatible endpoint on localhost:1234.
 *   Ollama (local)      — OpenAI-compatible endpoint on localhost:11434.
 *
 * Local providers cost nothing but require the visitor to have the
 * server running on their machine. We surface that prerequisite
 * inline (and CORS hint for Ollama specifically — needs OLLAMA_ORIGINS=*
 * or it'll fail with a Failed-to-fetch).
 */

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Eye, EyeOff, ExternalLink, X, Check, AlertTriangle } from "lucide-react"
import {
  type AnthropicModelId,
  detectLocalLLMProviders,
  type LocalProviderDetection,
  type LLMProviderId,
  PROVIDER_LABELS,
  PROVIDER_DEFAULTS,
  readActiveProvider,
  readAnthropicKey,
  readAnthropicModel,
  readLmStudioConfig,
  readOllamaConfig,
  readWebLLMModel,
  validateProviderConfig,
  writeActiveProvider,
  writeAnthropicKey,
  writeAnthropicModel,
  writeLmStudioConfig,
  writeOllamaConfig,
  writeWebLLMModel,
} from "@/lib/llm-provider"
import { WEBLLM_MODEL_LABELS, isWebGPUAvailable } from "@/lib/webllm-engine"

const ANTHROPIC_MODELS: Array<{
  value: AnthropicModelId
  label: string
  blurb: string
  pricePer1k: string
}> = [
  {
    value: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    blurb: "Recommended — balanced reasoning + cost.",
    pricePer1k: "$0.003 / $0.015 per 1K tokens",
  },
  {
    value: "claude-haiku-4-5",
    label: "Haiku 4.5",
    blurb: "Fastest + cheapest. Good for quick lookups.",
    pricePer1k: "$0.001 / $0.005 per 1K tokens",
  },
  {
    value: "claude-opus-4-7",
    label: "Opus 4.7",
    blurb: "Deepest reasoning. Spendy.",
    pricePer1k: "$0.005 / $0.025 per 1K tokens",
  },
]

type SettingsDrawerProps = {
  open: boolean
  onClose: () => void
  onConfigChange: () => void
  /** Optional session-cost display. When omitted, the "This session"
   *  panel is hidden — useful for surfaces (like the Usability Engine)
   *  where the work isn't measured in chat-turns. */
  sessionCostUSD?: number
  sessionTokens?: { input: number; output: number; cached: number }
  /** Optional heading override. Default reads as a generic
   *  "LLM provider · settings"; the Assistant overrides to
   *  "Assistant · settings" so the surface origin is unambiguous. */
  heading?: string
}

export function SettingsDrawer({
  open,
  onClose,
  onConfigChange,
  sessionCostUSD,
  sessionTokens,
  heading = "LLM provider · settings",
}: SettingsDrawerProps) {
  const showSessionUsage =
    sessionTokens != null &&
    (sessionTokens.input > 0 || sessionTokens.output > 0 || sessionTokens.cached > 0)
  const prefersReducedMotion = useReducedMotion()

  // Live provider + per-provider config state.
  const [provider, setProvider] = useState<LLMProviderId>("anthropic")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [anthropicModel, setAnthropicModel] = useState<AnthropicModelId>(
    "claude-sonnet-4-6",
  )
  const [lmstudioBase, setLmstudioBase] = useState(PROVIDER_DEFAULTS.lmstudio.baseUrl)
  const [lmstudioModel, setLmstudioModel] = useState("")
  const [ollamaBase, setOllamaBase] = useState(PROVIDER_DEFAULTS.ollama.baseUrl)
  const [ollamaModel, setOllamaModel] = useState("")
  const [webllmModel, setWebllmModel] = useState(PROVIDER_DEFAULTS.webllm.model)
  const [webllmProgress, setWebllmProgress] = useState<{ progress: number; text: string } | null>(null)
  const [webgpuOk, setWebgpuOk] = useState<boolean | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<"idle" | "validating" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [localDetection, setLocalDetection] = useState<LocalProviderDetection | null>(null)
  const [detectingLocal, setDetectingLocal] = useState(false)
  const [localDetectError, setLocalDetectError] = useState<string | null>(null)

  const runLocalDetection = useCallback(async () => {
    setDetectingLocal(true)
    setLocalDetectError(null)
    try {
      const result = await detectLocalLLMProviders()
      setLocalDetection(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setLocalDetectError(msg)
      setLocalDetection(null)
    } finally {
      setDetectingLocal(false)
    }
  }, [])

  const applyDetectedEndpoint = useCallback(
    (kind: "lmstudio" | "ollama", baseUrl: string, models: string[]) => {
      setProvider(kind)
      setStatus("idle")
      setErrorMsg(null)
      if (kind === "lmstudio") {
        setLmstudioBase(baseUrl)
        setLmstudioModel((prev) => prev || models[0] || "")
      } else {
        setOllamaBase(baseUrl)
        setOllamaModel((prev) => prev || models[0] || "")
      }
      setAvailableModels(models)
    },
    [],
  )

  // Hydrate from localStorage when the drawer opens. We re-read each
  // open so external changes (another tab clearing, etc.) reflect.
  useEffect(() => {
    if (!open) return
    setProvider(readActiveProvider())
    setAnthropicKey(readAnthropicKey() ?? "")
    setAnthropicModel(readAnthropicModel())
    const lm = readLmStudioConfig()
    setLmstudioBase(lm.baseUrl)
    setLmstudioModel(lm.model)
    const ol = readOllamaConfig()
    setOllamaBase(ol.baseUrl)
    setOllamaModel(ol.model)
    setWebllmModel(readWebLLMModel())
    setWebgpuOk(isWebGPUAvailable())
    setStatus("idle")
    setErrorMsg(null)
    setAvailableModels([])
    // NO auto-scan on open. The drawer auto-opens for first-time visitors
    // (no key configured), so scanning here port-probed localhost on every
    // fresh page load — console errors for all, and against the house rule
    // that nothing acts without explicit user action. The Scan button does it.
  }, [open])

  /* ------------------------------------------------------------ */
  /* Save handlers — one per provider so each has its own validate */
  /* ------------------------------------------------------------ */

  // On-device model — save the choice, and (if WebGPU is present) pre-download
  // the model now so the first question isn't a cold ~380 MB wait. Progress
  // streams into webllmProgress; failure degrades to the deterministic path.
  const handleSaveWebLLM = async () => {
    writeWebLLMModel(webllmModel)
    writeActiveProvider("webllm")
    onConfigChange()
    if (!isWebGPUAvailable()) {
      setStatus("saved")
      setErrorMsg("Saved. This browser has no WebGPU, so answers come straight from the catalog (still works — no model download).")
      return
    }
    setStatus("validating")
    setErrorMsg(null)
    setWebllmProgress({ progress: 0, text: "Starting…" })
    try {
      const { getWebLLMEngine } = await import("@/lib/webllm-engine")
      await getWebLLMEngine(webllmModel, (p) => setWebllmProgress(p))
      setStatus("saved")
      setWebllmProgress({ progress: 1, text: "Ready — running on your device." })
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Model failed to load.")
      setWebllmProgress(null)
    }
  }

  const handleSaveAnthropic = async () => {
    const trimmed = anthropicKey.trim()
    if (!trimmed) {
      writeAnthropicKey(null)
      writeActiveProvider("anthropic")
      writeAnthropicModel(anthropicModel)
      setStatus("saved")
      setErrorMsg(null)
      onConfigChange()
      return
    }
    setStatus("validating")
    setErrorMsg(null)
    const result = await validateProviderConfig({
      provider: "anthropic",
      apiKey: trimmed,
      model: anthropicModel,
    })
    if (result.ok) {
      writeAnthropicKey(trimmed)
      writeAnthropicModel(anthropicModel)
      writeActiveProvider("anthropic")
      setStatus("saved")
      onConfigChange()
    } else {
      setStatus("error")
      setErrorMsg(result.error)
    }
  }

  const handleSaveLocal = async (kind: "lmstudio" | "ollama") => {
    const base = (kind === "lmstudio" ? lmstudioBase : ollamaBase).trim()
    const model = (kind === "lmstudio" ? lmstudioModel : ollamaModel).trim()
    if (!base) {
      setStatus("error")
      setErrorMsg("Base URL is required.")
      return
    }
    setStatus("validating")
    setErrorMsg(null)
    const result = await validateProviderConfig({
      provider: kind,
      baseUrl: base,
      model: model || "(any)",
    })
    if (result.ok) {
      if (kind === "lmstudio") writeLmStudioConfig({ baseUrl: base, model })
      else writeOllamaConfig({ baseUrl: base, model })
      writeActiveProvider(kind)
      setStatus("saved")
      setAvailableModels(result.models ?? [])
      onConfigChange()
    } else {
      setStatus("error")
      setErrorMsg(result.error)
      setAvailableModels([])
    }
  }

  const handleClear = () => {
    writeAnthropicKey(null)
    setAnthropicKey("")
    setStatus("saved")
    onConfigChange()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-settings-heading"
            initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%", opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="
              fixed top-0 right-0 bottom-0 z-50
              w-full sm:w-105 max-w-full
              bg-card border-l border-border
              flex flex-col overflow-hidden
            "
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2
                id="assistant-settings-heading"
                className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground"
              >
                {heading}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close settings"
                className="
                  inline-flex items-center justify-center
                  w-9 h-9 rounded-full
                  text-muted-foreground hover:text-foreground hover:bg-secondary
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
              {/* Provider selector */}
              <section>
                <h3 className="font-display text-lg font-light mb-1.5">Provider</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Pick how the assistant talks to a language model. Cloud
                  costs API credits; local costs only electricity but
                  requires the model server running on this machine.
                </p>
                <div className="space-y-2">
                  {(["webllm", "anthropic", "lmstudio", "ollama"] as LLMProviderId[]).map((p) => (
                    <label
                      key={p}
                      className={`
                        block rounded-md border p-3 cursor-pointer transition-colors
                        ${provider === p ? "border-accent bg-accent/5" : "border-border/70 hover:border-border"}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="assistant-provider"
                          checked={provider === p}
                          onChange={() => setProvider(p)}
                          className="accent-accent w-4 h-4"
                        />
                        <div>
                          <div className="font-medium text-foreground">{PROVIDER_LABELS[p]}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p === "webllm"
                              ? "Runs in your browser — no key, no server, nothing leaves your device. One-time model download."
                              : p === "anthropic"
                                ? "Most capable. BYO Claude API key."
                                : p === "lmstudio"
                                  ? "OpenAI-compatible endpoint on localhost:1234."
                                  : "OpenAI-compatible endpoint on localhost:11434. Needs OLLAMA_ORIGINS=*."}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-4 rounded-md border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                      Local runtime detection
                    </p>
                    <button
                      type="button"
                      onClick={() => void runLocalDetection()}
                      disabled={detectingLocal}
                      className="px-3 py-1.5 rounded-full border border-border/70 text-[10px] font-mono tracking-[0.16em] uppercase text-foreground/80 hover:border-accent disabled:opacity-50 transition-colors"
                    >
                      {detectingLocal ? "Scanning..." : localDetection ? "Rescan" : "Scan"}
                    </button>
                  </div>

                  {localDetectError && (
                    <p className="mt-2 text-xs text-destructive">{localDetectError}</p>
                  )}

                  {localDetection && (
                    <div className="mt-3 space-y-2 text-xs">
                      <DetectionRow
                        name="LM Studio"
                        details={`${localDetection.lmstudio.baseUrl}${localDetection.lmstudio.models.length ? ` · ${localDetection.lmstudio.models.length} models` : ""}`}
                        reachable={localDetection.lmstudio.reachable}
                        actionLabel="Use"
                        onAction={() =>
                          applyDetectedEndpoint(
                            "lmstudio",
                            localDetection.lmstudio.baseUrl,
                            localDetection.lmstudio.models,
                          )
                        }
                      />
                      <DetectionRow
                        name="Ollama"
                        details={`${localDetection.ollama.baseUrl}${localDetection.ollama.models.length ? ` · ${localDetection.ollama.models.length} models` : ""}`}
                        reachable={localDetection.ollama.reachable}
                        actionLabel="Use"
                        onAction={() =>
                          applyDetectedEndpoint(
                            "ollama",
                            localDetection.ollama.baseUrl,
                            localDetection.ollama.models,
                          )
                        }
                      />

                      {localDetection.compatible
                        .filter((entry) => entry.reachable)
                        .slice(0, 3)
                        .map((entry) => (
                          <DetectionRow
                            key={entry.baseUrl}
                            name="OpenAI-compatible"
                            details={`${entry.baseUrl}${entry.models.length ? ` · ${entry.models.length} models` : ""}`}
                            reachable={entry.reachable}
                            actionLabel="Use"
                            onAction={() =>
                              applyDetectedEndpoint("lmstudio", entry.baseUrl, entry.models)
                            }
                          />
                        ))}
                    </div>
                  )}

                  <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed">
                    Detects LM Studio, Ollama, and common OpenAI-compatible local endpoints (including TinyLLM-style localhost runtimes).
                  </p>
                </div>
              </section>

              {/* Per-provider config */}
              {provider === "webllm" && (
                <WebLLMConfig
                  model={webllmModel}
                  onModelChange={setWebllmModel}
                  onSave={handleSaveWebLLM}
                  status={status}
                  errorMsg={errorMsg}
                  progress={webllmProgress}
                  webgpuOk={webgpuOk}
                />
              )}
              {provider === "anthropic" && (
                <AnthropicConfig
                  apiKey={anthropicKey}
                  onApiKeyChange={setAnthropicKey}
                  showKey={showKey}
                  onShowKeyChange={setShowKey}
                  model={anthropicModel}
                  onModelChange={setAnthropicModel}
                  onSave={handleSaveAnthropic}
                  onClear={handleClear}
                  status={status}
                  errorMsg={errorMsg}
                  hasKey={!!anthropicKey}
                />
              )}
              {provider === "lmstudio" && (
                <LocalConfig
                  label="LM Studio"
                  helpText="Start LM Studio (or any OpenAI-compatible local server), load a model with tool-calling support (Llama 3.1+, Qwen 2.5+), and start the API server. CORS must allow this origin."
                  baseUrl={lmstudioBase}
                  onBaseUrlChange={setLmstudioBase}
                  model={lmstudioModel}
                  onModelChange={setLmstudioModel}
                  onSave={() => handleSaveLocal("lmstudio")}
                  status={status}
                  errorMsg={errorMsg}
                  availableModels={availableModels}
                  modelPlaceholder="e.g. llama-3.1-8b-instruct"
                />
              )}
              {provider === "ollama" && (
                <LocalConfig
                  label="Ollama"
                  helpText="Start Ollama with OLLAMA_ORIGINS=* so the browser can reach it. `ollama pull llama3.1` (or qwen2.5 - both support tool use)."
                  baseUrl={ollamaBase}
                  onBaseUrlChange={setOllamaBase}
                  model={ollamaModel}
                  onModelChange={setOllamaModel}
                  onSave={() => handleSaveLocal("ollama")}
                  status={status}
                  errorMsg={errorMsg}
                  availableModels={availableModels}
                  modelPlaceholder="e.g. llama3.1:latest"
                />
              )}

              {/* Session usage — only renders when the caller passed
                  non-zero tokens AND the provider is Anthropic (local
                  providers don't charge by token). The Usability
                  Engine omits sessionTokens entirely so the panel
                  doesn't show on its surface. */}
              {provider === "anthropic" && showSessionUsage && sessionTokens && (
                <section>
                  <h3 className="font-display text-lg font-light mb-1.5">This session</h3>
                  <div className="rounded-md border border-border/70 p-3 font-mono text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Input tokens</span>
                      <span className="text-foreground tabular-nums">
                        {sessionTokens.input.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output tokens</span>
                      <span className="text-foreground tabular-nums">
                        {sessionTokens.output.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cached (10× cheaper)</span>
                      <span className="text-foreground tabular-nums">
                        {sessionTokens.cached.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 mt-1 border-t border-border/60">
                      <span>Estimated cost</span>
                      <span className="text-foreground tabular-nums">
                        ${(sessionCostUSD ?? 0).toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground/80 leading-relaxed">
                    Resets when you refresh the page. Final billing on your Anthropic Console.
                  </p>
                </section>
              )}

              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Provider config lives only in this browser's localStorage. The
                assistant talks to the chosen endpoint directly — no server
                proxy on Ankur's side.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DetectionRow({
  name,
  details,
  reachable,
  actionLabel,
  onAction,
}: {
  name: string
  details: string
  reachable: boolean
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-foreground/90 truncate">{name}</p>
        <p className="text-muted-foreground truncate">{details}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${reachable ? "bg-emerald-500" : "bg-muted"}`}
          aria-hidden="true"
        />
        {reachable && (
          <button
            type="button"
            onClick={onAction}
            className="px-2.5 py-1 rounded border border-border/70 text-[10px] font-mono tracking-[0.14em] uppercase hover:border-accent transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------
 * Sub-blocks — kept inline for readability over splitting per-file
 * ---------------------------------------------------------------- */

function WebLLMConfig({
  model,
  onModelChange,
  onSave,
  status,
  errorMsg,
  progress,
  webgpuOk,
}: {
  model: string
  onModelChange: (v: string) => void
  onSave: () => Promise<void>
  status: "idle" | "validating" | "saved" | "error"
  errorMsg: string | null
  progress: { progress: number; text: string } | null
  webgpuOk: boolean | null
}) {
  const pct = progress ? Math.round(progress.progress * 100) : 0
  return (
    <section>
      <h3 className="font-display text-lg font-light mb-1.5">On-device model</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        A small language model runs entirely in your browser — no API key, no
        server, nothing leaves your device. The model downloads once (then it&apos;s
        cached). Navigation and facts always work; the model just phrases answers.
      </p>

      {webgpuOk === false && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground font-medium">No WebGPU here.</strong>
          <p className="mt-1.5">
            This browser can&apos;t run the on-device model (try Chrome or Edge). The
            assistant still answers from the real catalogue — just without free-form
            phrasing. No download happens.
          </p>
        </div>
      )}

      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 block">
          Model
        </span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(WEBLLM_MODEL_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onModelChange(id)}
              className={`
                font-mono text-[10px] px-2.5 py-1.5 rounded border transition-colors
                ${model === id ? "border-accent bg-accent/5 text-foreground" : "border-border/70 hover:border-accent text-muted-foreground hover:text-foreground"}
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </label>

      {progress && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground truncate">
            {pct}% · {progress.text}
          </p>
        </div>
      )}

      <div className="mt-4">
        <SaveButton
          onClick={onSave}
          disabled={status === "validating"}
          status={status}
        />
        {status === "validating" && (
          <span className="ml-3 text-xs text-muted-foreground">Downloading + loading the model…</span>
        )}
      </div>
      <StatusLine status={status} errorMsg={errorMsg} />
    </section>
  )
}

function AnthropicConfig({
  apiKey,
  onApiKeyChange,
  showKey,
  onShowKeyChange,
  model,
  onModelChange,
  onSave,
  onClear,
  status,
  errorMsg,
  hasKey,
}: {
  apiKey: string
  onApiKeyChange: (v: string) => void
  showKey: boolean
  onShowKeyChange: (v: boolean) => void
  model: AnthropicModelId
  onModelChange: (v: AnthropicModelId) => void
  onSave: () => Promise<void>
  onClear: () => void
  status: "idle" | "validating" | "saved" | "error"
  errorMsg: string | null
  hasKey: boolean
}) {
  return (
    <>
      <section>
        <h3 className="font-display text-lg font-light mb-1.5">Anthropic API key</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Bring your own key. Stored only in this browser; requests go directly
          to api.anthropic.com from your machine.
        </p>
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 block">
            Key
          </span>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              spellCheck={false}
              className="
                w-full bg-transparent border border-border rounded-md
                px-3 py-3 pr-11 font-mono text-base md:text-sm text-foreground
                placeholder:text-muted-foreground/50
                focus:outline-none focus:border-accent transition-colors min-h-11
              "
            />
            <button
              type="button"
              onClick={() => onShowKeyChange(!showKey)}
              aria-label={showKey ? "Hide key" : "Show key"}
              className="
                absolute right-1 top-1/2 -translate-y-1/2
                w-9 h-9 inline-flex items-center justify-center
                text-muted-foreground hover:text-foreground rounded
              "
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </label>
        <div className="mt-3 flex items-center gap-2">
          <SaveButton onClick={onSave} disabled={status === "validating"} status={status} />
          {hasKey && <ClearButton onClick={onClear} />}
        </div>
        <StatusLine status={status} errorMsg={errorMsg} />
        <ConsoleHint />
      </section>

      <section>
        <h3 className="font-display text-lg font-light mb-1.5">Model</h3>
        <div className="space-y-2">
          {ANTHROPIC_MODELS.map((opt) => (
            <label
              key={opt.value}
              className={`
                block rounded-md border p-3 cursor-pointer transition-colors
                ${model === opt.value ? "border-accent bg-accent/5" : "border-border/70 hover:border-border"}
              `}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="anthropic-model"
                  checked={model === opt.value}
                  onChange={() => onModelChange(opt.value)}
                  className="accent-accent w-4 h-4"
                />
                <div>
                  <div className="font-medium text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.blurb}</div>
                </div>
              </div>
              <p className="font-mono text-[10px] tracking-wide text-muted-foreground/80 mt-2 pl-7">
                {opt.pricePer1k}
              </p>
            </label>
          ))}
        </div>
      </section>
    </>
  )
}

function LocalConfig({
  label,
  helpText,
  baseUrl,
  onBaseUrlChange,
  model,
  onModelChange,
  onSave,
  status,
  errorMsg,
  availableModels,
  modelPlaceholder,
}: {
  label: string
  helpText: string
  baseUrl: string
  onBaseUrlChange: (v: string) => void
  model: string
  onModelChange: (v: string) => void
  onSave: () => Promise<void>
  status: "idle" | "validating" | "saved" | "error"
  errorMsg: string | null
  availableModels: string[]
  modelPlaceholder: string
}) {
  return (
    <section>
      <h3 className="font-display text-lg font-light mb-1.5">{label}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{helpText}</p>

      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 block">
          Base URL
        </span>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          spellCheck={false}
          className="
            w-full bg-transparent border border-border rounded-md
            px-3 py-3 font-mono text-base md:text-sm text-foreground
            focus:outline-none focus:border-accent transition-colors min-h-11
          "
        />
      </label>

      <label className="block mt-4">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 block">
          Model
        </span>
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={modelPlaceholder}
          spellCheck={false}
          autoComplete="off"
          className="
            w-full bg-transparent border border-border rounded-md
            px-3 py-3 font-mono text-base md:text-sm text-foreground
            placeholder:text-muted-foreground/50
            focus:outline-none focus:border-accent transition-colors min-h-11
          "
        />
        {availableModels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableModels.slice(0, 8).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModelChange(m)}
                className="
                  font-mono text-[10px] px-2 py-1 rounded
                  border border-border/70 hover:border-accent
                  text-muted-foreground hover:text-foreground transition-colors
                "
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </label>

      <div className="mt-3">
        <SaveButton onClick={onSave} disabled={status === "validating"} status={status} />
      </div>
      <StatusLine status={status} errorMsg={errorMsg} />

      <div className="mt-5 rounded-md border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground font-medium">Note on tool use</strong>
        <p className="mt-1.5">
          The assistant needs the model to support function-calling for camera
          control. Llama 3.1+, Qwen 2.5+, and Mistral Large all do. Older /
          smaller models may chat correctly but won&apos;t move the camera.
        </p>
      </div>
    </section>
  )
}

function SaveButton({
  onClick,
  disabled,
  status,
}: {
  onClick: () => void | Promise<void>
  disabled: boolean
  status: "idle" | "validating" | "saved" | "error"
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        px-5 py-2.5 rounded-full
        font-mono text-[11px] tracking-[0.2em] uppercase
        bg-foreground text-background
        hover:bg-accent hover:text-accent-foreground
        disabled:opacity-40 transition-colors min-h-11
      "
    >
      {status === "validating" ? "Validating…" : "Save"}
    </button>
  )
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        px-5 py-2.5 rounded-full border border-border
        font-mono text-[11px] tracking-[0.2em] uppercase
        text-muted-foreground hover:text-foreground
        transition-colors min-h-11
      "
    >
      Clear
    </button>
  )
}

function StatusLine({
  status,
  errorMsg,
}: {
  status: "idle" | "validating" | "saved" | "error"
  errorMsg: string | null
}) {
  if (status === "saved") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
        <Check className="w-3 h-3" /> Saved
      </p>
    )
  }
  if (status === "error" && errorMsg) {
    return (
      <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-destructive leading-relaxed">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{errorMsg}</span>
      </p>
    )
  }
  return null
}

function ConsoleHint() {
  return (
    <div className="mt-5 rounded-md border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <p className="mb-2">
        <strong className="text-foreground font-medium">Why do I need this?</strong>
      </p>
      <p>
        The site is statically exported — there&apos;s no server to proxy through.
        Your key authorizes calls directly to api.anthropic.com from your browser.
      </p>
      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1.5 text-foreground hover:text-accent transition-colors"
      >
        Get a key from Anthropic Console
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}
