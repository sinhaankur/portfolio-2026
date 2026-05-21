"use client"

import type React from "react"

import { useState, useRef } from "react"
import Link from "next/link"
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion"

type Experience = {
  company: string
  role: string
  period: string
  duration: string
  blurb: string
  tags: string[]
  status?: "Current" | "NDA" | "Case study" | "Foundational"
  glyph: GlyphKind
  href?: string
}

type GlyphKind = "gate" | "rings" | "loop" | "grid" | "wave" | "spine" | "core"

// Case-study links point to the in-app routes — we re-authored these into the new theme.
const timeline: Experience[] = [
  {
    company: "Oracle",
    role: "Principal UX Designer · Cloud Database Tooling & AI Orchestration",
    period: "Feb 2020 – Present",
    duration: "5+ years",
    blurb:
      "Lead designer for cloud database tooling and AI orchestration surfaces. Cross-tool consistency across the data lifecycle. Specifics under NDA.",
    tags: ["Enterprise", "Data tooling", "AI orchestration", "Principal"],
    status: "Current",
    glyph: "grid",
    href: "/works/oracle",
  },
  {
    company: "Deloitte Touche Tohmatsu India",
    role: "UX Designer / Product Strategist",
    period: "Apr 2018 – Feb 2020",
    duration: "2 years",
    blurb:
      "Brought UCD process to enterprise channels — Salesforce, Supply Chain ERPs. Owned end-to-end user research, information architecture, and reporting surfaces with product, engineering, QA, and clients.",
    tags: ["Service design", "Enterprise", "Salesforce", "Supply Chain"],
    status: "Case study",
    glyph: "spine",
    href: "/works/deloitte",
  },
  {
    company: "Snowtint Technologies",
    role: "Lead UX Designer",
    period: "Sep 2016 – Mar 2018",
    duration: "1.5 years",
    blurb:
      "Founded and led the company's first UX team. Built a group of interaction designers and researchers; owned production across web, social, and mobile; set strategic UX direction.",
    tags: ["Founding UX", "Team lead", "Web", "Mobile"],
    status: "Case study",
    glyph: "rings",
    href: "/works/snowtint",
  },
  {
    company: "Rage Communication",
    role: "UX Designer (Jr → Mid)",
    period: "Jun 2015 – Jul 2016",
    duration: "1 year",
    blurb:
      "Banking and consumer projects: Citibank (NA / India / Philippines), HSBC, Deutsche Bank, Vodafone, Unilever, CEAT, Quikr. Wireframes, interaction design, end-user interviews, client presentation.",
    tags: ["Banking", "Consumer", "Client work"],
    status: "Foundational",
    glyph: "loop",
    href: "/works/rage",
  },
  {
    company: "IBM India",
    role: "IT Analyst",
    period: "Jun 2013 – Jul 2014",
    duration: "1 year",
    blurb:
      "Where the engineer-turned-designer story starts. Built systems before I designed them — and that's still how I think.",
    tags: ["Engineering", "Origin"],
    status: "Foundational",
    glyph: "core",
  },
]

function Glyph({ kind }: { kind: GlyphKind }) {
  const stroke = "currentColor"
  switch (kind) {
    case "gate":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          <line x1="10" y1="40" x2="50" y2="40" stroke={stroke} strokeWidth="1.5" />
          <rect x="50" y="20" width="20" height="40" stroke={stroke} strokeWidth="1.5" fill="none" />
          <line x1="70" y1="40" x2="110" y2="40" stroke={stroke} strokeWidth="1.5" />
          <circle cx="60" cy="40" r="3" fill={stroke} />
        </svg>
      )
    case "rings":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          {[10, 18, 26, 34].map((r, i) => (
            <circle key={i} cx="60" cy="40" r={r} stroke={stroke} strokeWidth="1.5" fill="none" opacity={1 - i * 0.2} />
          ))}
        </svg>
      )
    case "loop":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          <path d="M 30 40 Q 30 20 60 20 Q 90 20 90 40 Q 90 60 60 60 Q 30 60 30 40 Z" stroke={stroke} strokeWidth="1.5" fill="none" />
          <line x1="20" y1="40" x2="30" y2="40" stroke={stroke} strokeWidth="1.5" />
          <line x1="90" y1="40" x2="100" y2="40" stroke={stroke} strokeWidth="1.5" />
        </svg>
      )
    case "grid":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          {[20, 40, 60, 80, 100].map((x) => (
            <line key={`v${x}`} x1={x} y1="15" x2={x} y2="65" stroke={stroke} strokeWidth="1" />
          ))}
          {[20, 40, 60].map((y) => (
            <line key={`h${y}`} x1="15" y1={y} x2="105" y2={y} stroke={stroke} strokeWidth="1" />
          ))}
        </svg>
      )
    case "wave":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          <path d="M 10 40 Q 25 20 40 40 T 70 40 T 100 40 T 130 40" stroke={stroke} strokeWidth="1.5" fill="none" />
        </svg>
      )
    case "spine":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          <line x1="20" y1="40" x2="100" y2="40" stroke={stroke} strokeWidth="1.5" />
          {[30, 50, 70, 90].map((x) => (
            <circle key={x} cx={x} cy="40" r="3" stroke={stroke} strokeWidth="1.2" fill="none" />
          ))}
        </svg>
      )
    case "core":
      return (
        <svg viewBox="0 0 120 80" className="h-full w-full text-foreground" aria-hidden="true">
          <rect x="40" y="20" width="40" height="40" stroke={stroke} strokeWidth="1.5" fill="none" />
          <rect x="50" y="30" width="20" height="20" stroke={stroke} strokeWidth="1" fill="none" />
          <line x1="10" y1="30" x2="40" y2="30" stroke={stroke} strokeWidth="1" />
          <line x1="10" y1="50" x2="40" y2="50" stroke={stroke} strokeWidth="1" />
          <line x1="80" y1="30" x2="110" y2="30" stroke={stroke} strokeWidth="1" />
          <line x1="80" y1="50" x2="110" y2="50" stroke={stroke} strokeWidth="1" />
        </svg>
      )
  }
}

