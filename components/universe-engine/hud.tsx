"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Universe Engine — HUD overlays.
 *
 * Plain DOM elements that sit on top of the R3F <Canvas>. Token-driven
 * (text-foreground / bg-background) so they track the surrounding theme
 * scope — the engine ships dark by default but flips with the page theme
 * if a consumer wraps it in a light scope.
 */

import { SAT_GROUPS, satGroupFilterRef } from "./satellite-field"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BodyDeepFacts, BodyInfo } from "./types"
import {
  DAY_MS,
  REAL_NOW_MS,
  TIMELINE_RANGE_YEARS,
  TIMELINE_WAYPOINTS,
  YEAR_MS,
  followRef,
  getSimMs,
  jumpToNow,
  setSimMs,
  simTimeRef,
  timeWarpRef,
} from "./astronomy"

/** Format a mass given in Earth-masses into a readable string.
 *  Small bodies (< 0.01 Earth) get scientific notation; Earth-and-up
 *  get a clean decimal. */
function formatMassEarth(m: number): string {
  if (m < 0.01) return `${m.toExponential(2)} × Earth`
  if (m < 1) return `${m.toFixed(3)} × Earth`
  if (m < 10) return `${m.toFixed(2)} × Earth`
  return `${m.toFixed(1)} × Earth`
}

/** Round-trip a hyperbolic eccentricity (escape trajectory, e ≈ 1.00001)
 *  to a readable label rather than printing "1.000". */
function formatEccentricity(e: number): string {
  if (e >= 1) return "≈ 1 (escape)"
  if (e < 0.005) return e.toFixed(3)
  return e.toFixed(3)
}

function formatGravityValue(value: number, unit = "m/s²"): string {
  if (!Number.isFinite(value)) return unit
  const abs = Math.abs(value)
  const display = abs >= 1000 || abs < 0.1 ? value.toExponential(2) : value.toFixed(2)
  return `${display} ${unit}`
}

function formatGee(value: number): string {
  const gee = value / 9.80665
  const abs = Math.abs(gee)
  const display = abs >= 1000 || abs < 0.1 ? gee.toExponential(2) : gee.toFixed(2)
  return `${display} g`
}

/** Whether an orbital-elements record has any field worth displaying.
 *  Used to skip rendering the orbital block for circular Earth-like
 *  orbits where every field is either undefined or zero. */
function hasOrbitalDetail(o: NonNullable<BodyInfo["orbital"]>): boolean {
  return (
    (o.eccentricity !== undefined && o.eccentricity > 0) ||
    (o.inclDeg !== undefined && o.inclDeg !== 0) ||
    (o.longNodeDeg !== undefined && o.longNodeDeg !== 0) ||
    (o.argPeriDeg !== undefined && o.argPeriDeg !== 0)
  )
}

/** Shared rendering of orbital elements (i / e / Ω / ω). Used by the
 *  desktop InfoPanel and the mobile bottom sheet so both surfaces show
 *  the same numbers in the same layout. */
export function OrbitalElements({
  orbital,
  variant = "panel",
}: {
  orbital?: BodyInfo["orbital"]
  variant?: "panel" | "sheet"
}) {
  if (!orbital || !hasOrbitalDetail(orbital)) return null
  const isSheet = variant === "sheet"
  const gridClass = isSheet
    ? "mt-4 pt-3 border-t border-border grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs"
    : "mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-sans text-[10px]"
  const labelClass = isSheet ? "text-foreground/55 shrink-0" : "text-foreground/55"
  const valueClass = isSheet
    ? "text-foreground/85 tabular-nums"
    : "text-right text-foreground/85 tabular-nums"
  return (
    <dl className={gridClass}>
      {orbital.eccentricity !== undefined && orbital.eccentricity > 0 && (
        <>
          <dt className={labelClass}>eccentricity</dt>
          <dd className={valueClass}>{formatEccentricity(orbital.eccentricity)}</dd>
        </>
      )}
      {orbital.inclDeg !== undefined && orbital.inclDeg !== 0 && (
        <>
          <dt className={labelClass}>inclination</dt>
          <dd className={valueClass}>{orbital.inclDeg.toFixed(1)}°</dd>
        </>
      )}
      {orbital.longNodeDeg !== undefined && orbital.longNodeDeg !== 0 && (
        <>
          <dt className={labelClass}>Ω asc. node</dt>
          <dd className={valueClass}>{orbital.longNodeDeg.toFixed(1)}°</dd>
        </>
      )}
      {orbital.argPeriDeg !== undefined && orbital.argPeriDeg !== 0 && (
        <>
          <dt className={labelClass}>ω peri-arg</dt>
          <dd className={valueClass}>{orbital.argPeriDeg.toFixed(1)}°</dd>
        </>
      )}
      {orbital.elementsEpoch && (
        <>
          <dt className={`${labelClass} italic`}>snapshot</dt>
          <dd className={`${valueClass} opacity-70`}>{orbital.elementsEpoch}</dd>
        </>
      )}
    </dl>
  )
}

/** Shared disclosure used by both the desktop InfoPanel and the mobile
 *  bottom sheet. Surfaces NASA Planetary Fact Sheet data behind a small
 *  "More" toggle so the default panel stays light. Reset via React key
 *  when the user moves to a different body. */
