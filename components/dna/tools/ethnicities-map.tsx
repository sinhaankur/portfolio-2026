/**
 * EthnicitiesMap — "which ancestries are common where, and where is each common".
 * Two lenses over the same coarse public reference (lib/dna-ethnicities.ts):
 *   • pick a REGION → the ancestry groups most common there
 *   • pick an ANCESTRY → the regions where it's concentrated (plotted on a map)
 *
 * Public + educational; deliberately continental-scale (the resolution
 * population genetics supports), never a precise per-person claim.
 */

"use client"

import { useMemo, useState } from "react"
import {
  ETHNICITY_GROUPS,
  REGIONS,
  regionsForGroup,
  groupById,
  type RegionEntry,
} from "@/lib/dna-ethnicities"

/** equirectangular [lat,lng] → [x%,y%] on a 2:1 world plate. */
function project(lat: number, lng: number): { x: number; y: number } {
  return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 }
}

export function EthnicitiesMap() {
  const [mode, setMode] = useState<"region" | "ancestry">("region")
  const [regionId, setRegionId] = useState<string>("in")
  const [groupId, setGroupId] = useState<string>("south-asian")

  const region = useMemo<RegionEntry | undefined>(
    () => REGIONS.find((r) => r.id === regionId),
    [regionId],
  )
  const groupRegions = useMemo(() => regionsForGroup(groupId), [groupId])

  // markers to plot: in region-mode, the selected region; in ancestry-mode, all
  // regions where the group is common.
  const markers = mode === "region" ? (region ? [region] : []) : groupRegions

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-7">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-display text-xl md:text-2xl font-light">Ethnicities Map</h3>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">who&apos;s common where</span>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-5">
        A coarse, continental-scale view of which ancestries cluster where — the
        resolution population genetics actually supports. Explore by region, or by
        ancestry.
      </p>

      {/* mode toggle */}
      <div className="mb-5 inline-flex rounded-full border border-border p-0.5">
        {(["region", "ancestry"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            data-cursor-hover
            className={`rounded-full px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${
              mode === m ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "region" ? "By region" : "By ancestry"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
        {/* left: selector + result list */}
        <div>
          {mode === "region" ? (
            <>
              <label htmlFor="region-sel" className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Region</label>
              <select
                id="region-sel"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.region}</option>
                ))}
              </select>
              <ul className="mt-4 space-y-2.5">
                {region?.groups.map((gid, i) => {
                  const g = groupById(gid)
                  if (!g) return null
                  return (
                    <li key={gid} className="rounded-xl border border-border bg-background/40 px-4 py-3">
                      <div className="flex items-baseline gap-2">
                        {i === 0 && <span className="font-mono text-[9px] uppercase tracking-widest text-accent">most common</span>}
                        <span className="font-sans text-sm font-medium text-foreground">{g.label}</span>
                      </div>
                      <p className="mt-1 font-sans text-xs text-foreground/65 leading-relaxed">{g.blurb}</p>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <>
              <label htmlFor="anc-sel" className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Ancestry</label>
              <select
                id="anc-sel"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-sans text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {ETHNICITY_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <p className="mt-3 font-sans text-sm text-foreground/75 leading-relaxed">
                {groupById(groupId)?.blurb}
              </p>
              <div className="mt-4 font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Concentrated in</div>
              <ul className="flex flex-wrap gap-2">
                {groupRegions.length > 0 ? groupRegions.map((r) => (
                  <li key={r.id} className="rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[11px] text-foreground/80">
                    {r.region}
                  </li>
                )) : (
                  <li className="font-sans text-sm text-muted-foreground italic">Widely dispersed / diaspora.</li>
                )}
                {groupById(groupId)?.homelands.map((h) => (
                  <li key={h} className="rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1 font-mono text-[11px] text-accent/90">
                    {h}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* right: the map plate with markers */}
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-[#070b14]">
          <div className="relative w-full" style={{ paddingBottom: "50%" }}>
            {/* simple graticule */}
            <svg viewBox="0 0 360 180" className="absolute inset-0 h-full w-full" aria-hidden>
              {[30, 60, 90, 120, 150].map((y) => (
                <line key={y} x1={0} y1={y} x2={360} y2={y} stroke="currentColor" className="text-white/[0.06]" strokeWidth={0.5} />
              ))}
              {[60, 120, 180, 240, 300].map((x) => (
                <line key={x} x1={x} y1={0} x2={x} y2={180} stroke="currentColor" className="text-white/[0.06]" strokeWidth={0.5} />
              ))}
              <line x1={0} y1={90} x2={360} y2={90} stroke="currentColor" className="text-accent/25" strokeWidth={0.7} />
            </svg>
            {markers.map((r) => {
              const p = project(r.at[0], r.at[1])
              return (
                <div
                  key={r.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  title={r.region}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                  </span>
                  <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] text-white/70">
                    {r.region}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="mt-5 font-mono text-[10px] tracking-wider text-muted-foreground/80">
        Continental-scale groupings from public population genetics · illustrative, not a per-person percentage · ancestry clusters, not nationalities — real structure follows community, language and region, not modern borders
      </p>
    </div>
  )
}
