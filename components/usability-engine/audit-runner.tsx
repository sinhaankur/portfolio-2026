"use client"

/**
 * AuditRunner — per-heuristic LLM audit panel.
 *
 * Renders inside a HeuristicCard's expanded fix-disclosure, but only
 * for heuristics marked LLM-checkable or hybrid. Sends a structured
 * prompt to the active LLM provider (Anthropic / LM Studio / Ollama)
 * containing:
 *
 *   - the heuristic's claim + audit question + automation spec
 *   - the user-supplied audit target (typically pasted HTML, copy, or
 *     a screenshot description)
 *
 * Asks the model to return a structured verdict: pass / fail / partial,
 * plus a short reasoning. Renders the result inline.
 *
 * Local-LLM aware — uses the same provider config the Universe Engine
 * Assistant uses (lib/llm-provider.ts). No separate setup; whatever's
 * configured for the Assistant works here too.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, AlertTriangle, CheckCircle2, XCircle, MinusCircle, Sparkles } from "lucide-react"
import type { Heuristic } from "./types"
import { runText } from "@/lib/llm-runner"
import { readActiveConfig } from "@/lib/llm-provider"

type Verdict = "pass" | "fail" | "partial" | "unknown"

type AuditResponse = {
  verdict: Verdict
  reasoning: string
  raw: string
}

function buildPrompt(heuristic: Heuristic, target: string): string {
  return `You are auditing a UI surface against a single usability heuristic.

Heuristic ${heuristic.number}: "${heuristic.title}"
Claim: ${heuristic.claim}

Self-audit question:
${heuristic.auditQuestion}

What automated checks of this heuristic actually look at:
${heuristic.automationSpec}

User-supplied surface to audit (HTML excerpt, copy, screenshot description, or component text):
"""
${target}
"""

Return exactly this format, no preamble:

VERDICT: pass | fail | partial | unknown
REASONING: <2-4 short sentences, concrete and specific. Quote the offending text or affordance verbatim when you can. If the surface doesn't give you enough context to judge, say so and ask for the missing piece.>`
}

function parseResponse(raw: string): AuditResponse {
  const trimmed = raw.trim()
  // Verdict line
  const verdictMatch = trimmed.match(/^VERDICT\s*:\s*(pass|fail|partial|unknown)/im)
  const verdict = (verdictMatch?.[1]?.toLowerCase() ?? "unknown") as Verdict
  // Reasoning — everything after REASONING:, fallback to whole body
  const reasoningMatch = trimmed.match(/REASONING\s*:\s*([\s\S]+)$/im)
  const reasoning = (reasoningMatch?.[1] ?? trimmed).trim()
  return { verdict, reasoning, raw: trimmed }
}

const VERDICT_TONE: Record<Verdict, { dot: string; label: string; Icon: typeof CheckCircle2 }> = {
  pass: { dot: "text-emerald-600 dark:text-emerald-400", label: "Pass", Icon: CheckCircle2 },
  fail: { dot: "text-red-600 dark:text-red-400", label: "Fail", Icon: XCircle },
  partial: { dot: "text-amber-600 dark:text-amber-400", label: "Partial", Icon: MinusCircle },
  unknown: { dot: "text-muted-foreground", label: "Unknown", Icon: MinusCircle },
}

export function AuditRunner({
  heuristic,
  target,
  onOpenProviderSettings,
}: {
  heuristic: Heuristic
  /** What to audit. The engine collects this once at the top + passes
   *  down to each card. Empty = the button is disabled. */
  target: string
  /** Called when the user clicks "Set up LLM" — opens the shared
   *  provider drawer. */
  onOpenProviderSettings: () => void
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AuditResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasProvider, setHasProvider] = useState<boolean | null>(null)

  // Refresh provider availability when the panel mounts / target changes.
  // localStorage doesn't fire events to other components in the same tab,
  // so the cheapest signal we have is "re-check on each render gate".
  useEffect(() => {
    setHasProvider(readActiveConfig() != null)
  }, [target])

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await runText({
        system:
          "You are a senior product designer running a structured usability audit. Be specific, concise, and direct. Never invent details the user didn't include. Return the requested VERDICT + REASONING format exactly.",
        prompt: buildPrompt(heuristic, target),
        maxTokens: 400,
        temperature: 0.2,
      })
      if (!res.ok) {
        setError(res.error)
      } else {
        setResult(parseResponse(res.text))
      }
    } finally {
      setRunning(false)
    }
  }

  const disabled = running || target.trim().length < 8

  return (
    <div className="mt-4 rounded-md bg-foreground/5 border border-border p-3">
      <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/65 mb-2 inline-flex items-center gap-2">
        <Sparkles className="w-3 h-3 text-accent" aria-hidden="true" />
        Run this audit
      </p>

      {hasProvider === false ? (
        <div className="text-sm text-foreground/80 leading-relaxed">
          <p className="mb-3">
            Set up an LLM provider (Anthropic API key, or LM Studio /
            Ollama on your machine) and this audit will run live against
            whatever you paste into the audit target above.
          </p>
          <button
            onClick={onOpenProviderSettings}
            className="
              inline-flex items-center gap-2
              px-4 py-2 rounded-full
              font-mono text-[11px] tracking-[0.2em] uppercase
              bg-foreground text-background hover:bg-accent hover:text-accent-foreground
              transition-colors min-h-11
            "
          >
            Set up LLM
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={disabled}
              className="
                inline-flex items-center gap-2
                px-4 py-2 rounded-full
                font-mono text-[11px] tracking-[0.2em] uppercase
                bg-foreground text-background hover:bg-accent hover:text-accent-foreground
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors min-h-11
              "
            >
              {running ? (
                <>
                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="inline-flex"
                  >
                    <Loader2 className="w-3.5 h-3.5" />
                  </motion.span>
                  Auditing
                </>
              ) : (
                "Run audit"
              )}
            </button>
            {target.trim().length < 8 && (
              <span className="text-[11px] text-muted-foreground">
                Paste something into the audit target above first.
              </span>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-3 rounded-md border border-border/70 bg-background/40 px-3 py-3">
              <p className={`inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase mb-2 ${VERDICT_TONE[result.verdict].dot}`}>
                {(() => {
                  const Icon = VERDICT_TONE[result.verdict].Icon
                  return <Icon className="w-3.5 h-3.5" />
                })()}
                {VERDICT_TONE[result.verdict].label}
              </p>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {result.reasoning}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
