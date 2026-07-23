/**
 * DnaCompare — "you vs. the average human."
 *
 * Numbers are only meaningful in context. This section puts your genome next to
 * typical human values: how much of it is heterozygous (a proxy for genetic
 * diversity), and — from the trait panel — how many of your calls are the
 * COMMON form vs. the less-common one. It reframes the whole page from "here are
 * your letters" to "here's where you sit among everyone else." Works for any
 * uploaded file; whatever markers your file has, it compares those.
 */

import { useMemo } from "react"
import { TRAIT_MARKERS, normalizeGenotype } from "@/lib/dna-traits"
import type { DnaSummary } from "@/lib/dna-crypto"

// Typical human heterozygosity across a genotyping array sits in a well-known
// band — most people are ~30–36% heterozygous. We use the midpoint as the
// reference line. (A proxy for diversity, not a quality score.)
const AVG_HET_PCT = 33

function Bar({ you, avg, youLabel, avgLabel }: { you: number; avg: number; youLabel: string; avgLabel: string }) {
  const max = Math.max(you, avg, 1) * 1.15
  return (
    <div className="space-y-2">
      <Row label="You" pct={you} of={max} tint="bg-accent" value={youLabel} strong />
      <Row label="Average" pct={avg} of={max} tint="bg-foreground/25" value={avgLabel} />
    </div>
  )
}
function Row({ label, pct, of, tint, value, strong }: { label: string; pct: number; of: number; tint: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-16 shrink-0 font-mono text-[10px] tracking-wider uppercase ${strong ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <span className="flex-1 h-2 rounded-full bg-foreground/8 overflow-hidden">
        <span className={`block h-full rounded-full ${tint}`} style={{ width: `${(pct / of) * 100}%` }} />
      </span>
      <span className={`w-16 text-right font-mono text-[11px] ${strong ? "text-foreground" : "text-muted-foreground"}`}>{value}</span>
    </div>
  )
}

export function DnaCompare({ data }: { data: DnaSummary }) {
  const { homozygous, heterozygous, noCall } = data.genotypeClasses
  const totalCalls = homozygous + heterozygous + noCall || 1
  const hetPct = (heterozygous / totalCalls) * 100

  // From the trait panel: how many of your calls are the "common / most-frequent"
  // form for that marker? We treat the first-listed outcome key as the reference
  // and flag when your genotype is the LESS common one (a rough but honest
  // "you're in the minority here" signal).
  const traitCompare = useMemo(() => {
    const traits = data.traits ?? {}
    let common = 0
    let lessCommon = 0
    const standouts: { title: string; note: string }[] = []
    for (const m of TRAIT_MARKERS) {
      const raw = traits[m.id]
      if (!raw) continue
      const g = normalizeGenotype(raw)
      const keys = Object.keys(m.outcomes).map(normalizeGenotype)
      if (!keys.length) continue
      const idx = keys.indexOf(g)
      if (idx < 0) continue
      // Heuristic: the FIRST key is the reference/common outcome the marker was
      // authored around; later keys are the notable/rarer directions.
      if (idx === 0) common++
      else {
        lessCommon++
        const outcome = m.outcomes[Object.keys(m.outcomes)[idx]]
        if (outcome?.tone === "notable") {
          standouts.push({ title: m.title, note: outcome.label })
        }
      }
    }
    return { common, lessCommon, standouts: standouts.slice(0, 6) }
  }, [data.traits])

  const totalTrait = traitCompare.common + traitCompare.lessCommon
  const uncommonPct = totalTrait ? Math.round((traitCompare.lessCommon / totalTrait) * 100) : 0

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-3">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          You vs. the average
        </h2>
      </div>
      <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-8">
        Your letters only mean something in context. Here&apos;s where you sit
        against a typical human — not better or worse, just how common your
        version is.
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Heterozygosity */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
          <h3 className="font-display text-lg font-light text-foreground mb-1">Genetic diversity</h3>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed mb-4">
            How often your two inherited copies differ (heterozygous). Higher
            means more varied ancestry mixing; it&apos;s a diversity proxy, not a
            score.
          </p>
          <Bar
            you={hetPct}
            avg={AVG_HET_PCT}
            youLabel={`${hetPct.toFixed(1)}%`}
            avgLabel={`~${AVG_HET_PCT}%`}
          />
          <p className="mt-4 font-sans text-xs text-foreground/60 leading-relaxed">
            {hetPct > AVG_HET_PCT + 2
              ? "Above the typical band — a sign of more mixed ancestry."
              : hetPct < AVG_HET_PCT - 2
                ? "Below the typical band — often seen with more homogeneous ancestry."
                : "Right around the typical human range."}
          </p>
        </div>

        {/* Common vs uncommon trait forms */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
          <h3 className="font-display text-lg font-light text-foreground mb-1">How typical your traits are</h3>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed mb-4">
            Across the {totalTrait} panel markers your file covers, how many are
            the common form vs. the less-common one.
          </p>
          <div className="flex items-end gap-4">
            <div className="text-center">
              <div className="text-3xl font-semibold text-foreground leading-none">{traitCompare.common}</div>
              <div className="mt-1 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">common form</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-semibold text-accent leading-none">{traitCompare.lessCommon}</div>
              <div className="mt-1 font-mono text-[11px] tracking-widest uppercase text-muted-foreground">less common</div>
            </div>
          </div>
          <p className="mt-4 font-sans text-xs text-foreground/60 leading-relaxed">
            {uncommonPct}% of your covered markers carry the less-common variant —
            the parts of you that stand out from the crowd.
          </p>
        </div>
      </div>

      {/* Standouts */}
      {traitCompare.standouts.length > 0 && (
        <div className="mt-5 rounded-2xl border border-border bg-card/40 p-5 md:p-6">
          <h3 className="font-display text-lg font-light text-foreground mb-3">Where you stand out</h3>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {traitCompare.standouts.map((s) => (
              <li key={s.title} className="flex items-baseline gap-2 text-sm">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 translate-y-1 rounded-full bg-accent" />
                <span className="text-foreground/80">
                  {s.title} — <span className="text-accent/90">{s.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
