"use client"

/**
 * Usability Engine — public entry.
 *
 * The Universe-Engine sibling for usability. The user picks a surface
 * kind (website / application / form / mobile-app); the engine filters
 * its heuristics catalog to those relevant to that surface and renders
 * a numbered manifesto of cards. Each card has:
 *   - narrative story (why this heuristic matters)
 *   - severity tier
 *   - interactive good-vs-bad demo (where one is registered)
 *   - self-audit question with a tap-to-reveal fix
 *
 * Authoring surface is `heuristics.ts` (data) and `demos/<name>.tsx`
 * (interactive components). Add rows + demos, the engine picks them up.
 *
 * Module layout:
 *   types.ts            Shared types (Heuristic, DemoKey, etc.)
 *   heuristics.ts       Data catalog
 *   demos/              Interactive demos + a key registry
 *   heuristic-card.tsx  Renders one heuristic
 *   index.tsx           Surface picker + grid composition (this file)
 */

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Settings } from "lucide-react"
import { heuristics } from "./heuristics"
import { HeuristicCard } from "./heuristic-card"
import { AuditBar } from "./audit-bar"
import { AuditSummary } from "./audit-summary"
import { OllamaCallout } from "./ollama-callout"
import { useAuditSession } from "./use-audit-session"
import type { SurfaceKind } from "./types"
import { SettingsDrawer } from "@/components/assistant/settings-drawer"

type Filter = SurfaceKind | "all"

const SURFACES: { key: Filter; label: string; hint: string }[] = [
  { key: "all",         label: "Everything",   hint: "Show all heuristics" },
  { key: "website",     label: "Website",      hint: "Marketing, content, e-commerce" },
  { key: "application", label: "Application",  hint: "Logged-in product, dashboards, agents" },
  { key: "form",        label: "Form",         hint: "Inputs, validation, multi-step flows" },
  { key: "mobile-app",  label: "Mobile",       hint: "Native iOS / Android surfaces" },
]

export function UsabilityEngine() {
  const [filter, setFilter] = useState<Filter>("all")
  const audit = useAuditSession()
  /** What to audit — pasted HTML, copy, or component text. Passed to
   *  each HeuristicCard so the per-card AuditRunner can send it to
   *  the LLM. Empty by default; the audit-runner stays idle until
   *  the visitor pastes something. */
  const [auditTarget, setAuditTarget] = useState("")
  const [llmSettingsOpen, setLlmSettingsOpen] = useState(false)

  const filtered = useMemo(() => {
    if (filter === "all") return heuristics
    return heuristics.filter((h) => h.appliesTo.includes(filter))
  }, [filter])

  // Severity tally for the active filter, so the user can see what kind
  // of risks dominate the surface they're auditing.
  const tally = useMemo(() => {
    return filtered.reduce(
      (acc, h) => {
        acc[h.severity]++
        return acc
      },
      { blocker: 0, major: 0, minor: 0 },
    )
  }, [filtered])

  return (
    <section aria-labelledby="usability-engine-heading" className="relative">
      {/* LLM provider + audit target.
          Audits are now live — paste a UI surface (HTML excerpt, copy,
          component text) into the target box, pick a provider (Anthropic
          cloud / LM Studio / Ollama local), and each LLM-checkable
          heuristic card grows a "Run audit" button. */}
      <div className="mb-10 rounded-lg border border-border bg-card/30 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
            <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground truncate">
              Audit target · live LLM checks
            </h2>
          </div>
          <button
            onClick={() => setLlmSettingsOpen(true)}
            aria-label="LLM provider settings"
            className="
              shrink-0 inline-flex items-center gap-2
              px-3 py-2 rounded-full border border-border
              font-mono text-[10px] tracking-[0.2em] uppercase
              text-muted-foreground hover:text-foreground hover:border-foreground/60
              transition-colors min-h-11
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            "
          >
            <Settings className="w-3.5 h-3.5" />
            LLM
          </button>
        </div>
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2 block">
            Paste a UI surface to audit
          </span>
          <textarea
            value={auditTarget}
            onChange={(e) => setAuditTarget(e.target.value)}
            placeholder="HTML excerpt, copy text, or a description of the surface — e.g. 'Login form: email, password, submit button labeled CONTINUE, no error states visible.'"
            rows={4}
            className="
              w-full resize-y bg-transparent border border-border rounded-md
              px-3 py-3 font-sans text-base md:text-sm text-foreground
              placeholder:text-muted-foreground/55
              focus:outline-none focus:border-accent transition-colors
            "
          />
        </label>
        <p className="mt-2 text-[11px] text-muted-foreground/85 leading-relaxed">
          Anthropic uses your BYO key; LM Studio / Ollama call out to localhost.
          Each LLM-checkable heuristic below grows a "Run audit" button when
          this box has content + a provider is configured.
        </p>
      </div>

      {/* Legacy Ollama-instructional callout — kept collapsed by default
          now that the audits are live, but useful for the "I want to run
          this from a terminal" path. */}
      <OllamaCallout />

      {/* Audit bar — URL input (idle) or active-audit chip (running) */}
      <AuditBar heuristics={filtered} audit={audit} />

      {/* Surface picker */}
      <div className="mb-12 md:mb-16">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
          Audit a surface
        </p>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Surface kind">
          {SURFACES.map((s) => {
            const active = filter === s.key
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(s.key)}
                title={s.hint}
                data-cursor-hover
                className={`
                  px-4 py-2 rounded-full border font-mono text-xs tracking-widest uppercase
                  transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background
                  ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground/80 border-border hover:border-accent/60 hover:text-foreground"
                  }
                `}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Tally — what risks dominate the filtered set */}
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-wider"
        >
          <span className="text-muted-foreground">
            {filtered.length} heuristic{filtered.length === 1 ? "" : "s"} ·
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground/85">
            <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-red-500" />
            {tally.blocker} blocker{tally.blocker === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground/85">
            <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-amber-500" />
            {tally.major} major
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground/85">
            <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {tally.minor} minor
          </span>
        </motion.div>
      </div>

      {/* Heuristic grid — single column, numbered manifesto layout */}
      <AnimatePresence mode="popLayout">
        <motion.ol
          key={filter}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-16 md:space-y-24"
        >
          {filtered.map((h, i) => (
            <li key={h.id}>
              <HeuristicCard
                heuristic={h}
                index={i}
                auditActive={audit.isActive}
                verdict={audit.session.verdicts[h.id] ?? null}
                onVerdict={(v) => audit.setVerdict(h.id, v)}
                auditTarget={auditTarget}
                onOpenProviderSettings={() => setLlmSettingsOpen(true)}
              />
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="font-sans text-base text-muted-foreground py-12 text-center">
              No heuristics for this surface yet.
            </li>
          )}
        </motion.ol>
      </AnimatePresence>

      {/* Audit report — only renders once at least one verdict is set. */}
      {audit.isActive && (
        <AuditSummary heuristics={filtered} session={audit.session} />
      )}

      {/* LLM provider drawer — same component the Universe Engine
          Assistant uses, opened from the "LLM" button above and from
          each heuristic card's audit-runner CTA when no provider is
          configured. No session-cost panel here (audits aren't a
          continuous chat, no token-stream to tally). */}
      <SettingsDrawer
        heading="Usability Engine · LLM"
        open={llmSettingsOpen}
        onClose={() => setLlmSettingsOpen(false)}
        onConfigChange={() => setLlmSettingsOpen(false)}
      />
    </section>
  )
}

// Public re-exports for consumers + future tooling
export type { Heuristic, SurfaceKind, DemoKey, Severity } from "./types"
export { heuristics } from "./heuristics"
