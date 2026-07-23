/**
 * DnaBodyType — "what's my genetic build type — and what would a different one say?"
 *
 * Ankur asked: general body type vs. if a different body type, what does it say?
 * So this reads the build-related markers you carry (appetite drive, fat-storage
 * lean, carb sensitivity, endurance-vs-power, strength/fat-loss response) into an
 * intuitive lean on ONE axis each — and, for every axis, shows the WHOLE spectrum
 * so you can see what each of the other genotypes would read for. Your own result
 * is highlighted.
 *
 * Honesty is the whole point: genes set a *tendency*, not a verdict. Diet, sleep,
 * training and stress move you along every one of these axes. The copy says lean,
 * never destiny.
 */

import { useMemo } from "react"
import { TRAIT_MARKERS, normalizeGenotype } from "@/lib/dna-traits"

/** One build axis, low→high. Each stop maps to a real genotype outcome label. */
type Axis = {
  markerId: string
  gene: string
  axis: string
  /** what the two poles mean, plainly. */
  low: string
  high: string
  /** ordered genotypes from the "low" pole to the "high" pole. */
  order: string[]
  /** a short plain read for each genotype, by normalized key. */
  reads: Record<string, string>
}

const AXES: Axis[] = [
  {
    markerId: "carb-weight", gene: "FTO · appetite", axis: "Appetite drive",
    low: "Appetite set by habit", high: "Genetically hungrier",
    order: ["TT", "AT", "AA"],
    reads: {
      TT: "Least genetic push to overeat — appetite is mostly your habits, sleep and stress.",
      AT: "A modest tendency toward higher appetite — responds well to protein and activity.",
      AA: "A stronger appetite lean — diet and exercise still dominate, but structure helps.",
    },
  },
  {
    markerId: "fat-cell", gene: "FTO · storage", axis: "Fat-storage lean",
    low: "Burn-leaning", high: "Store-leaning",
    order: ["TT", "CT", "CC"],
    reads: {
      TT: "Fat cells lean toward burning over storage — less genetic push to store.",
      CT: "A modest shift toward storage and slightly higher appetite.",
      CC: "Leans toward storage (incl. belly) and hunger runs higher — habit pushes back hard.",
    },
  },
  {
    markerId: "blood-sugar", gene: "TCF7L2", axis: "Carb sensitivity",
    low: "Handles carbs well", high: "Carb-sensitive",
    order: ["CC", "CT", "TT"],
    reads: {
      CC: "Handles refined carbs relatively well — not the carb-sensitivity variant.",
      CT: "Slightly less efficient blood-sugar handling — fibre and balanced meals help.",
      TT: "Big refined-carb meals spike-then-crash and store more easily — pair carbs with protein/fibre.",
    },
  },
  {
    markerId: "endurance", gene: "PPARGC1A", axis: "Endurance ↔ power",
    low: "Endurance-leaning", high: "Power-leaning",
    order: ["CC", "CT", "TT"],
    reads: {
      CC: "Steady cardio comes relatively naturally — endurance work pays off well.",
      CT: "A blend of endurance and power tendencies — flexible either way.",
      TT: "Leans to power — may respond relatively better to strength and sprint work.",
    },
  },
  {
    markerId: "strength-response", gene: "AGT", axis: "Strength response",
    low: "Gradual gains", high: "Strong responder",
    order: ["GG", "AG", "AA"],
    reads: {
      GG: "Strength comes patiently — longer consistent blocks and protein win.",
      AG: "A solid, typical strength-training response with consistent lifting.",
      AA: "Your body rewards lifting — progressive overload + enough protein shows fast.",
    },
  },
]

type Read = { axis: Axis; g: string; idx: number; known: boolean }

