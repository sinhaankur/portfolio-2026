"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 *
 * TonightSky — the "what am I looking at tonight?" sky companion.
 *
 * The engine already draws the real sky; this answers the beginner's actual
 * question: *I'm standing outside right now — what's up there, and where do
 * I look?* Given the user's location (opt-in, never auto-requested), it runs
 * the same equatorial→horizontal transform an observatory's pointing computer
 * uses (lib/sky-position.ts, Meeus) to report which constellations are above
 * the horizon this instant, their altitude, compass bearing, and tonight's
 * rise/transit/set times. Real geometry, no invented data.
 *
 * Selecting a row highlights that asterism in the sky via the
 * `universe:highlight-constellation` event (the constellations layer listens).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { constellations, planetsData } from "./astronomy"
import type { Constellation, ConstellationId, Planet } from "./types"
import {
  altitudeBand,
  centroidRaDec,
  compassPoint,
  darknessWindow,
  equatorialToHorizontal,
  planetEquatorial,
  riseTransitSet,
  type DarknessWindow,
  type EquatorialCoord,
  type KeplerianElements,
  type Observer,
  type TwilightPhase,
} from "@/lib/sky-position"

type SkyKind = "planet" | "constellation"

interface SkyRow {
  id: string
  kind: SkyKind
  name: string
  designation: string
  fact: string
  coord: EquatorialCoord
  altitudeDeg: number
  azimuthDeg: number
  compass: string
  band: ReturnType<typeof altitudeBand>
}

/** Earth's elements — the observer's own orbit, differenced against each
 *  planet to get its geocentric direction. */
function earthElements(): KeplerianElements | null {
  return planetToElements(planetsData.find((p) => p.name === "Earth"))
}

/** Map a Planet record to the Keplerian element shape the ephemeris needs.
 *  Returns null if any orbital element is missing (honest — no guessing). */
function planetToElements(p?: Planet): KeplerianElements | null {
  if (!p || p.m0Deg === undefined || p.periDeg === undefined || p.longNodeDeg === undefined) return null
  const e = p.deep?.eccentricity
  if (e === undefined) return null
  return {
    aAU: p.aAU,
    eccentricity: e,
    inclDeg: p.inclDeg,
    longNodeDeg: p.longNodeDeg,
    periLonDeg: p.periDeg,
    m0Deg: p.m0Deg,
    periodDays: p.periodDays,
  }
}

/** The planets a naked-eye observer would actually look for (skip Earth;
 *  the outer ice giants + Pluto need optical aid but we still report them). */
const VISIBLE_PLANET_NAMES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]

/** Only the named, recognisable constellations make good "look up" targets —
 *  skip the faint IAU filler that carries no fact so the list stays legible. */
function targetConstellations(): Constellation[] {
  return constellations.filter(
    (c) => c.stars.length > 0 && c.fact && c.clickAction !== "reset-view",
  )
}

const BAND_LABEL: Record<ReturnType<typeof altitudeBand>, string> = {
  below: "below horizon",
  low: "low",
  mid: "mid-sky",
  high: "high",
  overhead: "near overhead",
}

