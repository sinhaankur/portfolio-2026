/**
 * DnaJourney — the deep-time "your DNA journey over the years, from its origins".
 *
 * A single log-scaled time axis from ~300,000 years ago (human origins in Africa)
 * to today, with each stop pinned at its real date so the whole arc reads as one
 * walk through time. Three layers compose onto the axis:
 *   1. the universal human arc (out-of-Africa → Neolithic → today) — public,
 *   2. the carried-variant chapters (from the trait panel), each at its real date,
 *   3. a PRIVATE ancestry overlay (real MyHeritage-style era breakdowns) when a
 *      local file supplies it — otherwise this layer is simply absent.
 *
 * Log time is essential: 300,000 → 0 spans five orders of magnitude, and the
 * interesting recent chapters (Neolithic, Bronze Age, your variants) all cluster
 * in the last few % of a linear axis. Log spreads them out legibly.
 */

"use client"

import { useMemo, useState } from "react"
import { PUBLIC_JOURNEY, type JourneyStop, type AncestryProfile } from "@/lib/dna-journey"
import { getPrivateAncestry } from "@/lib/dna-ancestry-private"

/** Variant chapters carry real dates as strings ("~7,500 years ago"); parse a
 *  representative yearsAgo so they can be pinned on the same axis. */
function chapterYearsAgo(when: string): number | null {
  const s = when.toLowerCase().replace(/,/g, "")
  if (/deep ancestral/.test(s)) return 200000
  // grab number + optional k/thousand, taking the first of a range
  const m = s.match(/([\d.]+)\s*(k|thousand|million)?/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (m[2] === "k" || m[2] === "thousand") n *= 1000
  if (m[2] === "million") n *= 1_000_000
  return Number.isFinite(n) ? n : null
}

/** Log position 0..1 across the axis. 0 = oldest (LEFT), 1 = today (RIGHT).
 *  Uses log10(yearsAgo) mapped from [oldest..~1] so deep time compresses and the
 *  recent, dense chapters spread out. */
function logPos(yearsAgo: number, oldest: number): number {
  const clamped = Math.max(1, Math.min(oldest, yearsAgo))
  const lo = Math.log10(1) // today ≈ 1 yr ago floor → 0
  const hi = Math.log10(oldest)
  // older (large yearsAgo) → left (0); today (small) → right (1)
  return 1 - (Math.log10(clamped) - lo) / (hi - lo)
}

export function DnaJourney({
  chapters,
}: {
  /** Carried-variant chapters from DnaOrigins (title/when/gene). */
  chapters: { markerId: string; title: string; when: string; gene: string }[]
}) {
  const ancestry: AncestryProfile | null = useMemo(() => getPrivateAncestry(), [])

  // Oldest point on the axis — origins (~300k). All positions scale to it.
  const OLDEST = 300000

  // Build the ordered set of axis stops: the public arc + carried variants,
  // de-duplicated roughly by age so labels don't stack.
  const stops = useMemo<Array<JourneyStop & { pos: number }>>(() => {
    const base: JourneyStop[] = [...PUBLIC_JOURNEY]
    const variantStops: JourneyStop[] = chapters
      .map((c) => {
        const ya = chapterYearsAgo(c.when)
        if (ya == null) return null
        return {
          id: `var-${c.markerId}`,
          yearsAgo: ya,
          age: c.when,
          title: c.title,
          blurb: `Traced from your ${c.gene} variant.`,
          personal: true,
        } as JourneyStop
      })
      .filter((x): x is JourneyStop => x !== null)
    return [...base, ...variantStops]
      .map((s) => ({ ...s, pos: logPos(s.yearsAgo, OLDEST) }))
      .sort((a, b) => a.pos - b.pos)
  }, [chapters])

  const [active, setActive] = useState<string | null>(null)

  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-4 mb-3">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          Your journey through deep time
        </h2>
      </div>
      <p className="font-sans text-sm md:text-base text-foreground/70 leading-relaxed max-w-2xl mb-6">
        {ancestry?.summary ??
          "From origins in Africa to today, on a log-scaled timeline so 300,000 years fit on one line. Each mark is a chapter your DNA passed through — the shared human arc, plus the moments your own variants trace."}
      </p>

      {/* ---- The deep-time axis ---- */}
      <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-8 mb-8">
        <div className="relative h-40 md:h-44">
          {/* the line */}
          <div aria-hidden className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          {/* origin + today end-caps */}
          <div aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent/70" />
          <div aria-hidden className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-accent" />

          {stops.map((s, i) => {
            const isActive = active === s.id
            const above = i % 2 === 0 // alternate labels above/below to avoid overlap
            return (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setActive(s.id)}
                onFocus={() => setActive(s.id)}
                onMouseLeave={() => setActive((a) => (a === s.id ? null : a))}
                onClick={() => setActive((a) => (a === s.id ? null : s.id))}
                data-cursor-hover
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{ left: `${s.pos * 100}%` }}
                aria-label={`${s.title} — ${s.age}`}
              >
                {/* node */}
                <span
                  className={`block rounded-full transition-all ${
                    s.personal
                      ? "h-3 w-3 border-2 border-accent bg-background"
                      : "h-2.5 w-2.5 bg-foreground/50 group-hover:bg-foreground"
                  } ${isActive ? "ring-2 ring-accent/50 ring-offset-2 ring-offset-background" : ""}`}
                />
                {/* label */}
                <span
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-wider uppercase ${
                    above ? "bottom-full mb-2" : "top-full mt-2"
                  } ${isActive ? "text-accent" : "text-muted-foreground"}`}
                >
                  {s.age}
                </span>
              </button>
            )
          })}
        </div>

        {/* active stop detail */}
        <div className="mt-4 min-h-[3.5rem] rounded-xl border border-border/60 bg-background/40 px-4 py-3">
          {(() => {
            const s = stops.find((x) => x.id === active) ?? stops[0]
            return (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-accent">{s.age}</span>
                  <h3 className="font-display text-lg font-light text-foreground">{s.title}</h3>
                </div>
                <p className="mt-1 font-sans text-sm text-foreground/75 leading-relaxed">{s.blurb}</p>
              </>
            )
          })()}
        </div>
      </div>

      {/* ---- Private ancestry overlay: real era breakdowns ---- */}
      {ancestry?.eras && ancestry.eras.length > 0 && (
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-3">
            Your ancestry by era
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...ancestry.eras]
              .sort((a, b) => b.yearsAgo - a.yearsAgo)
              .map((era) => (
                <div key={era.id} className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="font-display text-base font-light text-foreground mb-3">{era.label}</div>
                  <ul className="space-y-2">
                    {era.components.map((c) => (
                      <li key={c.population}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-sans text-sm text-foreground/85">
                            {c.population}
                            {c.date && (
                              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{c.date}</span>
                            )}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-accent">{c.pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className="h-full rounded-full bg-accent/70"
                            style={{ width: `${Math.min(100, c.pct)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ---- Private overlay: deep ancestral source composition ---- */}
      {ancestry?.deepAncestry && ancestry.deepAncestry.length > 0 && (
        <div className="mb-8 rounded-2xl border border-border bg-secondary/20 p-5 md:p-6">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-2">
            Deep ancestral sources
          </div>
          <p className="font-sans text-xs text-muted-foreground mb-4">
            The hunter-gatherer and farmer populations your genome resolves back into —
            the raw material every later era was mixed from.
          </p>
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {ancestry.deepAncestry.map((c, i) => (
              <div
                key={c.population}
                title={`${c.population} — ${c.pct.toFixed(1)}%`}
                className="h-full"
                style={{
                  width: `${c.pct}%`,
                  background: `hsl(${(i * 47) % 360} 55% 55%)`,
                }}
              />
            ))}
          </div>
          <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {ancestry.deepAncestry.map((c, i) => (
              <li key={c.population} className="flex items-center justify-between gap-2 font-sans text-sm">
                <span className="flex items-center gap-2 text-foreground/85">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `hsl(${(i * 47) % 360} 55% 55%)` }} />
                  {c.population}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{c.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Private overlay: closest ancient populations ---- */}
      {ancestry?.closest && ancestry.closest.length > 0 && (
        <div className="mb-2">
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-2">
            Closest ancient populations
          </div>
          <ol className="flex flex-wrap gap-2">
            {ancestry.closest.map((c, i) => (
              <li
                key={c.population}
                className="rounded-full border border-border bg-card/40 px-3 py-1 font-mono text-[11px] text-foreground/80"
              >
                <span className="text-accent">{i + 1}.</span> {c.population}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        {ancestry
          ? "Deep-time journey from ancestry-composition analysis · dates are population midpoints, a heritage narrative not a precise verdict"
          : "The universal human arc · your own chapters appear as ancestry-informative variants are detected"}
      </p>
    </section>
  )
}