export function DnaBodyType({ traits }: { traits: Record<string, string> }) {
  const rows = useMemo<Read[]>(() => {
    return AXES.map((axis) => {
      const raw = traits[axis.markerId]
      const order = axis.order.map(normalizeGenotype)
      if (!raw) return { axis, g: "", idx: -1, known: false }
      const g = normalizeGenotype(raw)
      const idx = order.indexOf(g)
      return { axis, g, idx, known: idx >= 0 }
    })
  }, [traits])

  const known = rows.filter((r) => r.known)

  // A one-line synthesis of the lean, only from axes we actually read.
  const synthesis = useMemo(() => {
    if (known.length === 0) return null
    const leanHigh = known.filter((r) => r.idx === r.axis.order.length - 1)
    const leanLow = known.filter((r) => r.idx === 0)
    const notes: string[] = []
    const has = (id: string, poleHigh: boolean) =>
      known.some((r) => r.axis.markerId === id && (poleHigh ? r.idx === r.axis.order.length - 1 : r.idx === 0))
    if (has("carb-weight", true) || has("fat-cell", true) || has("blood-sugar", true))
      notes.push("a genetic lean toward easier fat storage and appetite — the kind that rewards protein-forward eating and steady sleep")
    if (has("carb-weight", false) && has("fat-cell", false))
      notes.push("relatively little genetic push to store fat — your build is more in your hands than your genes here")
    if (has("endurance", false)) notes.push("an endurance-leaning engine")
    if (has("endurance", true)) notes.push("a power-leaning engine")
    if (has("strength-response", true)) notes.push("muscle that responds fast to lifting")
    return {
      headline:
        leanHigh.length > leanLow.length
          ? "Your markers lean toward a build that stores and gains readily"
          : leanLow.length > leanHigh.length
            ? "Your markers lean toward a leaner, lower-storage build"
            : "Your markers sit near the middle of the build spectrum",
      notes,
    }
  }, [known])

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-3">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          Your build type
        </h2>
      </div>
      <p className="font-sans text-sm md:text-base text-foreground/75 leading-relaxed max-w-2xl mb-8">
        There&apos;s no single &ldquo;body-type gene.&rdquo; But a handful of your
        variants set a <em>lean</em> on things like appetite, fat storage, and how
        you respond to cardio vs. lifting. Below, each axis shows the full spectrum
        — so you can see what a <em>different</em> genotype would read — with{" "}
        <span className="text-accent">yours highlighted</span>. Every one of these
        is a tendency, not a verdict: diet, sleep, and training move you along the
        line.
      </p>

      {synthesis && (
        <div className="mb-8 rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 md:p-6">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-2">In one line</div>
          <p className="font-display text-lg md:text-xl font-light text-foreground leading-snug">
            {synthesis.headline}.
          </p>
          {synthesis.notes.length > 0 && (
            <p className="mt-2 font-sans text-sm text-foreground/70 leading-relaxed">
              Specifically: {synthesis.notes.join("; ")}.
            </p>
          )}
        </div>
      )}

      {known.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground italic">
          None of the build-related markers in this panel were present in your
          file — the panel is a small curated sample, not a full physique test.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <BuildAxis key={r.axis.markerId} read={r} />
          ))}
        </div>
      )}

      <p className="mt-8 font-sans text-sm text-foreground/60 leading-relaxed max-w-2xl italic">
        The honest headline: your genes nudge the starting line, not the finish.
        Two people with identical markers here can end up completely different
        builds — the lever that moves every axis above is what you do daily.
      </p>
    </section>
  )
}

function BuildAxis({ read }: { read: Read }) {
  const { axis, idx, known } = read
  const stops = axis.order.map(normalizeGenotype)
  const marker = TRAIT_MARKERS.find((m) => m.id === axis.markerId)

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg font-light text-foreground">{axis.axis}</h3>
        <span className="font-mono text-[10px] tracking-wider text-foreground/60">
          {axis.gene}
          {marker?.rsid ? ` · ${marker.rsid}` : ""}
        </span>
      </div>

      {/* Spectrum: poles + a stop per genotype, yours highlighted */}
      <div className="mt-4 flex items-center justify-between gap-2 font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
        <span>{axis.low}</span>
        <span>{axis.high}</span>
      </div>
      <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0,1fr))` }}>
        {stops.map((g, i) => {
          const mine = known && i === idx
          return (
            <div
              key={g}
              className={
                mine
                  ? "rounded-lg border border-accent/60 bg-accent/[0.10] px-2 py-2 text-center"
                  : "rounded-lg border border-border bg-background/40 px-2 py-2 text-center"
              }
            >
              <div className={`font-mono text-xs ${mine ? "text-accent" : "text-foreground/55"}`}>{g}</div>
              {mine && (
                <div className="mt-0.5 font-mono text-[9px] tracking-[0.16em] uppercase text-accent/80">you</div>
              )}
            </div>
          )
        })}
      </div>

      {/* The read for each stop — yours emphasized */}
      <ul className="mt-4 space-y-2">
        {stops.map((g, i) => {
          const mine = known && i === idx
          return (
            <li key={g} className="flex gap-3">
              <span className={`shrink-0 font-mono text-xs ${mine ? "text-accent" : "text-foreground/45"} w-8`}>{g}</span>
              <span className={`font-sans text-sm leading-relaxed ${mine ? "text-foreground" : "text-foreground/60"}`}>
                {axis.reads[g]}
                {mine && <span className="text-accent"> ← you</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