export function DeepFactsDisclosure({
  deep,
  variant = "panel",
}: {
  deep?: BodyDeepFacts
  /** "panel" (compact, mono) for the desktop hover panel; "sheet" (larger,
   *  more breathing room) for the mobile bottom sheet. */
  variant?: "panel" | "sheet"
}) {
  const [open, setOpen] = useState(false)
  if (!deep) return null
  const hasAny =
    deep.massEarth !== undefined ||
    deep.densityGcc !== undefined ||
    deep.gravity !== undefined ||
    deep.escapeVelocityKms !== undefined ||
    deep.eccentricity !== undefined ||
    deep.discoveredYear !== undefined ||
    deep.atmosphere !== undefined ||
    deep.composition !== undefined
  if (!hasAny) return null

  const isSheet = variant === "sheet"
  const focusClass = "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  const toggleClass = isSheet
    ? `font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/65 hover:text-foreground transition-colors min-h-9 inline-flex items-center px-2 -mx-2 ${focusClass}`
    : `font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/55 hover:text-foreground transition-colors px-1.5 -mx-1.5 py-1 -my-1 ${focusClass}`

  // A metric row with a label, value, and an optional comparative mini-bar
  // (0..1 fill) so magnitudes read at a glance — reverent, not a dashboard.
  const Metric = ({ label, value, bar }: { label: string; value: string; bar?: number }) => (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
      <dt className={`font-mono uppercase tracking-wider text-foreground/45 ${isSheet ? "text-[10px]" : "text-[9px]"}`}>{label}</dt>
      <dd className={`text-right tabular-nums text-foreground/90 ${isSheet ? "text-sm" : "text-[11px]"}`}>{value}</dd>
      {bar !== undefined && (
        <div className="col-span-2 mt-0.5 h-[2px] w-full overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }} />
        </div>
      )}
    </div>
  )
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className={`font-mono uppercase tracking-[0.3em] text-foreground/35 ${isSheet ? "text-[9px]" : "text-[8px]"}`}>{children}</p>
  )

  const hasPhysical = deep.massEarth !== undefined || deep.densityGcc !== undefined || deep.gravity !== undefined || deep.escapeVelocityKms !== undefined
  const hasOrbital = deep.eccentricity !== undefined || deep.discoveredYear !== undefined

  return (
    <div className={isSheet ? "mt-4 pt-3 border-t border-border" : "mt-3 pointer-events-auto"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={toggleClass}
      >
        {open ? "− Less" : "+ More data"}
      </button>

      {open && (
        <div className={`${isSheet ? "mt-3 space-y-4" : "mt-2.5 space-y-3"}`}>
          {hasPhysical && (
            <section className="space-y-1.5">
              <SectionLabel>Physical</SectionLabel>
              <dl className="space-y-1.5">
                {deep.massEarth !== undefined && (
                  // log-scaled bar: Earth(1)→mid; spans tiny moons → gas giants
                  <Metric label="Mass" value={formatMassEarth(deep.massEarth)} bar={(Math.log10(deep.massEarth) + 3) / 6} />
                )}
                {deep.densityGcc !== undefined && (
                  <Metric label="Density" value={`${deep.densityGcc.toFixed(2)} g/cm³`} bar={deep.densityGcc / 6} />
                )}
                {deep.gravity !== undefined && (
                  // bar relative to Earth gravity (9.81 m/s²)
                  <Metric label="Gravity" value={`${formatGravityValue(deep.gravity)} · ${formatGee(deep.gravity)}`} bar={deep.gravity / 25} />
                )}
                {deep.escapeVelocityKms !== undefined && (
                  <Metric label="Escape velocity" value={`${deep.escapeVelocityKms.toFixed(2)} km/s`} bar={deep.escapeVelocityKms / 60} />
                )}
              </dl>
            </section>
          )}
          {(deep.atmosphere !== undefined || deep.composition !== undefined) && (
            <section className="space-y-1.5">
              <SectionLabel>Made of</SectionLabel>
              <dl className="space-y-1.5">
                {deep.atmosphere !== undefined && (
                  <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
                    <dt className={`font-mono uppercase tracking-wider text-foreground/45 ${isSheet ? "text-[10px]" : "text-[9px]"}`}>Atmosphere</dt>
                    <dd className={`text-right text-foreground/90 ${isSheet ? "text-sm" : "text-[11px]"}`}>{deep.atmosphere}</dd>
                  </div>
                )}
                {deep.composition !== undefined && (
                  <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3">
                    <dt className={`font-mono uppercase tracking-wider text-foreground/45 ${isSheet ? "text-[10px]" : "text-[9px]"}`}>Structure</dt>
                    <dd className={`text-right text-foreground/90 ${isSheet ? "text-sm" : "text-[11px]"}`}>{deep.composition}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          {hasOrbital && (
            <section className="space-y-1.5">
              <SectionLabel>Orbit · Discovery</SectionLabel>
              <dl className="space-y-1.5">
                {deep.eccentricity !== undefined && (
                  <Metric label="Eccentricity" value={deep.eccentricity.toFixed(3)} bar={deep.eccentricity} />
                )}
                {deep.discoveredYear !== undefined && (
                  <Metric
                    label="Discovered"
                    value={`${deep.discoveredYear}${deep.discoveredBy ? ` · ${deep.discoveredBy}` : ""}`}
                  />
                )}
              </dl>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export function InfoPanel({ info, hideIdle = false }: { info: BodyInfo | null; hideIdle?: boolean }) {
  if (!info) {
    // On the celestial explorer the idle prompt is pure clutter (you explore via
    // search + the body rail, not a hover hint) and it overlapped the Following
    // banner — suppress it there, but still show real data on hover.
    if (hideIdle) return null
    return (
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/45 pointer-events-none space-y-2">
        <div>Hover any body for data</div>
        {/* Idle-state credit — visible to anyone exploring the engine but
            tucked under the prompt so it never crowds the data panel.
            Disappears the moment a body is hovered. */}
        <div className="text-[9px] tracking-[0.2em] text-foreground/30">
          Universe Engine · © Ankur Sinha 2026
        </div>
      </div>
    )
  }

  const k = info.surfaceTempK
  const c = info.surfaceTempC

  const isStar =
    info.apparentMag !== undefined ||
    info.spectralType !== undefined ||
    info.distanceLy !== undefined

  return (
    <div className="font-mono text-[11px] text-foreground/90 leading-relaxed pointer-events-none">
      <div className="text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-1">
        {info.classification}
      </div>
      <div className="text-base font-sans tracking-tight text-foreground mb-2">
        {info.name}
      </div>

      {/* Star data block — NASA-style compact readout */}
      {isStar && (
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
          {info.apparentMag !== undefined && (
            <>
              <span className="text-foreground/55">Apparent mag</span>
              <span className="text-foreground/85 tabular-nums">{info.apparentMag.toFixed(2)} V</span>
            </>
          )}
          {info.distanceLy !== undefined && (
            <>
              <span className="text-foreground/55">Distance</span>
              <span className="text-foreground/85 tabular-nums">{info.distanceLy.toFixed(1)} ly</span>
            </>
          )}
          {info.spectralType !== undefined && (
            <>
              <span className="text-foreground/55">Spectral type</span>
              <span className="text-foreground/85">{info.spectralType}</span>
            </>
          )}
          {info.catalogDesignation !== undefined && (
            <>
              <span className="text-foreground/55">Catalog</span>
              <span className="text-foreground/85">{info.catalogDesignation}</span>
            </>
          )}
        </div>
      )}

      {/* Non-star planetary data */}
      {!isStar && k && (
        <div>
          <span className="text-foreground/55">Surface temp · </span>
          {k.min !== undefined && k.max !== undefined ? (
            <>
              {k.min}–{k.max} K
            </>
          ) : (
            <>{k.mean} K</>
          )}
          {c && <span className="text-foreground/55"> ({c.mean}°C avg)</span>}
        </div>
      )}

      {!isStar && info.aAU !== undefined && (
        <div>
          <span className="text-foreground/55">Orbit · </span>
          {info.aAU.toFixed(2)} AU · {Math.round(info.periodDays ?? 0).toLocaleString()} days
        </div>
      )}

      {!isStar && info.rotHours !== undefined && (
        <div>
          <span className="text-foreground/55">Day · </span>
          {Math.abs(info.rotHours) < 100
            ? `${Math.abs(info.rotHours).toFixed(1)} h${info.rotHours < 0 ? " (retrograde)" : ""}`
            : `${(Math.abs(info.rotHours) / 24).toFixed(0)} days${info.rotHours < 0 ? " (retrograde)" : ""}`}
        </div>
      )}

      {!isStar && info.tiltDeg !== undefined && (
        <div>
          <span className="text-foreground/55">Axial tilt · </span>
          {info.tiltDeg.toFixed(1)}°
        </div>
      )}

      {!isStar && info.radiusEarth !== undefined && (
        <div>
          <span className="text-foreground/55">Radius · </span>
          {info.radiusEarth.toFixed(2)} × Earth
        </div>
      )}

      {info.gravityMeasurement && (
        <div>
          <span className="text-foreground/55">{info.gravityMeasurement.label} · </span>
          {info.gravityMeasurement.value !== undefined ? (
            <>
              {formatGravityValue(info.gravityMeasurement.value, info.gravityMeasurement.unit ?? "m/s²")}
              <span className="text-foreground/55"> ({formatGee(info.gravityMeasurement.value)})</span>
            </>
          ) : (
            <>{info.gravityMeasurement.note}</>
          )}
        </div>
      )}

      {!isStar && info.moons !== undefined && info.moons > 0 && (
        <div>
          <span className="text-foreground/55">Moons · </span>
          {info.moons}
        </div>
      )}

      {info.fact && (
        <div className="mt-2 max-w-xs text-foreground/75 font-sans text-[12px] leading-snug">
          {info.fact}
        </div>
      )}

      {/* Deeper NASA Planetary Fact Sheet data — hidden by default so the
          panel stays glanceable. Keyed on name so the disclosure resets
          collapsed whenever the user hovers a different body. */}
      <DeepFactsDisclosure key={info.name} deep={info.deep} variant="panel" />

      {/* Orbital elements — surfaced for comets, asteroids, spacecraft,
          dwarfs. Fully describes the 3D orbit (i / e / Ω / ω) for the
          curious; planets use the deep facts disclosure above instead. */}
      <OrbitalElements orbital={info.orbital} variant="panel" />

      {info.clickable && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.25em] uppercase text-cyan-100/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-300/80 animate-pulse" />
          Click to interact
        </div>
      )}

      {info.followable && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/60">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/55" />
          Click to track its orbit
        </div>
      )}
    </div>
  )
}

/** Available playback speeds (days of sim-time per second of real time,
 *  as a multiplier on the base TIME_WARP_DAYS_PER_SEC). The transport
 *  remembers the last non-zero magnitude so Play resumes at the chosen
 *  speed and Reverse flips its sign.
 *
 *  LIVE = real-time: 1 simulated second per real second. As a multiplier on
 *  TIME_WARP_DAYS_PER_SEC (= 365.25/24 days/sec at 1×) that's
 *  (1/86400) / (365.25/24) ≈ 7.6e-7 — the sky moves exactly as it does right
 *  now. Used for the satellite explorer's "watch it live" mode. */
const LIVE_SPEED = (1 / 86400) / (365.25 / 24)
const SPEED_STEPS = [LIVE_SPEED, 0.25, 1, 4, 20, 100] as const

/** Label a speed step: "LIVE" for real-time, else "N×" sim-days/sec feel. */
function speedLabel(s: number): string {
  if (s === LIVE_SPEED) return "LIVE"
  return `${s}×`
}

// Short local timezone abbreviation (e.g. "EDT", "IST", "GMT+8") from the
// browser — so the readout is anchored to the USER's actual location/timezone
// rather than a hard-coded UTC. Falls back to "UTC" where unavailable (SSR).
function localTzAbbrev(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(d)
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC"
  } catch {
    return "UTC"
  }
}

function formatSimDate(ms: number): { date: string; time: string } {
  const d = new Date(ms)
  // Local-time readout: the scene runs at the user's real "now", so show it in
  // THEIR timezone (detected from the browser), not UTC.
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase()
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const time = `${hh}:${mm} ${localTzAbbrev(d)}`
  return { date: `${month} ${day} · ${d.getFullYear()}`, time }
}

/**
 * Date readout — surfaces the current simulation date. Reads `simMs`
 * (the absolute, scrubbable simulation instant) at ~5 Hz. Kept as a
 * standalone pill for compact desktop placements; the full TimelineControl
 * below embeds its own readout.
 */
export function DateReadout() {
  const [dateStr, setDateStr] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      setDateStr(formatSimDate(simTimeRef.current.simMs).date)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])
  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 border border-foreground/25 rounded-full bg-background/50 backdrop-blur-sm">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/70">
        Date
      </span>
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-foreground/90 tabular-nums">
        {dateStr ?? "—"}
      </span>
    </div>
  )
}

/* ============================================================
 * TimelineControl — the date-first time machine.
 *
 * One panel that owns the whole clock: a live date readout, a
 * scrubber that maps a ±TIMELINE_RANGE_YEARS window onto an absolute
 * simMs, a transport (reverse / pause / play), a speed cycler, a Today
 * reset, and a waypoints popover that jumps to iconic moments and frames
 * the relevant body. Writing the scrubber sets simMs directly; the
 * SceneClock advances it during playback. Because every body is a pure
 * function of simMs, dragging here moves the entire solar system to its
 * true configuration for that instant.
 * ============================================================ */
export function TimelineControl({ hideSpeed = false }: { hideSpeed?: boolean } = {}) {
  // Slider position is a normalised offset in [-1, 1] around REAL_NOW_MS;
  // we convert to/from absolute simMs. We hold the displayed date in state
  // (polled), but the slider itself is uncontrolled-feeling: while dragging
  // we write simMs immediately and reflect it back.
  const [simMs, setSimMsState] = useState<number>(() => getSimMs())
  const [warp, setWarp] = useState<number>(() => timeWarpRef.current)
  const [speedIdx, setSpeedIdx] = useState<number>(2) // default 1× (index 0=LIVE, 1=0.25×)
  const [waypointsOpen, setWaypointsOpen] = useState(false)
  const draggingRef = useRef(false)
  // Self-detect follow mode so BOTH mount sites (desktop engine + mobile time
  // sheet) hide the speed cycler while a body is followed — the Following
  // banner's ride chips own the speed then. Polls the same followRef the banner
  // does. The hideSpeed prop is an explicit override on top of this.
  const [following, setFollowing] = useState(() => followRef.current != null)
  useEffect(() => {
    const id = setInterval(() => setFollowing(followRef.current != null), 200)
    return () => clearInterval(id)
  }, [])
  const speedHidden = hideSpeed || following

  // Poll the clock so the readout + slider track playback without a
  // per-frame React re-render. While the user is dragging we own simMs, so
  // skip the poll-write to avoid fighting the input.
  useEffect(() => {
    const id = setInterval(() => {
      if (draggingRef.current) return
      setSimMsState(getSimMs())
      setWarp(timeWarpRef.current)
    }, 120)
    return () => clearInterval(id)
  }, [])

  const rangeMs = TIMELINE_RANGE_YEARS * YEAR_MS
  const sliderValue = (simMs - REAL_NOW_MS) / rangeMs // [-1, 1]

  const onScrub = useCallback((norm: number) => {
    const ms = REAL_NOW_MS + norm * rangeMs
    setSimMs(ms)
    setSimMsState(ms)
  }, [rangeMs])

  const applyWarp = useCallback((v: number) => {
    timeWarpRef.current = v
    setWarp(v)
  }, [])

  const playing = warp !== 0
  const reversed = warp < 0
  const speed = SPEED_STEPS[speedIdx]

  const togglePlay = () => applyWarp(playing ? 0 : (reversed ? -speed : speed))
  const toggleReverse = () => applyWarp(playing ? -warp : -speed)
  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEED_STEPS.length
    setSpeedIdx(next)
    if (playing) applyWarp((reversed ? -1 : 1) * SPEED_STEPS[next])
  }
  const today = () => {
    jumpToNow()
    const ms = getSimMs()
    setSimMsState(ms)
    applyWarp(0)
  }

  const jumpToWaypoint = (iso: string, body?: string, bodyKind?: "planet" | "named") => {
    const ms = Date.parse(iso)
    if (!Number.isNaN(ms)) {
      setSimMs(ms)
      setSimMsState(ms)
      applyWarp(0)
    }
    setWaypointsOpen(false)
    if (body && typeof window !== "undefined") {
      // Give the scene a couple of frames to reposition the body to its new
      // date, then ask the scene to frame it via the focus channel. Planets
      // listen on "planet:<name>"; comets/dwarfs on "named:<name>".
      const prefix = bodyKind === "named" ? "named" : "planet"
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("universe:sky-focus", { detail: { pointId: `${prefix}:${body}` } }),
        )
      }, 80)
    }
  }

  const { date, time } = formatSimDate(simMs)
  const isToday = Math.abs(simMs - Date.now()) < DAY_MS
  // Honesty caveat: satellite positions propagate TODAY'S catalogue. Scrubbed
  // into the past, craft that have since decayed aren't shown (we only have
  // current TLEs); scrubbed far forward, atmospheric-drag decay isn't modeled.
  // Label the limit rather than fake the data.
  const farFromNow = Math.abs(simMs - Date.now()) > 30 * DAY_MS

  return (
    <div
      className="
        pointer-events-auto flex flex-col gap-2
        w-[min(92vw,30rem)] px-4 py-3
        border border-foreground/25 rounded-2xl
        bg-background/60 backdrop-blur-md
      "
      role="group"
      aria-label="Timeline controls"
    >
      {/* Row 1 — date readout + transport */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[11px] md:text-xs tracking-[0.18em] uppercase text-foreground/90 tabular-nums">
            {date}
          </span>
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/45 tabular-nums">
            {time}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <TransportButton label="Run time backward" active={reversed && playing} onClick={toggleReverse}>
            ⏪
          </TransportButton>
          <TransportButton label={playing ? "Pause" : "Play"} active={playing} onClick={togglePlay}>
            {playing ? "⏸" : "▶"}
          </TransportButton>
          {/* Speed cycler — hidden while following a body, because the
              Following banner's ride-speed chips (Real time / 60× / 600×)
              become the single speed control then. Two controls on the same
              clock read as a contradiction. */}
          {!speedHidden && (
            <button
              type="button"
              onClick={cycleSpeed}
              aria-label={`Playback speed ${speedLabel(speed)}, tap to change`}
              className={`
                min-h-8 px-2.5 rounded-full border
                font-mono text-[10px] tracking-widest tabular-nums
                hover:border-accent/60 hover:text-foreground transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                ${speed === LIVE_SPEED ? "border-accent/70 text-accent" : "border-foreground/25 text-foreground/85"}
              `}
            >
              {speedLabel(speed)}
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — the scrubber */}
      <input
        type="range"
        min={-1}
        max={1}
        step={0.0001}
        value={Math.max(-1, Math.min(1, sliderValue))}
        onPointerDown={() => { draggingRef.current = true; applyWarp(0) }}
        onPointerUp={() => { draggingRef.current = false }}
        onChange={(e) => onScrub(parseFloat(e.target.value))}
        aria-label="Scrub simulation date"
        aria-valuetext={date}
        className="
          w-full accent-accent cursor-ew-resize
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded
        "
      />

      {/* Row 3 — anchors: Today + waypoints */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={today}
          disabled={isToday && !playing}
          className="
            min-h-8 px-3 rounded-full border border-foreground/25
            font-mono text-[10px] tracking-[0.2em] uppercase
            text-foreground/85 hover:text-foreground hover:border-accent/60
            disabled:opacity-40 disabled:hover:border-foreground/25 disabled:hover:text-foreground/85
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          ↺ Today
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setWaypointsOpen((v) => !v)}
            aria-expanded={waypointsOpen}
            aria-label="Jump to a moment in time"
            className="
              min-h-8 px-3 rounded-full border border-foreground/25
              font-mono text-[10px] tracking-[0.2em] uppercase
              text-foreground/85 hover:text-foreground hover:border-accent/60
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            "
          >
            Moments ▾
          </button>

          {waypointsOpen && (
            <div
              className="
                absolute bottom-full right-0 mb-2 z-40
                w-[min(80vw,18rem)] max-h-[40vh] overflow-y-auto
                flex flex-col gap-0.5 p-1.5
                border border-foreground/25 rounded-xl
                bg-background/90 backdrop-blur-md
              "
              role="menu"
            >
              {TIMELINE_WAYPOINTS.map((w) => (
                <button
                  key={w.label}
                  type="button"
                  role="menuitem"
                  onClick={() => jumpToWaypoint(w.iso, w.body, w.bodyKind)}
                  className="
                    text-left px-2.5 py-2 rounded-lg
                    hover:bg-foreground/10 transition-colors
                    focus-visible:outline-none focus-visible:bg-foreground/10
                  "
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-foreground/90">
                      {w.label}
                    </span>
                    <span className="font-mono text-[9px] text-foreground/40 tabular-nums">
                      {new Date(w.iso).getUTCFullYear()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">{w.note}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline honesty — shown when scrubbed away from the present. We
          propagate today's catalogue: launches gate truthfully, but craft that
          decayed before today aren't in current TLEs, and future drag decay
          isn't modeled. Say so instead of faking it. */}
      {farFromNow && (
        <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-foreground/40 leading-relaxed">
          Satellites: today's catalogue, launch-gated · past decays & future
          drag not modeled
        </p>
      )}
    </div>
  )
}

function TransportButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`
        min-h-8 min-w-8 grid place-items-center rounded-full border text-[12px]
        transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${active
          ? "border-accent/70 text-foreground bg-accent/10"
          : "border-foreground/25 text-foreground/85 hover:text-foreground hover:border-accent/60"}
      `}
    >
      {children}
    </button>
  )
}

export function ResetViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        absolute top-20 right-6 md:top-40 md:right-12 z-30
        inline-flex items-center gap-2 px-3.5 py-2
        border border-foreground/25 rounded-full
        bg-background/50 backdrop-blur-sm
        font-mono text-[10px] tracking-[0.25em] uppercase
        text-foreground/85 hover:text-foreground hover:border-accent/60
        transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        focus-visible:ring-offset-2 focus-visible:ring-offset-background
        min-h-9
      "
      aria-label="Reset camera view"
    >
      ↺ Reset view
    </button>
  )
}

/** Gravity overlay toggle — switches the gravitational-field visualization
 *  (influence spheres + ecliptic vector field) on/off.  Styled to match the
 *  DateReadout / TimelineControl pill cluster. */
/** Deep Dive toggle — switches the engine into exact-astrodynamics mode:
 *  trajectory trails, live orbit dots, full gravity overlay, and rich
 *  star/planet data readouts. */
export function DeepDiveToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
        backdrop-blur-sm transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "border-purple-400/60 bg-purple-400/10 text-purple-200"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"
        }
      `}
    >
      <span
        className={`relative flex h-2 w-2 rounded-full ${
          active ? "bg-purple-300" : "bg-foreground/40"
        }`}
      >
        {active && (
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75" />
        )}
      </span>
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
        Deep Dive
      </span>
    </button>
  )
}

export function GravityToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
        backdrop-blur-sm transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"
        }
      `}
    >
      <span
        className={`relative flex h-2 w-2 rounded-full ${
          active ? "bg-accent" : "bg-foreground/40"
        }`}
      >
        {active && (
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
        )}
      </span>
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
        Gravity
      </span>
    </button>
  )
}

