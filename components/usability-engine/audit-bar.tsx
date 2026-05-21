"use client"

/**
 * AuditBar — top-of-engine bar where the user pastes a URL to start
 * (or resume) an audit. Once a URL is set, the bar collapses into a
 * compact score readout and the heuristic cards switch into vote mode.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ExternalLink, X } from "lucide-react"
import { normalizeUrl, useAuditSession } from "./use-audit-session"
import type { AuditVerdict, Heuristic } from "./types"

export function AuditBar({
  heuristics,
  audit,
}: {
  heuristics: Heuristic[]
  audit: ReturnType<typeof useAuditSession>
}) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState<string>("")

  useEffect(() => {
    if (audit.isActive) {
      try {
        setHost(new URL(audit.session.url).host)
      } catch {
        setHost(audit.session.url)
      }
    } else {
      setHost("")
    }
  }, [audit.isActive, audit.session.url])

  const totals = countVerdicts(heuristics, audit.session.verdicts)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = normalizeUrl(draft)
    if (!result.ok) {
      setError("That doesn't look like a URL. Try example.com")
      return
    }
    setError(null)
    audit.start(result.url)
    setDraft("")
  }

  if (audit.isActive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-20 md:top-24 z-30 mb-10 md:mb-12"
      >
        <div className="bg-card border border-border rounded-xl shadow-lg shadow-black/5 px-4 py-3 md:px-5 md:py-4">
          <div className="flex flex-wrap items-center gap-3 md:gap-5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground shrink-0">
                Auditing
              </span>
              <a
                href={audit.session.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-mono text-xs md:text-sm text-foreground hover:text-accent transition-colors truncate"
              >
                <span className="truncate">{host}</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            </div>

            <div className="flex items-center gap-3 md:gap-4 font-mono text-[11px] tracking-wider">
              <Score label="✓" value={totals.pass} tone="good" />
              <Score label="✕" value={totals.fail} tone="bad" />
              <Score label="–" value={totals.skip} tone="muted" />
              <span className="text-foreground/40">/</span>
              <span className="text-foreground/70">{heuristics.length}</span>
            </div>

            <button
              type="button"
              onClick={audit.clear}
              className="
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                border border-border bg-background
                font-mono text-[10px] tracking-widest uppercase
                text-muted-foreground hover:text-foreground hover:border-accent/60
                transition-colors
              "
            >
              <X className="w-3 h-3" aria-hidden="true" />
              End audit
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Idle — show the URL input prompt.
  return (
    <div className="mb-12 md:mb-16 border border-border rounded-xl bg-card p-6 md:p-8">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-3">
        Audit mode
      </p>
      <h3 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] mb-3">
        Paste a URL. Walk the catalog. Get a report.
      </h3>
      <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl mb-6">
        Open your site (or anyone's) in another tab. Work through each
        heuristic with it in front of you, tap{" "}
        <span className="font-mono text-foreground">✓ Pass</span>,{" "}
        <span className="font-mono text-foreground">✕ Fail</span>, or{" "}
        <span className="font-mono text-foreground">– Skip</span> on each card,
        and the engine builds a structured report at the bottom of the page.
        Your verdicts are saved locally so you can come back to finish later.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-2xl">
        <div className="flex-1">
          <label htmlFor="audit-url" className="sr-only">
            URL to audit
          </label>
          <input
            id="audit-url"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(null)
            }}
            placeholder="example.com — or paste a full https:// URL"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            className="
              w-full px-4 py-2.5 border border-border rounded-md
              bg-background font-mono text-sm
              focus:outline-none focus:border-foreground
              transition-colors
            "
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "audit-url-error" : undefined}
          />
        </div>
        <button
          type="submit"
          className="
            px-5 py-2.5 rounded-md
            bg-accent text-accent-foreground border border-accent
            hover:bg-accent/90 transition-colors
            font-mono text-xs tracking-[0.25em] uppercase
            min-h-11
          "
        >
          Start audit →
        </button>
      </form>
      <AnimatePresence>
        {error && (
          <motion.p
            id="audit-url-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 font-mono text-[11px] tracking-wider text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Score({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "muted" }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        ${tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : "text-foreground/55"}
      `}
    >
      <span aria-hidden="true" className="font-mono text-xs">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </span>
  )
}

export function countVerdicts(
  heuristics: Heuristic[],
  verdicts: Record<string, AuditVerdict>,
) {
  let pass = 0,
    fail = 0,
    skip = 0
  for (const h of heuristics) {
    const v = verdicts[h.id]
    if (v === "pass") pass++
    else if (v === "fail") fail++
    else if (v === "skip") skip++
  }
  return { pass, fail, skip, unanswered: heuristics.length - pass - fail - skip }
}
