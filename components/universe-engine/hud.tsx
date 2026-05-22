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

import { useEffect, useState } from "react"
import type { BodyDeepFacts, BodyInfo } from "./types"
import { simTimeRef, timeWarpRef } from "./astronomy"

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
              <dd className={rowValue}>{deep.gravity.toFixed(2)} m/s²</dd>
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

  return (
    <div className="font-mono text-[11px] text-foreground/90 leading-relaxed pointer-events-none">
      <div className="text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-1">
        {info.classification}
      </div>
      <div className="text-base font-sans tracking-tight text-foreground mb-2">
        {info.name}
      </div>

      {k && (
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

      {info.aAU !== undefined && (
        <div>
          <span className="text-foreground/55">Orbit · </span>
          {info.aAU.toFixed(2)} AU · {Math.round(info.periodDays ?? 0).toLocaleString()} days
        </div>
      )}

      {info.rotHours !== undefined && (
        <div>
          <span className="text-foreground/55">Day · </span>
          {Math.abs(info.rotHours) < 100
            ? `${Math.abs(info.rotHours).toFixed(1)} h${info.rotHours < 0 ? " (retrograde)" : ""}`
            : `${(Math.abs(info.rotHours) / 24).toFixed(0)} days${info.rotHours < 0 ? " (retrograde)" : ""}`}
        </div>
      )}

      {info.tiltDeg !== undefined && (
        <div>
          <span className="text-foreground/55">Axial tilt · </span>
          {info.tiltDeg.toFixed(1)}°
        </div>
      )}

      {info.radiusEarth !== undefined && (
        <div>
          <span className="text-foreground/55">Radius · </span>
          {info.radiusEarth.toFixed(2)} × Earth
        </div>
      )}

      {info.moons !== undefined && info.moons > 0 && (
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

      {info.followable && (
        <div className="mt-3 inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/60">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/55" />
          Click to track its orbit
        </div>
      )}
    </div>
  )
}

export function TimeWarpSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 px-4 py-2.5 border border-foreground/25 rounded-full bg-background/50 backdrop-blur-sm">
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/70">
        Time
      </span>
      <input
        type="range"
        min={0}
        max={3}
        step={0.05}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          onChange(v)
          timeWarpRef.current = v
        }}
        aria-label="Adjust simulation speed"
        aria-valuetext={value === 0 ? "Paused" : `${value.toFixed(2)} times normal speed`}
        className="
          w-32 md:w-40 accent-accent cursor-ew-resize
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
          rounded
        "
      />
      <span className="font-mono text-[10px] tracking-widest text-foreground/85 tabular-nums w-10 text-right">
        {value === 0 ? "PAUSED" : `${value.toFixed(2)}×`}
      </span>
    </label>
  )
}

/**
 * Date readout — surfaces the current simulation date.
 *
 * Reads from the module-scoped `simTimeRef` accumulator (advanced each
 * frame by SceneClock) and polls at ~5 Hz, which is enough resolution
 * for "MAR 14 · 2026" to update smoothly without re-rendering on every
 * frame. Pairs naturally with the TimeWarpSlider: pause the slider and
 * the date freezes; crank it to 3× and the date races forward.
 */
export function DateReadout() {
  const [dateStr, setDateStr] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const { days, epochMs } = simTimeRef.current
      const d = new Date(epochMs + days * 86_400_000)
      const month = d
        .toLocaleString("en-US", { month: "short" })
        .toUpperCase()
      setDateStr(`${month} ${d.getDate()} · ${d.getFullYear()}`)
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