/** Toggle human-made satellite shells (Starlink/ISS/GPS/GEO etc.) around
 *  bodies that have orbiters. Mirrors the other toggle chips. */
export function SatelliteToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
        backdrop-blur-sm transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"
        }
      `}
    >
      <span className={`relative flex h-2 w-2 rounded-full ${active ? "bg-accent" : "bg-foreground/40"}`} />
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Satellites</span>
    </button>
  )
}

/** Constellation layer chips — view one group at a time (understand its
 *  geometry: Starlink's lattice, the nav rings, the debris shell) or all at
 *  once (the whole environment). Writes satGroupFilterRef; the field's shader
 *  hides non-members per-point. */
export function SatelliteGroupChips() {
  const [sel, setSel] = useState<number>(satGroupFilterRef.current)
  const pick = (idx: number) => {
    const next = sel === idx ? -1 : idx // tap the active chip → back to All
    satGroupFilterRef.current = next
    setSel(next)
  }
  return (
    <div
      className="pointer-events-auto flex flex-wrap justify-end gap-1.5 max-w-[min(92vw,26rem)]"
      role="group"
      aria-label="Satellite constellation filter"
    >
      <button
        type="button"
        onClick={() => { satGroupFilterRef.current = -1; setSel(-1) }}
        aria-pressed={sel === -1}
        className={`px-2.5 py-1.5 rounded-full border font-mono text-[9px] tracking-[0.16em] uppercase backdrop-blur-sm transition-colors ${
          sel === -1
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/20 bg-background/50 text-foreground/60 hover:text-foreground/90"
        }`}
      >
        All
      </button>
      {SAT_GROUPS.map((label, idx) => (
        <button
          key={label}
          type="button"
          onClick={() => pick(idx)}
          aria-pressed={sel === idx}
          className={`px-2.5 py-1.5 rounded-full border font-mono text-[9px] tracking-[0.16em] uppercase backdrop-blur-sm transition-colors ${
            sel === idx
              ? "border-accent/60 bg-accent/10 text-accent"
              : "border-foreground/20 bg-background/50 text-foreground/60 hover:text-foreground/90"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Toggle between Explore (compressed) and True Scale (real ratios). When
 *  active = true, the engine is in True Scale mode. */
export function ScaleToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? "True scale — real distances + ratios" : "Explore scale — compressed so the whole system fits"}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
        backdrop-blur-sm transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"
        }
      `}
    >
      <span className={`relative flex h-2 w-2 rounded-full ${active ? "bg-accent" : "bg-foreground/40"}`} />
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
        {active ? "True Scale" : "Explore Scale"}
      </span>
    </button>
  )
}

/** Toggle Earth's procedural cloud shell on/off. Mirrors GravityToggle's
 *  look; `active` = clouds visible. */
export function CloudToggle({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`
        inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
        backdrop-blur-sm transition-colors duration-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${
          active
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"
        }
      `}
    >
      <span
        className={`relative flex h-2 w-2 rounded-full ${
          active ? "bg-accent" : "bg-foreground/40"
        }`}
      />
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
        Clouds
      </span>
    </button>
  )
}

/** Jump-to / warp-navigation menu. Flies the camera to any major body by
 *  dispatching the engine's focus event (the planet listens + follows its own
 *  live position). Essential in True Scale mode where bodies are far apart —
 *  you warp instead of flying through the void. */
const JUMP_DESTINATIONS: { section: string; items: { label: string; pointId: string }[] }[] = [
  {
    section: "Planets",
    items: [
      { label: "Sun", pointId: "planet:Sun" },
      { label: "Mercury", pointId: "planet:Mercury" },
      { label: "Venus", pointId: "planet:Venus" },
      { label: "Earth", pointId: "planet:Earth" },
      { label: "Mars", pointId: "planet:Mars" },
      { label: "Jupiter", pointId: "planet:Jupiter" },
      { label: "Saturn", pointId: "planet:Saturn" },
      { label: "Uranus", pointId: "planet:Uranus" },
      { label: "Neptune", pointId: "planet:Neptune" },
      { label: "Pluto", pointId: "planet:Pluto" },
    ],
  },
  {
    section: "Moons",
    items: [
      { label: "Luna", pointId: "moon:Moon (Luna)" },
      { label: "Io", pointId: "moon:Io" },
      { label: "Europa", pointId: "moon:Europa" },
      { label: "Ganymede", pointId: "moon:Ganymede" },
      { label: "Titan", pointId: "moon:Titan" },
      { label: "Enceladus", pointId: "moon:Enceladus" },
      { label: "Triton", pointId: "moon:Triton" },
    ],
  },
  {
    section: "Comets & small bodies",
    items: [
      { label: "Halley's Comet", pointId: "named:Halley's Comet" },
      { label: "Comet NEOWISE", pointId: "named:Comet NEOWISE" },
      { label: "Apophis", pointId: "named:Apophis" },
      { label: "Bennu", pointId: "named:Bennu" },
      { label: "ʻOumuamua", pointId: "named:'Oumuamua" },
    ],
  },
  {
    section: "Dwarf planets",
    items: [
      { label: "Ceres", pointId: "named:Ceres" },
      { label: "Eris", pointId: "named:Eris" },
      { label: "Makemake", pointId: "named:Makemake" },
      { label: "Sedna", pointId: "named:Sedna" },
    ],
  },
  // Deep-sky ids became addressable on the universe:sky-focus channel
  // (scene.tsx SkyPointMesh flies + resolves on a matching id), so the
  // menu can finally take people to them. Black holes especially — idle
  // they're a dark dot with no halo (honest: nothing escapes), which made
  // them impossible to FIND without already knowing where to look.
  {
    section: "Black holes",
    items: [
      { label: "M87* — first imaged", pointId: "m87-star" },
      { label: "Cygnus X-1", pointId: "cygnus-x1" },
      { label: "V404 Cygni", pointId: "v404-cygni" },
      { label: "TON 618", pointId: "ton-618" },
      { label: "Phoenix A*", pointId: "phoenix-a" },
      { label: "OJ 287", pointId: "oj-287" },
      { label: "NGC 1277", pointId: "ngc1277-bh" },
      { label: "GW150914", pointId: "gw150914" },
    ],
  },
  {
    section: "Deep sky",
    items: [
      { label: "Orion Nebula", pointId: "m42" },
      { label: "Andromeda", pointId: "m31" },
      { label: "Pleiades", pointId: "m45" },
      { label: "Hercules Cluster", pointId: "m13" },
      { label: "M22 · Sagittarius", pointId: "m22" },
      { label: "M37 · open cluster", pointId: "m37" },
      { label: "Ring Nebula", pointId: "m57" },
      { label: "Dumbbell Nebula", pointId: "m27" },
      { label: "Helix Nebula · Eye of God", pointId: "helix" },
      { label: "Whirlpool Galaxy", pointId: "m51" },
      { label: "Sombrero Galaxy", pointId: "m104" },
    ],
  },
  {
    section: "Exoplanets",
    items: [
      { label: "TRAPPIST-1 · seven worlds", pointId: "trappist-1" },
    ],
  },
]

export function DestinationsMenu() {
  const [open, setOpen] = useState(false)
  const jump = (pointId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId } }))
    }
    setOpen(false)
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="
          inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
          border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90
          backdrop-blur-sm transition-colors duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
        "
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Jump to ▸</span>
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 right-0 min-w-48 max-h-[60vh] overflow-y-auto rounded-xl border border-foreground/15 bg-background/90 backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
          {JUMP_DESTINATIONS.map((group) => (
            <div key={group.section} className="mb-1 last:mb-0">
              <div className="px-3 pt-1.5 pb-1 font-mono text-[8px] tracking-[0.24em] uppercase text-foreground/40">
                {group.section}
              </div>
              {group.items.map((d) => (
                <button
                  key={d.pointId}
                  type="button"
                  onClick={() => jump(d.pointId)}
                  className="block w-full text-left px-3 py-1.5 rounded-lg font-mono text-[10px] tracking-[0.18em] uppercase text-foreground/75 hover:bg-foreground/10 hover:text-foreground transition-colors"
                >
                  {d.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** One labelled on/off row inside the LayersMenu popover. A pill dot shows
 *  state (filled = on) so the whole menu reads as a stack of switches. */
function LayerToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
          active ? "text-accent" : "text-foreground/75"
        }`}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={`grid place-items-center h-4 w-4 rounded-full border transition-colors shrink-0 ${
          active ? "border-accent/70 bg-accent/15" : "border-foreground/25"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-foreground/30"}`} />
      </span>
    </button>
  )
}

