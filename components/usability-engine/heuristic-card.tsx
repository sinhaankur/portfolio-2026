"use client"

/**
 * HeuristicCard — renders one row of the Usability Engine catalog.
 *
 * Layout: number eyebrow + title, narrative story, optional interactive
 * demo, and a 'Self-audit' question with a tap-to-reveal fix. Severity
 * pill colours the left rule. Reads as a manifesto entry with hands-on
 * demo when the heuristic supports it.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import type { Heuristic } from "./types"
import { demoRegistry } from "./demos/registry"

const SEVERITY_TONE: Record<Heuristic["severity"], { dot: string; label: string }> = {
  blocker: { dot: "bg-red-500",     label: "Blocker" },
  major:   { dot: "bg-amber-500",   label: "Major" },
  minor:   { dot: "bg-emerald-500", label: "Minor" },
}

export function HeuristicCard({ heuristic, index }: { heuristic: Heuristic; index: number }) {
  const [auditOpen, setAuditOpen] = useState(false)
  const Demo = heuristic.demo ? demoRegistry[heuristic.demo] : null

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <div className="grid grid-cols-[3.5rem_1fr] md:grid-cols-[6rem_1fr] gap-4 md:gap-10">
        {/* Number column */}
        <div className="pt-2 md:pt-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
            <span className="font-mono text-[10px] md:text-xs tracking-widest text-accent">
              {heuristic.number}
            </span>
          </div>
          <span
            className={`mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-foreground/70`}
            aria-label={`Severity: ${SEVERITY_TONE[heuristic.severity].label}`}
          >
            <span aria-hidden="true" className={`block w-1.5 h-1.5 rounded-full ${SEVERITY_TONE[heuristic.severity].dot}`} />
            {SEVERITY_TONE[heuristic.severity].label}
          </span>
        </div>

        {/* Content column */}
        <div>
          <h3 className="font-display text-2xl md:text-3xl lg:text-4xl font-light tracking-[-0.01em] leading-[1.15] text-foreground">
            {heuristic.title}
          </h3>
          <p className="mt-3 font-serif italic text-lg md:text-xl text-foreground/85 max-w-2xl leading-snug">
            {heuristic.claim}
          </p>
          <p className="mt-5 font-sans text-base md:text-[17px] text-foreground/80 leading-relaxed max-w-2xl">
            {heuristic.story}
          </p>

          {/* Surface tags */}
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {heuristic.appliesTo.map((s) => (
              <li
                key={s}
                className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 border border-border rounded-full text-foreground/70"
              >
                {s.replace("-", " ")}
              </li>
            ))}
          </ul>

          {/* Demo */}
          {Demo && (
            <div className="mt-8">
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3 inline-flex items-center gap-2">
                <span aria-hidden="true" className="block w-2 h-px bg-accent" />
                Interactive
              </p>
              <Demo />
            </div>
          )}

          {/* Self-audit — collapsible */}
          <div className="mt-8 border border-border rounded-lg bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setAuditOpen((v) => !v)}
              aria-expanded={auditOpen}
              className="
                w-full flex items-start gap-3 px-5 py-4 text-left
                hover:bg-secondary/40 transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-2 focus-visible:ring-offset-background
                rounded-lg
              "
            >
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent pt-1.5 shrink-0">
                Audit
              </span>
              <span className="flex-1 font-sans text-base md:text-lg text-foreground leading-snug">
                {heuristic.auditQuestion}
              </span>
              <motion.span
                animate={{ rotate: auditOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 mt-1.5 text-muted-foreground"
                aria-hidden="true"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {auditOpen && (
                <motion.div
                  key="fix"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-1 border-t border-border">
                    <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
                      If the answer is "no" or "unsure":
                    </p>
                    <p className="font-sans text-sm md:text-base text-foreground/85 leading-relaxed max-w-2xl">
                      {heuristic.fix}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
