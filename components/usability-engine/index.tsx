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
import { heuristics } from "./heuristics"
import { HeuristicCard } from "./heuristic-card"
import type { SurfaceKind } from "./types"

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
              <HeuristicCard heuristic={h} index={i} />
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="font-sans text-base text-muted-foreground py-12 text-center">
              No heuristics for this surface yet.
            </li>
          )}
        </motion.ol>
      </AnimatePresence>
    </section>
  )
}

// Public re-exports for consumers + future tooling
export type { Heuristic, SurfaceKind, DemoKey, Severity } from "./types"
export { heuristics } from "./heuristics"
