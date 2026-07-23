"use client"

/**
 * DnaHero — the "at a glance" header shown the moment your genome unlocks.
 *
 * Turns the wall of sections that follows into an experience with a front door:
 * a bold headline read, the three numbers that matter most, and a jump-nav so
 * the (now long) page is navigable. Sets the premium tone for everything below.
 */

import { useMemo } from "react"
import { motion } from "framer-motion"
import { TRAIT_MARKERS, normalizeGenotype } from "@/lib/dna-traits"
import type { DnaSummary } from "@/lib/dna-crypto"

const SECTIONS = [
  { id: "how-dna-works", label: "How DNA works" },
  { id: "dna-evolution", label: "Evolution" },
  { id: "dna-origins", label: "Origins" },
  { id: "dna-plan", label: "Your plan" },
  { id: "dna-compare", label: "vs. Average" },
  { id: "dna-traits", label: "Traits" },
  { id: "dna-inheritance", label: "Inheritance" },
  { id: "dna-helix", label: "Helix" },
]

export function DnaHero({ data }: { data: DnaSummary }) {
  const { homozygous, heterozygous, noCall } = data.genotypeClasses
  const totalCalls = homozygous + heterozygous + noCall || 1
  const hetPct = (heterozygous / totalCalls) * 100

  const stats = useMemo(() => {
    const traits = data.traits ?? {}
    let covered = 0
    let standout = 0
    for (const m of TRAIT_MARKERS) {
      const raw = traits[m.id]
      if (!raw) continue
      covered++
      const g = normalizeGenotype(raw)
      const keys = Object.keys(m.outcomes).map(normalizeGenotype)
      const idx = keys.indexOf(g)
      if (idx > 0) {
        const outcome = m.outcomes[Object.keys(m.outcomes)[idx]]
        if (outcome?.tone === "notable") standout++
      }
    }
    return { covered, standout }
  }, [data.traits])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative mb-16 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/[0.08] via-card/40 to-background p-6 md:p-10"
    >
      {/* soft helix glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 30%, transparent), transparent 70%)" }}
      />

      <div className="relative">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-4">
          Your genome · decrypted on this device
        </p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.05] max-w-2xl">
          3.2 billion letters. <span className="italic text-foreground/70">Here&apos;s what yours say.</span>
        </h1>

        {/* Headline numbers */}
        <div className="mt-8 grid grid-cols-3 gap-3 md:gap-5 max-w-xl">
          <HeroStat n={`${(data.meta.totalSnps / 1000).toFixed(0)}k`} label="variants read" />
          <HeroStat n={`${hetPct.toFixed(0)}%`} label="heterozygous" />
          <HeroStat n={`${stats.standout}`} label="stand out" accent />
        </div>

        {/* Section jump-nav */}
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Genome sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              data-cursor-hover
              className="rounded-full border border-border bg-background/40 px-3.5 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-accent/60 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
    </motion.section>
  )
}

function HeroStat({ n, label, accent }: { n: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4 md:p-5 text-center">
      <div className={`text-2xl md:text-4xl font-semibold leading-none ${accent ? "text-accent" : "text-foreground"}`}>{n}</div>
      <div className="mt-2 font-mono text-[8px] md:text-[9px] tracking-[0.14em] uppercase text-muted-foreground">{label}</div>
    </div>
  )
}
