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
  TIMELINE_ANCHORS,
  eraFor,
  timelinePos,
  type AncestryComponent,
  type Tribe,
  type CasteGroup,
} from "@/lib/dna-tribes"

const COMPS: AncestryComponent[] = ["AASI", "IRAN", "STEP", "EASI"]

/** Fmt a years-before-present into a short human age. */
function fmtAge(years: number): string {
  if (years >= 1000) {
    const k = years / 1000
    return `~${Number.isInteger(k) ? k : k.toFixed(1)}k yrs`
  }
  return `~${years} yrs`
}

/** Drift → a plain word for how isolated/bottlenecked the pool is. */
function driftWord(d: number): string {
  if (d >= 70) return "very strong"
  if (d >= 60) return "strong"
  if (d >= 50) return "moderate"
  return "mild"
}

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

  // caste / clan sub-groups of the selected community, oldest pool first.
  const castes = useMemo(
    () => [...(tribe?.castes ?? [])].sort((a, b) => b.endogamyYears - a.endogamyYears),
    [tribe],
  )

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

      {/* ── Caste / clan sub-pools + endogamy timeline ──────────────────────
          The deeper structure: WITHIN a community, endogamous jāti / clan
          groups are each their own closed pool. Ancestry proportion barely
          moves between them — what differs is how long, and how tightly, each
          has married within. Shown only when we have documented sub-groups. */}
      {castes.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex items-baseline gap-3 mb-1.5">
            <h4 className="font-display text-lg font-light">Inside {tribe.name}: the closed pools</h4>
            <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">jāti · clan · gotra</span>
          </div>
          <p className="font-sans text-sm text-foreground/70 leading-relaxed max-w-2xl mb-5">
            After ~2,000 years of marrying within, each jāti or clan is its own
            small gene pool — often as distinct from its neighbour as two
            separate nations, even in the same town. Ancestry mix barely changes;
            what changes is <em>how long the pool has been closed</em>. A small
            founder set plus long endogamy means members share long identical
            DNA segments — which concentrates recessive founder variants, the
            same reason Ashkenazi and Finnish carrier-screening exists. Below,
            each group is placed by when its endogamy began, with that
            shared-DNA / founder-health read where it&apos;s documented.
          </p>

          {/* the timeline */}
          <div className="rounded-xl border border-border bg-background/40 p-4 md:p-5">
            {/* era ruler — full set on desktop; a thinned set on phones so the
                labels never collide (the per-row dots carry the real detail). */}
            <div className="relative mb-1 h-4">
              {TIMELINE_ANCHORS.map((a, i) => {
                // on mobile show only every other anchor + always the ends.
                const sparse = i === 0 || i === TIMELINE_ANCHORS.length - 1 || i % 2 === 0
                return (
                  <span
                    key={a.years}
                    className={`absolute -translate-x-1/2 font-mono text-[8px] tracking-wider text-muted-foreground/70 whitespace-nowrap ${sparse ? "" : "hidden sm:inline"}`}
                    style={{ left: `${(1 - timelinePos(a.years)) * 100}%` }}
                  >
                    {a.label}
                  </span>
                )
              })}
            </div>
            <div className="relative h-px w-full bg-border" />
            {/* deep-past → today direction hint */}
            <div className="mt-1 flex justify-between font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
              <span>← deep past</span>
              <span>today →</span>
            </div>

            {/* one row per caste/clan group, dot placed on the ruler */}
            <ul className="mt-4 space-y-2.5">
              {castes.map((c) => {
                const era = eraFor(c.endogamyYears)
                const left = (1 - timelinePos(c.endogamyYears)) * 100
                return (
                  <li key={c.id} className="rounded-lg border border-border/70 bg-card/40 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-sans text-sm font-medium text-foreground">{c.name}</span>
                      <span className="font-mono text-[10px] text-foreground/55">{c.category}</span>
                    </div>
                    {/* mini age ruler for this group */}
                    <div className="relative mt-2 h-4">
                      <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/60" />
                      <span
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${left}%`,
                          // hotter = older & more drifted pool
                          background: `hsl(${Math.round(30 - Math.min(30, c.driftIndex / 3))}, 80%, ${Math.round(72 - c.driftIndex / 4)}%)`,
                        }}
                        title={`isolated ~${c.endogamyYears} yrs`}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                      <span className="font-mono text-[10px] text-accent">isolated {fmtAge(c.endogamyYears)} · since {c.since}</span>
                      <span className="font-mono text-[10px] text-foreground/55">{driftWord(c.driftIndex)} founder effect · {c.foundersEst}</span>
                    </div>
                    <p className="mt-1.5 font-sans text-[12px] text-foreground/70 leading-relaxed">{c.note}</p>
                    <p className="mt-1 font-sans text-[11px] italic text-foreground/50">
                      When the pool closed — {era.label}: {era.context}
                    </p>
                    {/* IBD / recessive-disease consequence of the closed pool —
                        the medically actionable payoff, framed as screening
                        awareness, never destiny. */}
                    {c.founderDisease && (
                      <div className="mt-2.5 rounded-md border border-[#c98a4a]/30 bg-[#c98a4a]/[0.07] px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[9px] tracking-widest uppercase text-[#d69a52]">
                            Shared-DNA · founder health
                          </span>
                          <span className="font-mono text-[9px] text-foreground/50">
                            IBD {c.founderDisease.ibd}
                          </span>
                        </div>
                        <p className="mt-1 font-sans text-[11px] text-foreground/70 leading-relaxed">
                          {c.founderDisease.note}
                        </p>
                        <p className="mt-1 font-sans text-[11px] text-foreground/55">
                          Reported / enriched: {c.founderDisease.conditions.join(" · ")}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="mt-3 font-mono text-[10px] tracking-wider text-muted-foreground/70">
            Founder-effect + endogamy reads after Nakatsuka et al. 2017 (Nat. Genet.) &amp; Reich et al. 2009 — many South-Asian groups carry a founder event stronger than the Ashkenazi or Finnish bottleneck · &ldquo;isolated since&rdquo; dates are approximate qpAdm-era estimates, illustrative not exact
          </p>
        </div>
      )}

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
