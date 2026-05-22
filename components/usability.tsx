"use client"

/**
 * Section 06 — How I work / Usability.
 *
 * Previous version had four "pillars" — three of them duplicated Philosophy
 * (section 03): 'Code my own prototypes' = 'Prototypes are the argument',
 * 'Reversibility as the policy axis' = same principle, 'Calibrated language'
 * = 'Uncertainty must be legible'. After Philosophy was rewritten as a
 * numbered manifesto, this section read as the same content in a 2x2 grid.
 *
 * Restructured as a clear landing for the long-form /usability guide.
 * Credentials lead (the unique credibility signal), a one-paragraph stance,
 * a short topic preview, and a prominent CTA. No principle restatement.
 */

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

const credentials = [
  { label: "HFI Certified Usability Analyst", detail: "CUA · Human Factors International" },
  { label: "B.Tech · Computer Science", detail: "BTLIT Bangalore · VTU · 2008–2013" },
  { label: "12+ years shipping product", detail: "Enterprise SaaS · AI surfaces · Native + Web" },
]

const topics = [
  "What usability actually means (and what it doesn't)",
  "The eight axes I score on",
  "How calibrated confidence beats raw percentages",
  "When to escalate to a human reviewer",
]

export function Usability() {
  return (
    <section
      id="usability"
      aria-labelledby="usability-heading"
      className="relative py-24 md:py-32 px-6 md:px-12 border-t border-border"
    >
      <div className="mx-auto w-full max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 md:mb-20 max-w-3xl"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
            06 — USABILITY
          </p>
          <h2
            id="usability-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            Usability is the litmus test, not the checklist.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Accessibility, calibrated confidence, and recoverability aren't
            accessories — they're how you tell if enterprise software is
            actually any good. The full practitioner's guide lives at{" "}
            <span className="font-mono text-sm text-foreground">/usability</span>.
          </p>
        </motion.div>

        <div className="grid gap-12 md:gap-16 lg:grid-cols-[1fr_1.1fr]">
          {/* Credentials — lead with the credibility signal. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-baseline gap-3 mb-6">
              <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Foundation
              </p>
            </div>
            <ul className="space-y-5">
              {credentials.map((c) => (
                <li key={c.label} className="border-b border-border/60 pb-5 last:border-b-0">
                  <p className="font-sans text-base md:text-lg text-foreground leading-snug">
                    {c.label}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wider text-muted-foreground">
                    {c.detail}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Topic preview + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-baseline gap-3 mb-6">
              <span aria-hidden="true" className="block w-3 h-px bg-accent shrink-0" />
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                In the guide
              </p>
            </div>
            <ul className="space-y-3 mb-8">
              {topics.map((topic, i) => (
                <li
                  key={topic}
                  className="grid grid-cols-[2rem_1fr] gap-3 items-baseline"
                >
                  <span className="font-mono text-[10px] tracking-widest text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-sans text-base md:text-lg text-foreground/85 leading-snug">
                    {topic}
                  </p>
                </li>
              ))}
            </ul>

            {/* Sample verdict preview — three mini-rows showing what an
                audit verdict looks like. Makes "litmus test" concrete:
                blocker (red dot) / major (amber) / minor (muted) with
                checkmark / cross / dash for pass / fail / n.a. */}
            <div
              aria-label="Sample audit output preview"
              className="mb-10 border border-border rounded-md bg-secondary/30 p-4"
            >
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
                Sample verdict
              </p>
              <ul className="space-y-2">
                <li className="grid grid-cols-[10px_1fr_18px] items-center gap-3">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-500/80" />
                  <span className="font-mono text-[11px] tracking-wider text-foreground/85">
                    Visibility of status
                  </span>
                  <span aria-label="Fail" className="font-mono text-xs text-red-500/90">×</span>
                </li>
                <li className="grid grid-cols-[10px_1fr_18px] items-center gap-3">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500/80" />
                  <span className="font-mono text-[11px] tracking-wider text-foreground/85">
                    Recognition over recall
                  </span>
                  <span aria-label="Pass" className="font-mono text-xs text-emerald-500/90">✓</span>
                </li>
                <li className="grid grid-cols-[10px_1fr_18px] items-center gap-3">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                  <span className="font-mono text-[11px] tracking-wider text-foreground/70">
                    Help &amp; documentation
                  </span>
                  <span aria-label="Not applicable" className="font-mono text-xs text-muted-foreground/70">—</span>
                </li>
              </ul>
            </div>

            <Link
              href="/usability"
              data-cursor-hover
              className="
                group inline-flex items-center gap-3
                px-5 py-3 border border-foreground/30 rounded-full
                bg-background hover:bg-foreground hover:text-background hover:border-foreground
                font-mono text-xs tracking-[0.25em] uppercase
                transition-colors duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                min-h-11
              "
            >
              Read the full guide
              <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
