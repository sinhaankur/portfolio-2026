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

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Eye, EyeOff, ExternalLink, X, Check, AlertTriangle } from "lucide-react"
import {
  type AnthropicModelId,
  type LLMProviderId,
  PROVIDER_LABELS,
  PROVIDER_DEFAULTS,
  readActiveProvider,
  readAnthropicKey,
  readAnthropicModel,
  readLmStudioConfig,
  readOllamaConfig,
  validateProviderConfig,
  writeActiveProvider,
  writeAnthropicKey,
  writeAnthropicModel,
  writeLmStudioConfig,
  writeOllamaConfig,
} from "@/lib/llm-provider"

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
  sessionCostUSD: number
  sessionTokens: { input: number; output: number; cached: number }
}

export function SettingsDrawer({
  open,
  onClose,
  onConfigChange,
  sessionCostUSD,
  sessionTokens,
}: SettingsDrawerProps) {
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
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<"idle" | "validating" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [availableModels, setAvailableModels] = useState<string[]>([])

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
    setStatus("idle")
    setErrorMsg(null)
    setAvailableModels([])
  }, [open])

  /* ------------------------------------------------------------ */
  /* Save handlers — one per provider so each has its own validate */
  /* ------------------------------------------------------------ */

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
                Assistant · Settings
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
                  {(["anthropic", "lmstudio", "ollama"] as LLMProviderId[]).map((p) => (
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
                            {p === "anthropic"
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
              </section>

              {/* Per-provider config */}
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
                  helpText="Start LM Studio, load a model with tool-calling support (Llama 3.1+, Qwen 2.5+), and click 'Start Server' under the Developer tab. CORS is enabled by default."
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
                  helpText="Start Ollama with OLLAMA_ORIGINS=* so the browser can reach it. `ollama pull llama3.1` (or qwen2.5 — both support tool use)."
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

              {/* Session usage — only meaningful for Anthropic; local
                  providers don't charge by token. */}
              {provider === "anthropic" && (
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
                        ${sessionCostUSD.toFixed(4)}
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

/* ----------------------------------------------------------------
 * Sub-blocks — kept inline for readability over splitting per-file
 * ---------------------------------------------------------------- */

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
