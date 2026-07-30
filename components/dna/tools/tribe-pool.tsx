/**
 * TribePool — the "surviving / shared gene pool" view.
 *
 * Pick a COMMUNITY (tribe / language group), not a country. See:
 *   • the deep ancestral components that make up its surviving pool (one bar),
 *   • the communities it SHARES the most ancestry with — usually the ones a
 *     modern border tries to divide,
 *   • all of it plotted on a small map so the continuous gradient is visible.
 *
 * Curated from public population genetics (see lib/dna-tribes.ts). Deliberately
 * simple + intuitive: one choice, one bar, one "shared with" list, one map.
 */

"use client"

import { useMemo, useState } from "react"
import {
  TRIBES,
  COMPONENT_META,
  closestTribes,
  tribeById,
  TRIBE_REGION_ORDER,
  type AncestryComponent,
  type Tribe,
} from "@/lib/dna-tribes"

const COMPS: AncestryComponent[] = ["AASI", "IRAN", "STEP", "EASI"]

/** equirectangular [lat,lng] → [x%,y%], zoomed to the South/Central-Asia window
 *  (lng 45–100, lat 3–42) so the communities aren't crammed into a world plate. */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - 45) / (100 - 45)) * 100
  const y = ((42 - lat) / (42 - 3)) * 100
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
}

/** One stacked ancestry bar for a tribe's mix. */
function MixBar({ tribe, compact = false }: { tribe: Tribe; compact?: boolean }) {
  return (
    <div>
      <div className={`flex ${compact ? "h-2.5" : "h-4"} w-full overflow-hidden rounded-full`}>
        {COMPS.map((c) => (
          <div
            key={c}
            style={{ width: `${tribe.mix[c]}%`, background: COMPONENT_META[c].color }}
            title={`${COMPONENT_META[c].label} · ${tribe.mix[c]}%`}
          />
        ))}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {COMPS.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 font-mono text-[10px] text-foreground/70">
              <span className="h-2 w-2 rounded-full" style={{ background: COMPONENT_META[c].color }} />
              {COMPONENT_META[c].label} · {tribe.mix[c]}%
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function TribePool() {
  const [tribeId, setTribeId] = useState<string>("punjabi")
  const tribe = useMemo(() => tribeById(tribeId), [tribeId])
  const shared = useMemo(() => closestTribes(tribeId, 5), [tribeId])

  // tribes grouped by region for a readable <optgroup> picker.
  const grouped = useMemo(() => {
    const byRegion = new Map<string, Tribe[]>()
    for (const t of TRIBES) {
      const arr = byRegion.get(t.region) ?? []
      arr.push(t)
      byRegion.set(t.region, arr)
    }
    return TRIBE_REGION_ORDER.filter((r) => byRegion.has(r)).map((r) => ({
      region: r,
      tribes: byRegion.get(r)!,
    }))
  }, [])

  // markers: the selected tribe (accent) + its top shared communities (soft).
  const sharedIds = new Set(shared.map((s) => s.tribe.id))

  if (!tribe) return null

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-7">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-display text-xl md:text-2xl font-light">The Surviving Pool</h3>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">what we share, not what divides</span>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-5">
        Ancestry is carried by <em>community</em> — tribe, language, region — not
        by borders. Pick a community and see the deep ancestral layers that make
        up its surviving gene pool, and the neighbours it shares that pool with.
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
        {/* left: picker + the pool */}
        <div>
          <label htmlFor="tribe-sel" className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">
            Community
          </label>
          <select
            id="tribe-sel"
            value={tribeId}
            onChange={(e) => setTribeId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {grouped.map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.tribes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <p className="mt-3 font-sans text-sm text-foreground/75 leading-relaxed">{tribe.blurb}</p>

          <div className="mt-4">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Surviving pool</div>
            <MixBar tribe={tribe} />
          </div>

          {/* shared-with list — the heart of the tool */}
          <div className="mt-5">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
              Shares the most ancestry with
            </div>
            <ul className="space-y-2">
              {shared.map(({ tribe: t, sharedPct }) => (
                <li key={t.id} className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-sm font-medium text-foreground">{t.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-accent">{sharedPct}% shared pool</span>
                  </div>
                  <div className="mt-1.5"><MixBar tribe={t} compact /></div>
                  <p className="mt-1 font-sans text-[11px] text-foreground/55">{t.region}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* right: the gradient map */}
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-[#070b14]">
          <div className="relative w-full" style={{ paddingBottom: "70%" }}>
            <svg viewBox="0 0 100 70" className="absolute inset-0 h-full w-full" aria-hidden>
              {[17.5, 35, 52.5].map((y) => (
                <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="currentColor" className="text-white/[0.06]" strokeWidth={0.2} />
              ))}
              {[25, 50, 75].map((x) => (
                <line key={x} x1={x} y1={0} x2={x} y2={70} stroke="currentColor" className="text-white/[0.06]" strokeWidth={0.2} />
              ))}
            </svg>
            {TRIBES.map((t) => {
              const p = project(t.at[0], t.at[1])
              const isSel = t.id === tribe.id
              const isShared = sharedIds.has(t.id)
              const dim = !isSel && !isShared
              return (
                <div
                  key={t.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: dim ? 0.35 : 1 }}
                  title={`${t.name} · ${t.region}`}
                >
                  <span className="relative flex items-center justify-center">
                    {isSel && (
                      <span className="absolute inline-flex h-4 w-4 rounded-full bg-accent opacity-50 motion-safe:animate-ping" />
                    )}
                    <span
                      className="relative inline-flex rounded-full"
                      style={{
                        height: isSel ? 11 : isShared ? 8 : 5,
                        width: isSel ? 11 : isShared ? 8 : 5,
                        background: isSel ? "var(--accent, #e0a34b)" : isShared ? "#9fd3cf" : "#5b6b7a",
                      }}
                    />
                  </span>
                  {(isSel || isShared) && (
                    <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] text-white/75">
                      {t.name}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/70">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent, #e0a34b)" }} /> selected
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/70">
              <span className="h-2 w-2 rounded-full bg-[#9fd3cf]" /> shares the pool
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-white/50">
              <span className="h-2 w-2 rounded-full bg-[#5b6b7a]" /> wider gradient
            </span>
          </div>
        </div>
      </div>

      {/* component key */}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {COMPS.map((c) => (
          <div key={c} className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: COMPONENT_META[c].color }} />
            <p className="font-sans text-[11px] text-foreground/60 leading-relaxed">
              <span className="font-medium text-foreground/80">{COMPONENT_META[c].label}.</span>{" "}
              {COMPONENT_META[c].note}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Component model after Narasimhan et al. 2019 (Science) &amp; Reich-lab ANI/ASI work · 1000 Genomes panels · illustrative reads of the published clines, not a per-person percentage · ancestry follows community, language and region, never modern borders
      </p>
    </div>
  )
}
