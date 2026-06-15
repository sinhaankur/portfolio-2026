"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Universe Engine — HUD overlays.
 *
 * Plain DOM elements that sit on top of the R3F <Canvas>. Token-driven
 * (text-foreground / bg-background) so they track the surrounding theme
 * scope — the engine ships dark by default but flips with the page theme
 * if a consumer wraps it in a light scope.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { BodyDeepFacts, BodyInfo } from "./types"
import {
  DAY_MS,
  REAL_NOW_MS,
  TIMELINE_RANGE_YEARS,
  TIMELINE_WAYPOINTS,
  YEAR_MS,
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
    deep.discoveredYear !== undefined
  if (!hasAny) return null

  const isSheet = variant === "sheet"
  const focusClass = "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  const toggleClass = isSheet
    ? `font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/65 hover:text-foreground transition-colors min-h-9 inline-flex items-center px-2 -mx-2 ${focusClass}`
    : `font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/55 hover:text-foreground transition-colors px-1.5 -mx-1.5 py-1 -my-1 ${focusClass}`
  const rowLabel = isSheet ? "text-foreground/55 shrink-0" : "text-foreground/55"
  const rowValue = isSheet ? "text-foreground/85 tabular-nums" : "text-foreground/85 tabular-nums"
  const gridClass = isSheet
    ? "mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs"
    : "mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-sans text-[10px]"

  return (
    <div className={isSheet ? "mt-4 pt-3 border-t border-border" : "mt-3 pointer-events-auto"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={toggleClass}
      >
        {open ? "− Less" : "+ More"}
      </button>

      {open && (
        <dl className={gridClass}>
          {deep.massEarth !== undefined && (
            <>
              <dt className={rowLabel}>Mass</dt>
              <dd className={rowValue}>{formatMassEarth(deep.massEarth)}</dd>
            </>
          )}
          {deep.densityGcc !== undefined && (
            <>
              <dt className={rowLabel}>Density</dt>
              <dd className={rowValue}>{deep.densityGcc.toFixed(2)} g/cm³</dd>
            </>
          )}
          {deep.gravity !== undefined && (
            <>
              <dt className={rowLabel}>Gravity</dt>
              <dd className={rowValue}>{formatGravityValue(deep.gravity)} · {formatGee(deep.gravity)}</dd>
            </>
          )}
          {deep.escapeVelocityKms !== undefined && (
            <>
              <dt className={rowLabel}>Escape vel.</dt>
              <dd className={rowValue}>{deep.escapeVelocityKms.toFixed(2)} km/s</dd>
            </>
          )}
          {deep.eccentricity !== undefined && (
            <>
              <dt className={rowLabel}>Eccentricity</dt>
              <dd className={rowValue}>{deep.eccentricity.toFixed(3)}</dd>
            </>
          )}
          {deep.discoveredYear !== undefined && (
            <>
              <dt className={rowLabel}>Discovered</dt>
              <dd className={rowValue}>
                {deep.discoveredYear}
                {deep.discoveredBy ? ` · ${deep.discoveredBy}` : ""}
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}

export function InfoPanel({ info }: { info: BodyInfo | null }) {
  if (!info) {
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
 *  speed and Reverse flips its sign. */
const SPEED_STEPS = [0.25, 1, 4, 20, 100] as const

function formatSimDate(ms: number): { date: string; time: string } {
  const d = new Date(ms)
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()
  const day = String(d.getUTCDate()).padStart(2, "0")
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`
  return { date: `${month} ${day} · ${d.getUTCFullYear()}`, time }
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
export function TimelineControl() {
  // Slider position is a normalised offset in [-1, 1] around REAL_NOW_MS;
  // we convert to/from absolute simMs. We hold the displayed date in state
  // (polled), but the slider itself is uncontrolled-feeling: while dragging
  // we write simMs immediately and reflect it back.
  const [simMs, setSimMsState] = useState<number>(() => getSimMs())
  const [warp, setWarp] = useState<number>(() => timeWarpRef.current)
  const [speedIdx, setSpeedIdx] = useState<number>(1) // default 1×
  const [waypointsOpen, setWaypointsOpen] = useState(false)
  const draggingRef = useRef(false)

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
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}×, tap to change`}
            className="
              min-h-8 px-2.5 rounded-full border border-foreground/25
              font-mono text-[10px] tracking-widest text-foreground/85 tabular-nums
              hover:border-accent/60 hover:text-foreground transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            "
          >
            {speed}×
          </button>
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
