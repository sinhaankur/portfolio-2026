/**
 * ChromosomeBrowser — paints the DNA segments you share with each match across
 * all 23 chromosomes. Overlapping segments from different matches on the same
 * spot hint at a shared common ancestor (the classic "triangulation" cue).
 *
 * Runs on the local real match overlay if present, else the synthetic demo set
 * (labelled as such). No personal data is committed.
 */

"use client"

import { useMemo, useState } from "react"
import { CHROMOSOME_CM } from "@/lib/dna-matches"
import { getMatches } from "@/lib/dna-matches-source"

const MATCH_COLORS = ["#f5b942", "#4ad6c4", "#7c6cf0", "#f06c8d", "#6cd67f", "#f0a56c", "#6ca8f0"]

export function ChromosomeBrowser() {
  const { matches, isDemo } = useMemo(() => getMatches(), [])
  // which matches are painted (all on by default)
  const [on, setOn] = useState<Set<string>>(() => new Set(matches.map((m) => m.id)))
  const maxCm = Math.max(...CHROMOSOME_CM.map((c) => c.cm))

  const colorFor = (id: string) => MATCH_COLORS[matches.findIndex((m) => m.id === id) % MATCH_COLORS.length]
  const toggle = (id: string) =>
    setOn((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-7">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-display text-xl md:text-2xl font-light">Chromosome Browser</h3>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">shared segments</span>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-4">
        Every DNA match shares one or more <strong>segments</strong> with you —
        stretches of a chromosome inherited from a common ancestor. Painting
        several matches at once shows where they overlap; matches that overlap on
        the same spot often descend from the same ancestor.
      </p>
      {isDemo && (
        <p className="mb-5 rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 font-mono text-[10px] tracking-wide text-accent/90">
          Demo data — invented matches, to show how segment-painting works. Drop your own export in locally to see yours.
        </p>
      )}

      {/* match toggles / legend */}
      <div className="mb-5 flex flex-wrap gap-2">
        {matches.map((m) => {
          const active = on.has(m.id)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              data-cursor-hover
              className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] transition-colors ${
                active ? "border-border text-foreground" : "border-border/50 text-muted-foreground/50"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: active ? colorFor(m.id) : "transparent", border: `1px solid ${colorFor(m.id)}` }} />
              {m.name}
              <span className="text-muted-foreground">· {m.totalCm} cM</span>
            </button>
          )
        })}
      </div>

      {/* the ideogram: one row per chromosome */}
      <div className="space-y-1.5">
        {CHROMOSOME_CM.map(({ chr, cm }) => (
          <div key={chr} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{chr}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]" style={{ maxWidth: `${(cm / maxCm) * 100}%` }}>
              {matches
                .filter((m) => on.has(m.id))
                .flatMap((m) =>
                  m.segments
                    .filter((s) => s.chr === chr)
                    .map((s, i) => (
                      <div
                        key={`${m.id}-${i}`}
                        className="absolute top-0 h-full opacity-80 mix-blend-screen"
                        style={{
                          left: `${(s.startCm / cm) * 100}%`,
                          width: `${((s.endCm - s.startCm) / cm) * 100}%`,
                          backgroundColor: colorFor(m.id),
                        }}
                        title={`${m.name}: chr${chr} ${s.startCm}–${s.endCm} cM`}
                      />
                    )),
                )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Segment lengths in cM · overlapping paint from multiple matches = a triangulation cue toward a shared ancestor
      </p>
    </div>
  )
}
