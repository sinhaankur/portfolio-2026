"use client"

/**
 * Settings drawer — BYO-key flow + model selector + session cost.
 *
 * Sit alongside the chat panel. When the user has no key, the chat
 * is locked and a prominent CTA opens this drawer. Once the key is
 * stored, the drawer collapses to a small gear icon.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Eye, EyeOff, ExternalLink, X } from "lucide-react"
import {
  type AssistantModel,
  DEFAULT_MODEL,
  validateApiKey,
} from "@/lib/anthropic-client"

const MODEL_OPTIONS: Array<{
  value: AssistantModel
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
  apiKey: string | null
  onSaveKey: (key: string | null) => Promise<void> | void
  model: AssistantModel
  onModelChange: (model: AssistantModel) => void
  sessionCostUSD: number
  sessionTokens: { input: number; output: number; cached: number }
}

export function SettingsDrawer({
  open,
  onClose,
  apiKey,
  onSaveKey,
  model,
  onModelChange,
  sessionCostUSD,
  sessionTokens,
}: SettingsDrawerProps) {
  const prefersReducedMotion = useReducedMotion()
  const [keyDraft, setKeyDraft] = useState(apiKey ?? "")
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<"idle" | "validating" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Refresh draft when the drawer opens fresh, in case the stored
  // key changed elsewhere (e.g. cleared from another tab).
  useEffect(() => {
    if (open) {
      setKeyDraft(apiKey ?? "")
      setStatus("idle")
      setErrorMsg(null)
    }
  }, [open, apiKey])

  const handleSave = async () => {
    const trimmed = keyDraft.trim()
    if (!trimmed) {
      // Empty = clear key
      await onSaveKey(null)
      setStatus("saved")
      setErrorMsg(null)
      return
    }
    setStatus("validating")
    setErrorMsg(null)
    const result = await validateApiKey(trimmed)
    if (result.ok) {
      await onSaveKey(trimmed)
      setStatus("saved")
    } else {
      setStatus("error")
      setErrorMsg(result.error)
    }
  }

  const handleClear = async () => {
    await onSaveKey(null)
    setKeyDraft("")
    setStatus("saved")
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
              w-full sm:w-[420px] max-w-full
              bg-card border-l border-border
              flex flex-col
              overflow-hidden
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
                  text-muted-foreground hover:text-foreground
                  hover:bg-secondary
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
              {/* API key */}
              <section>
                <h3 className="font-display text-lg font-light mb-1.5">
                  Your Anthropic API key
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Bring your own key. It's stored only in this browser
                  (localStorage) and goes directly to Anthropic on every
                  request — no server hop, no logging.
                </p>

                <label className="block">
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 block">
                    Key
                  </span>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      placeholder="sk-ant-..."
                      autoComplete="off"
                      spellCheck={false}
                      className="
                        w-full bg-transparent border border-border rounded-md
                        px-3 py-2.5 pr-10 font-mono text-sm text-foreground
                        placeholder:text-muted-foreground/50
                        focus:outline-none focus:border-accent
                        transition-colors
                      "
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      aria-label={showKey ? "Hide key" : "Show key"}
                      className="
                        absolute right-2 top-1/2 -translate-y-1/2
                        w-7 h-7 inline-flex items-center justify-center
                        text-muted-foreground hover:text-foreground rounded
                      "
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </label>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={status === "validating"}
                    className="
                      px-4 py-2 rounded-full
                      font-mono text-[11px] tracking-[0.2em] uppercase
                      bg-foreground text-background
                      hover:bg-accent hover:text-accent-foreground
                      disabled:opacity-40
                      transition-colors min-h-10
                    "
                  >
                    {status === "validating" ? "Validating…" : "Save"}
                  </button>
                  {apiKey && (
                    <button
                      onClick={handleClear}
                      className="
                        px-4 py-2 rounded-full border border-border
                        font-mono text-[11px] tracking-[0.2em] uppercase
                        text-muted-foreground hover:text-foreground
                        transition-colors min-h-10
                      "
                    >
                      Clear
                    </button>
                  )}
                </div>

                {status === "saved" && (
                  <p className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
                    Saved
                  </p>
                )}
                {status === "error" && errorMsg && (
                  <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
                )}

                <div className="mt-5 rounded-md border border-border/70 bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  <p className="mb-2">
                    <strong className="text-foreground font-medium">Why do I need this?</strong>
                  </p>
                  <p>
                    This site is a static export — there's no server to proxy through.
                    Your key authorizes calls to api.anthropic.com directly from your browser.
                    Charges land on your Anthropic Console.
                  </p>
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="
                      mt-3 inline-flex items-center gap-1.5
                      text-foreground hover:text-accent
                      transition-colors
                    "
                  >
                    Get a key from Anthropic Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </section>

              {/* Model selector */}
              <section>
                <h3 className="font-display text-lg font-light mb-1.5">Model</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Sonnet 4.6 is the recommended default — best balance of
                  reasoning and cost for tool-using chat.
                </p>
                <div className="space-y-2">
                  {MODEL_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`
                        block rounded-md border p-3 cursor-pointer
                        transition-colors
                        ${
                          model === opt.value
                            ? "border-accent bg-accent/5"
                            : "border-border/70 hover:border-border"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="assistant-model"
                            checked={model === opt.value}
                            onChange={() => onModelChange(opt.value)}
                            className="accent-accent w-4 h-4"
                          />
                          <div>
                            <div className="font-medium text-foreground">{opt.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{opt.blurb}</div>
                          </div>
                        </div>
                      </div>
                      <p className="font-mono text-[10px] tracking-wide text-muted-foreground/80 mt-2 pl-7">
                        {opt.pricePer1k}
                      </p>
                    </label>
                  ))}
                </div>
              </section>

              {/* Session usage */}
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

              {/* Footer note */}
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Default falls back to Claude Sonnet 4.6, adaptive thinking on,
                prompt-caching enabled (system + tool definitions cached
                between turns at ~10% of input cost).
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

// Re-export the default for convenience.
export { DEFAULT_MODEL }