/** Collapses the whole overlay-control cluster (Clouds · Satellites ·
 *  True Scale · Gravity · Deep Dive · Jump-to) into a single "Layers"
 *  button + popover, so the explorer's bottom-right no longer stacks six
 *  chips plus a wrapping filter row. Only mounted in the solar explorer
 *  (the home hero passes minimalControls, so it never sees this). */
export function LayersMenu({
  showClouds,
  onToggleClouds,
  showSatellites,
  onToggleSatellites,
  showSatGroups,
  trueScale,
  onToggleScale,
  showGravity,
  onToggleGravity,
  showDeepDive,
  onToggleDeepDive,
}: {
  showClouds: boolean
  onToggleClouds: () => void
  showSatellites: boolean
  onToggleSatellites: () => void
  /** Include the per-constellation filter chips (solar explorer + sats on). */
  showSatGroups: boolean
  trueScale: boolean
  onToggleScale: () => void
  showGravity: boolean
  onToggleGravity: () => void
  showDeepDive: boolean
  onToggleDeepDive: () => void
}) {
  const [open, setOpen] = useState(false)
  // Close on outside-click / Escape so the popover behaves like a menu.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Count of active layers → a subtle badge on the chip so users know
  // something's on even while the menu is closed.
  const activeCount = [showClouds, showSatellites, trueScale, showGravity, showDeepDive].filter(Boolean).length

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Layers and overlays"
        className={`
          inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
          backdrop-blur-sm transition-colors duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          ${open || activeCount > 0
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-foreground/25 bg-background/50 text-foreground/70 hover:text-foreground/90"}
        `}
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Layers</span>
        {activeCount > 0 && (
          <span className="font-mono text-[9px] tabular-nums text-accent/90">{activeCount}</span>
        )}
        <span className={`text-[9px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-60 max-h-[62vh] overflow-y-auto rounded-xl border border-foreground/15 bg-background/90 backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
          <div className="px-3 pt-1.5 pb-1 font-mono text-[8px] tracking-[0.24em] uppercase text-foreground/40">
            Overlays
          </div>
          <LayerToggleRow label="Clouds" active={showClouds} onToggle={onToggleClouds} />
          <LayerToggleRow label="Satellites" active={showSatellites} onToggle={onToggleSatellites} />
          {showSatGroups && (
            <div className="px-3 py-2">
              <SatelliteGroupChips />
            </div>
          )}
          <LayerToggleRow label="True Scale" active={trueScale} onToggle={onToggleScale} />
          <LayerToggleRow label="Gravity" active={showGravity} onToggle={onToggleGravity} />
          <LayerToggleRow label="Deep Dive" active={showDeepDive} onToggle={onToggleDeepDive} />

          <div className="mt-1 border-t border-foreground/10 pt-1.5">
            <div className="px-3 pt-1 pb-1 font-mono text-[8px] tracking-[0.24em] uppercase text-foreground/40">
              Jump to
            </div>
            {JUMP_DESTINATIONS.map((group) => (
              <div key={group.section} className="mb-1 last:mb-0">
                <div className="px-3 pt-1 pb-0.5 font-mono text-[8px] tracking-[0.2em] uppercase text-foreground/30">
                  {group.section}
                </div>
                <div className="flex flex-wrap gap-1 px-2 pb-1">
                  {group.items.map((d) => (
                    <button
                      key={d.pointId}
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: d.pointId } }))
                        }
                        setOpen(false)
                      }}
                      className="px-2 py-1 rounded-md font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/70 hover:bg-foreground/10 hover:text-foreground transition-colors"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
