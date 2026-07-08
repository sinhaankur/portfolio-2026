"use client"

/**
 * DnaRadar — an at-a-glance category profile of the trait panel.
 *
 * One axis per trait category. Each axis value is the share of that category's
 * markers that came back "notable" (a standout / worth-attention result) — so
 * the shape shows where your genome leans most distinctive. Pure SVG, themeable,
 * no chart library.
 */

import { useMemo } from "react"
import {
  TRAIT_MARKERS,
  normalizeGenotype,
  type TraitCategory,
} from "@/lib/dna-traits"

const CATEGORY_LABELS: Record<TraitCategory, string> = {
  diet: "Diet",
  fitness: "Fitness",
  skin: "Skin",
  wellness: "Wellness",
  physical: "Physical",
  health: "Health",
  pharma: "Drugs",
}
const ORDER: TraitCategory[] = ["diet", "fitness", "skin", "wellness", "physical", "pharma", "health"]

type Axis = { cat: TraitCategory; label: string; total: number; notable: number; value: number }

export function DnaRadar({ traits }: { traits: Record<string, string> }) {
  const axes = useMemo<Axis[]>(() => {
    const map = new Map<TraitCategory, { total: number; notable: number }>()
    for (const m of TRAIT_MARKERS) {
      const raw = traits[m.id]
      if (!raw) continue
      const out = m.outcomes[normalizeGenotype(raw)]
      const e = map.get(m.category) ?? { total: 0, notable: 0 }
      e.total += 1
      if (out?.tone === "notable") e.notable += 1
      map.set(m.category, e)
    }
    return ORDER.filter((c) => map.has(c)).map((c) => {
      const { total, notable } = map.get(c)!
      // value blends "how distinctive" (notable share) with a floor so present
      // categories always register on the chart.
      const value = total ? 0.25 + 0.75 * (notable / total) : 0
      return { cat: c, label: CATEGORY_LABELS[c], total, notable, value }
    })
  }, [traits])

  if (axes.length < 3) return null

  const size = 260
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 38
  const n = axes.length

  const pointAt = (i: number, radius: number) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const
  }

  const rings = [0.25, 0.5, 0.75, 1]
  const dataPts = axes.map((a, i) => pointAt(i, r * a.value))
  const dataPath = dataPts.map((p) => p.join(",")).join(" ")

  return (
    <section>
      <div className="flex items-baseline gap-4 mb-6">
        <span aria-hidden className="block w-12 h-px bg-accent" />
        <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
          Your profile at a glance
        </h2>
      </div>
      <p className="max-w-2xl mb-8 font-sans text-sm md:text-base text-foreground/75 leading-relaxed">
        Where your genome leans most distinctive. Each spoke is a category; the
        further it reaches, the more standout results it holds. The detail is in
        the cards below — this is just the silhouette.
      </p>

      <div className="grid md:grid-cols-[260px_1fr] gap-8 items-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[260px] mx-auto md:mx-0"
          role="img"
          aria-label="Radar chart of trait categories"
        >
          {/* rings */}
          {rings.map((ring) => (
            <polygon
              key={ring}
              points={axes
                .map((_, i) => pointAt(i, r * ring).join(","))
                .join(" ")}
              fill="none"
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
          ))}
          {/* spokes */}
          {axes.map((_, i) => {
            const [x, y] = pointAt(i, r)
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
            )
          })}
          {/* data polygon */}
          <polygon
            points={dataPath}
            fill="var(--accent, #7c6cf0)"
            fillOpacity={0.18}
            stroke="var(--accent, #7c6cf0)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {dataPts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--accent, #7c6cf0)" />
          ))}
          {/* labels */}
          {axes.map((a, i) => {
            const [x, y] = pointAt(i, r + 18)
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-current text-muted-foreground"
                style={{ fontSize: 9, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                {a.label}
              </text>
            )
          })}
        </svg>

        {/* legend / counts */}
        <ul className="grid grid-cols-2 gap-3">
          {axes.map((a) => (
            <li
              key={a.cat}
              className="rounded-md border border-border bg-background px-4 py-3"
            >
              <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-1">
                {a.label}
              </p>
              <p className="font-sans text-sm text-foreground/80">
                {a.notable > 0 ? (
                  <>
                    <span className="text-foreground tabular-nums">{a.notable}</span> standout
                    {" / "}
                    <span className="tabular-nums">{a.total}</span> markers
                  </>
                ) : (
                  <>
                    <span className="tabular-nums">{a.total}</span> markers · all typical
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