export function Works() {
  const prefersReducedMotion = useReducedMotion()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current && !prefersReducedMotion) {
      const rect = containerRef.current.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    }
  }

  return (
    <section
      id="works"
      aria-labelledby="works-heading"
      className="relative py-32 px-6 md:px-12 md:py-24"
    >
      <div className="mx-auto w-full max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mb-24 max-w-4xl"
      >
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
          04 — EXPERIENCE
        </p>
        <h2
          id="works-heading"
          className="font-sans text-3xl md:text-5xl font-light italic"
        >
          12+ years, four companies, one through-line.
        </h2>
        <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
          Engineer-turned-designer. Shipping enterprise SaaS and AI-assisted
          product surfaces across banking, supply chain, oil &amp; gas,
          e-commerce, and cloud database tooling.
        </p>
      </motion.div>

      <div ref={containerRef} onMouseMove={handleMouseMove} className="relative">
        {timeline.map((entry, index) => (
          <motion.div
            key={entry.company}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay: index * 0.07 }}
            className="relative border-t border-border py-8 md:py-12 last:border-b"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          >
            {entry.href ? (
              <Link
                href={entry.href}
                data-cursor-hover
                aria-label={`${entry.company} — ${entry.role}`}
                className="
                  group grid gap-4
                  md:grid-cols-[7rem_1fr_auto] md:items-start
                  rounded-md
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-4 focus-visible:ring-offset-background
                "
              >
                <TimelineRow entry={entry} hoveredIndex={hoveredIndex} index={index} prefersReducedMotion={prefersReducedMotion} />
              </Link>
            ) : (
              <div className="group grid gap-4 md:grid-cols-[7rem_1fr_auto] md:items-start">
                <TimelineRow entry={entry} hoveredIndex={hoveredIndex} index={index} prefersReducedMotion={prefersReducedMotion} />
              </div>
            )}
          </motion.div>
        ))}

        {!prefersReducedMotion && (
          <motion.div
            aria-hidden="true"
            className="absolute pointer-events-none z-50 w-56 h-36 md:w-72 md:h-44 overflow-hidden rounded-lg border border-border bg-background/85 backdrop-blur-md"
            style={{
              x: springX,
              y: springY,
              translateX: "-50%",
              translateY: "-320%",
            }}
            animate={{
              opacity: hoveredIndex !== null ? 1 : 0,
              scale: hoveredIndex !== null ? 1 : 0.85,
            }}
            transition={{ duration: 0.2 }}
          >
            {hoveredIndex !== null && (
              <div className="p-6 h-full flex items-center justify-center">
                <Glyph kind={timeline[hoveredIndex].glyph} />
              </div>
            )}
          </motion.div>
        )}
      </div>
      </div>
    </section>
  )
}

function TimelineRow({
  entry,
  hoveredIndex,
  index,
  prefersReducedMotion,
}: {
  entry: Experience
  hoveredIndex: number | null
  index: number
  prefersReducedMotion: boolean | null
}) {
  return (
    <>
      <div className="font-mono text-xs tracking-widest text-muted-foreground">
        <p>{entry.period}</p>
        <p className="mt-1 text-muted-foreground/70">{entry.duration}</p>
      </div>

      <div className="min-w-0">
        <motion.h3
          className="font-sans text-3xl md:text-5xl lg:text-6xl font-light tracking-tight text-foreground transition-colors duration-300"
          animate={
            prefersReducedMotion
              ? undefined
              : { x: hoveredIndex === index ? 12 : 0 }
          }
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {entry.company}
        </motion.h3>
        <p className="mt-2 font-mono text-xs md:text-sm tracking-wider uppercase text-accent">
          {entry.role}
        </p>
        <p className="mt-4 font-sans text-sm md:text-base text-foreground/80 max-w-2xl leading-relaxed">
          {entry.blurb}
        </p>
        <ul className="mt-4 flex gap-2 flex-wrap">
          {entry.tags.map((tag) => (
            <li
              key={tag}
              className="font-mono text-[10px] tracking-wider px-3 py-1 border border-border rounded-full text-foreground/70"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>

      {entry.status && (
        <span className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border border-border rounded-full text-foreground/90 self-start whitespace-nowrap">
          {entry.status}
        </span>
      )}
    </>
  )
}
