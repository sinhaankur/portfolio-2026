"use client"

/**
 * Section 04 — Experience.
 *
 * Previous version had:
 *   - a 224-288 px panel that floated near the cursor on row hover,
 *     showing an abstract SVG glyph (wave, grid, rings) that didn't
 *     map to any meaningful property of the company. Pure decoration,
 *     pure distraction.
 *   - text-3xl/5xl/6xl headings — "Deloitte Touche Tohmatsu India" at
 *     60 px wrapped awkwardly.
 *   - per-row 4-tag clusters plus a separate status pill in a third
 *     grid column. Two mono-text clusters competing for attention.
 *   - a slide-right-on-hover animation that wobbled the layout.
 *
 * Tightened to a calm vertical timeline:
 *   - period + duration on the left
 *   - role + blurb + inline status + tags on the right, all in one column
 *   - heading capped at text-4xl/5xl
 *   - hover affordance is a thin accent underline + a subtle border
 *     accent on the row; no position shift, no floating glyph
 *   - IBM (the only no-href row) renders as a small "Before that" footer
 */

import { useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

type Experience = {
  company: string
  role: string
  period: string
  duration: string
  blurb: string
  tags: string[]
  /** Only Oracle is currently active — surfaces as a small "Currently" tick
   *  on the date column. Past roles don't carry a status pill; the
   *  "Case study →" cue at the bottom-right is the consistent affordance. */
  current?: boolean
  href: string
}

const timeline: Experience[] = [
  {
    company: "Oracle",
    role: "Principal UX Designer · Cloud Database Tooling & AI Orchestration",
    period: "Feb 2020 – Present",
    duration: "5+ years",
    blurb:
      "Lead designer for cloud database tooling and AI orchestration surfaces. Cross-tool consistency across the data lifecycle. Specifics under NDA.",
    tags: ["Enterprise", "Data tooling", "AI orchestration"],
    current: true,
    href: "/works/oracle",
  },
  {
    company: "Deloitte",
    role: "UX Designer / Product Strategist · Touche Tohmatsu India",
    period: "Apr 2018 – Feb 2020",
    duration: "2 years",
    blurb:
      "Brought UCD process to enterprise channels — Salesforce, Supply Chain ERPs. Owned end-to-end user research, information architecture, and reporting surfaces with product, engineering, QA, and clients.",
    tags: ["Service design", "Enterprise", "Salesforce"],
    href: "/works/deloitte",
  },
  {
    company: "Snowtint",
    role: "Lead UX Designer · Snowtint Technologies",
    period: "Sep 2016 – Mar 2018",
    duration: "1.5 years",
    blurb:
      "Founded and led the company's first UX team. Built a group of interaction designers and researchers; owned production across web, social, and mobile; set strategic UX direction.",
    tags: ["Founding UX", "Team lead", "Web", "Mobile"],
    href: "/works/snowtint",
  },
  {
    company: "Rage",
    role: "UX Designer · Rage Communication",
    period: "Jun 2015 – Jul 2016",
    duration: "1 year",
    blurb:
      "Banking and consumer projects: Citibank (NA / India / Philippines), HSBC, Deutsche Bank, Vodafone, Unilever, CEAT, Quikr. Wireframes, interaction design, end-user interviews, client presentation.",
    tags: ["Banking", "Consumer", "Client work"],
    href: "/works/rage",
  },
]

const origin = {
  company: "IBM India",
  role: "IT Analyst",
  period: "Jun 2013 – Jul 2014",
  blurb: "Where the engineer-turned-designer story starts. Built systems before I designed them — and that's still how I think.",
}

export function Works() {
  const prefersReducedMotion = useReducedMotion()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <section
      id="works"
      aria-labelledby="works-heading"
      className="relative py-24 md:py-32 px-6 md:px-12"
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
            04 — EXPERIENCE
          </p>
          <h2
            id="works-heading"
            className="font-display text-3xl md:text-5xl lg:text-6xl font-light italic tracking-[-0.01em] leading-[1.05]"
          >
            12+ years, four companies, one through-line.
          </h2>
          <p className="mt-6 font-sans text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed">
            Engineer-turned-designer. Shipping enterprise SaaS and AI-assisted
            product surfaces across banking, supply chain, oil &amp; gas,
            e-commerce, and cloud database tooling.
          </p>
        </motion.div>

        {/* Timeline */}
        <ol className="border-t border-border">
          {timeline.map((entry, index) => (
            <motion.li
              key={entry.company}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: index * 0.06 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              className="border-b border-border"
            >
              <Link
                href={entry.href!}
                data-cursor-hover
                aria-label={`${entry.company} — ${entry.role}`}
                className="
                  group block py-8 md:py-10
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-4 focus-visible:ring-offset-background
                  rounded-md
                "
              >
                <div className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-10 md:items-start">
                  {/* Period column — currently-active roles get a pulsing
                      accent dot prefix so the "Present" date doesn't have
                      to carry that signal alone. */}
                  <div className="font-mono text-xs tracking-widest text-muted-foreground pt-2 md:pt-3">
                    {entry.current && (
                      <p className="inline-flex items-center gap-1.5 text-accent mb-1.5">
                        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                        </span>
                        Currently
                      </p>
                    )}
                    <p>{entry.period}</p>
                    <p className="mt-1 text-muted-foreground/65">{entry.duration}</p>
                  </div>

                  {/* Content column */}
                  <div className="min-w-0">
                    <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
                      {entry.company}
                    </h3>
                    <p className="mt-2 font-mono text-xs md:text-sm tracking-wider uppercase text-accent">
                      {entry.role}
                    </p>
                    <p className="mt-4 font-sans text-sm md:text-base text-foreground/80 max-w-2xl leading-relaxed">
                      {entry.blurb}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                      <ul className="flex gap-1.5 flex-wrap">
                        {entry.tags.map((tag) => (
                          <li
                            key={tag}
                            className="font-mono text-[10px] tracking-wider px-2 py-0.5 border border-border rounded-full text-foreground/70"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                      <span
                        className="
                          font-mono text-[10px] tracking-widest uppercase
                          inline-flex items-center gap-1
                          text-muted-foreground
                          group-hover:text-accent transition-colors duration-300
                        "
                        aria-hidden="true"
                      >
                        Case study
                        <ArrowUpRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtle accent underline that animates in on hover */}
                <motion.div
                  aria-hidden="true"
                  className="mt-6 h-px bg-accent origin-left"
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { scaleX: hoveredIndex === index ? 1 : 0 }
                  }
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ scaleX: prefersReducedMotion ? 0 : undefined }}
                />
              </Link>
            </motion.li>
          ))}
        </ol>

        {/* Origin — IBM. Renders as a small footer-style line, not a row,
            since there's no case study to link to. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10 md:mt-14 pt-8 border-t border-border/60"
        >
          <div className="grid gap-3 md:grid-cols-[10rem_1fr] md:gap-10 md:items-start">
            <p className="font-mono text-xs tracking-widest text-muted-foreground">
              {origin.period}
            </p>
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                Before that ·
              </p>
              <p className="font-sans text-base md:text-lg text-foreground/85">
                <span className="text-foreground font-medium">{origin.company}</span> · {origin.role}.
              </p>
              <p className="mt-2 font-sans text-sm text-foreground/70 leading-relaxed">
                {origin.blurb}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