/** Short local time like "9:48 PM", or "—" when the body doesn't rise/set. */
function fmtTime(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function TonightSky() {
  const [open, setOpen] = useState(false)
  const [observer, setObserver] = useState<Observer | null>(null)
  const [locState, setLocState] = useState<"idle" | "asking" | "denied" | "unavailable">("idle")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Tick drives the live recompute so altitudes update as the sky turns.
  const [tick, setTick] = useState(0)

  const targets = useMemo(() => targetConstellations(), [])
  // Constellation centroids are fixed (J2000) — compute once, reuse each tick.
  const centroids = useMemo(
    () => targets.map((c) => ({ c, coord: centroidRaDec(c.stars) })),
    [targets],
  )

  // Planets carry Keplerian elements → geocentric RA/Dec is recomputed each
  // tick (they move). Earth is the observer's own orbit, differenced out.
  const planets = useMemo(() => {
    const earth = earthElements()
    if (!earth) return []
    return VISIBLE_PLANET_NAMES.map((name) => {
      const p = planetsData.find((pd) => pd.name === name)
      const el = planetToElements(p)
      return el && p ? { name, designation: p.classification, fact: p.fact ?? "", el, earth } : null
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [])

  // Recompute the sky ~every 20s while open + located (it drifts ~0.25°/min).
  useEffect(() => {
    if (!open || !observer) return
    const id = setInterval(() => setTick((t) => t + 1), 20_000)
    return () => clearInterval(id)
  }, [open, observer])

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocState("unavailable")
      return
    }
    setLocState("asking")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObserver({ latDeg: pos.coords.latitude, lonDeg: pos.coords.longitude })
        setLocState("idle")
      },
      () => setLocState("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  // Build + sort the live list: planets + constellations, above-horizon first,
  // by descending altitude. Planets get their live geocentric RA/Dec first.
  const rows = useMemo<SkyRow[]>(() => {
    if (!observer) return []
    const now = new Date()

    const toRow = (
      id: string, kind: SkyKind, name: string, designation: string, fact: string, coord: EquatorialCoord,
    ): SkyRow => {
      const h = equatorialToHorizontal(coord, observer, now)
      return {
        id, kind, name, designation, fact, coord,
        altitudeDeg: h.altitudeDeg,
        azimuthDeg: h.azimuthDeg,
        compass: compassPoint(h.azimuthDeg),
        band: altitudeBand(h.altitudeDeg),
      }
    }

    const planetRows = planets.map((p) =>
      toRow(`planet:${p.name}`, "planet", p.name, p.designation, p.fact, planetEquatorial(p.el, p.earth, now)),
    )
    const constRows = centroids.map(({ c, coord }) =>
      toRow(`const:${c.id}`, "constellation", c.name, c.designation, c.fact, coord),
    )

    const out = [...planetRows, ...constRows]
    out.sort((a, b) => b.altitudeDeg - a.altitudeDeg)
    return out
    // `tick` is the recompute trigger: the 20s interval bumps it so the live
    // Date() read above re-runs and altitudes track the turning sky.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer, centroids, planets, tick])

  const upNow = rows.filter((r) => r.altitudeDeg > 0)

  // Twilight / darkness — is it dark enough to observe, and when does it get
  // dark? Recomputed on the same tick so the phase + countdown stay live.
  const darkness = useMemo<DarknessWindow | null>(() => {
    if (!observer) return null
    return darknessWindow(observer, new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer, tick])

  const highlightConstellation = useCallback((id: ConstellationId | null) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("universe:highlight-constellation", { detail: { id } }),
    )
  }, [])

  // Clear any highlight when the panel closes so the sky doesn't stay lit.
  const prevOpen = useRef(open)
  useEffect(() => {
    if (prevOpen.current && !open) highlightConstellation(null)
    prevOpen.current = open
  }, [open, highlightConstellation])

  const toggleRow = (r: SkyRow) => {
    const next = expandedId === r.id ? null : r.id
    setExpandedId(next)
    if (r.kind === "constellation") {
      // Light up the asterism (strip the "const:" prefix back to the raw id).
      highlightConstellation(next ? r.id.replace(/^const:/, "") : null)
    } else {
      // Planets have no asterism to highlight — clear any lit constellation.
      highlightConstellation(null)
    }
  }

  return (
    <div className="pointer-events-auto">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="
            inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
            border-foreground/25 bg-background/50 text-foreground/75
            hover:text-foreground hover:border-accent/60
            backdrop-blur-sm transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          <span aria-hidden className="text-[11px] leading-none">✧</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Tonight</span>
        </button>
      ) : (
        <div
          className="
            w-[min(88vw,20rem)] max-h-[62vh] overflow-hidden flex flex-col
            rounded-2xl border border-foreground/20 bg-background/80 backdrop-blur-md
            shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]
          "
          role="group"
          aria-label="Tonight's sky"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-foreground/12">
            <div>
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-accent">Tonight's sky</p>
              <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-foreground/45">
                {observer
                  ? `${upNow.length} up now · ${observer.latDeg.toFixed(1)}°, ${observer.lonDeg.toFixed(1)}°`
                  : "above your horizon, right now"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close tonight's sky"
              className="grid h-7 w-7 place-items-center rounded-full text-foreground/55 hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0"
            >
              <span aria-hidden className="text-sm leading-none">×</span>
            </button>
          </div>

          {/* Body */}
          {!observer ? (
            <div className="px-4 py-5 flex flex-col gap-3">
              <p className="font-sans text-[12px] leading-relaxed text-foreground/70">
                Share your location and I&apos;ll compute exactly which planets and
                constellations are above your horizon this second — altitude, compass
                bearing, and tonight&apos;s rise &amp; set times. The same math a
                telescope mount runs.
              </p>
              <button
                type="button"
                onClick={requestLocation}
                disabled={locState === "asking"}
                className="
                  self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-full border
                  border-accent/60 bg-accent/10 text-accent
                  hover:bg-accent/15 transition-colors
                  disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
                  {locState === "asking" ? "Locating…" : "Use my location"}
                </span>
              </button>
              {locState === "denied" && (
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/45">
                  Location denied — enable it in your browser to see your sky.
                </p>
              )}
              {locState === "unavailable" && (
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/45">
                  Geolocation isn&apos;t available in this browser.
                </p>
              )}
              <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-foreground/35 leading-relaxed">
                Location stays on your device — used only to compute the transform, never sent anywhere.
              </p>
            </div>
          ) : (
            <>
              {darkness && <DarknessBanner d={darkness} />}
              <ul className="overflow-y-auto px-1.5 py-1.5 [scrollbar-width:thin]">
              {rows.map((r) => {
                const isUp = r.altitudeDeg > 0
                const expanded = expandedId === r.id
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggleRow(r)}
                      aria-expanded={expanded}
                      className={`
                        w-full text-left px-2.5 py-2 rounded-lg transition-colors
                        ${expanded ? "bg-foreground/10" : "hover:bg-foreground/[0.06]"}
                        ${isUp ? "" : "opacity-45"}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                      `}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-1.5 min-w-0">
                          {r.kind === "planet" && (
                            <span
                              aria-hidden
                              className="inline-block h-1.5 w-1.5 rounded-full bg-accent shrink-0 translate-y-[-1px]"
                            />
                          )}
                          <span className="font-sans text-[13px] text-foreground/90 truncate">
                            {r.name}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-foreground/60 shrink-0">
                          {isUp ? `${Math.round(r.altitudeDeg)}° ${r.compass}` : "below"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/40">
                        {r.kind === "planet" ? "Planet · " : ""}
                        {isUp ? BAND_LABEL[r.band] : "not up right now"}
                      </div>

                      {expanded && (
                        <RowDetail row={r} observer={observer} />
                      )}
                    </button>
                  </li>
                )
              })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const PHASE_LABEL: Record<TwilightPhase, string> = {
  day: "Daytime",
  civil: "Civil twilight",
  nautical: "Nautical twilight",
  astronomical: "Astronomical twilight",
  night: "Full darkness",
}

/** How lit the sky is 0..1, for the banner's gradient dot (day → dark). */
function phaseGlow(phase: TwilightPhase): string {
  switch (phase) {
    case "day": return "#ffd27a"
    case "civil": return "#ff9a6b"
    case "nautical": return "#7a86c8"
    case "astronomical": return "#3a4a8a"
    default: return "#1a2352"
  }
}

/**
 * Darkness banner — the observer's actual "is it dark yet?" answer. Leads with
 * the twilight phase + Sun altitude, then the single most useful next event:
 * sunset while it's day, when astronomical dark begins during twilight, or
 * "dark until sunrise" once it's genuinely dark.
 */
function DarknessBanner({ d }: { d: DarknessWindow }) {
  let lead: string
  if (d.phase === "day") {
    lead = d.sunset ? `Sunset ${fmtTime(d.sunset)}` : "Sun is up"
  } else if (d.isDark) {
    lead = d.darkEnd ? `Dark until ${fmtTime(d.darkEnd)}` : "Dark now"
  } else {
    // In twilight: how much longer until full (astronomical) darkness.
    lead = d.darkStart ? `Dark at ${fmtTime(d.darkStart)}` : `Doesn't fully darken`
  }
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-foreground/10 bg-foreground/[0.03]">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/10"
        style={{ background: phaseGlow(d.phase) }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-foreground/85 truncate">
          {PHASE_LABEL[d.phase]}
          {d.isDark && <span className="text-accent"> · best viewing</span>}
        </p>
        <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-foreground/45 tabular-nums">
          Sun {d.sunAltitudeDeg >= 0 ? "+" : ""}{d.sunAltitudeDeg.toFixed(1)}° · {lead}
        </p>
      </div>
    </div>
  )
}

/** The expanded row: real rise/transit/set + the constellation fact. */
function RowDetail({ row, observer }: { row: SkyRow; observer: Observer }) {
  const rts = useMemo(
    () => riseTransitSet(row.coord, observer, new Date()),
    [row.coord, observer],
  )
  return (
    <div className="mt-2 pt-2 border-t border-foreground/10">
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 font-mono text-[9px]">
        {rts.circumstance === "circumpolar" ? (
          <div className="col-span-3 text-accent/80 tracking-[0.14em] uppercase">
            Circumpolar — up all night
          </div>
        ) : rts.circumstance === "never" ? (
          <div className="col-span-3 text-foreground/45 tracking-[0.14em] uppercase">
            Never rises from your latitude
          </div>
        ) : (
          <>
            <TimeCell label="Rises" value={fmtTime(rts.rise)} />
            <TimeCell label="Highest" value={fmtTime(rts.transit)} />
            <TimeCell label="Sets" value={fmtTime(rts.set)} />
          </>
        )}
        <div className="col-span-3 mt-0.5">
          <span className="text-foreground/40 tracking-[0.14em] uppercase">Peaks at </span>
          <span className="text-foreground/75 tabular-nums">{Math.round(rts.transitAltitudeDeg)}° up</span>
        </div>
      </dl>
      {row.fact && (
        <p className="mt-2 font-sans text-[11px] leading-snug text-foreground/60">{row.fact}</p>
      )}
      {row.kind === "planet" ? (
        <p className="mt-1.5 font-mono text-[8px] tracking-[0.14em] uppercase text-foreground/40">
          Position computed live from JPL orbital elements
        </p>
      ) : (
        <p className="mt-1.5 font-mono text-[8px] tracking-[0.14em] uppercase text-accent/70">
          Tap again to un-highlight
        </p>
      )}
    </div>
  )
}

function TimeCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-foreground/40 tracking-[0.14em] uppercase">{label}</div>
      <div className="text-foreground/85 tabular-nums text-[10px]">{value}</div>
    </div>
  )
}
