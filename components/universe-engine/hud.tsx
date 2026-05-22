"use client"

/**
 * Universe Engine — HUD overlays.
 *
 * Plain DOM elements that sit on top of the R3F <Canvas>. Token-driven
 * (text-foreground / bg-background) so they track the surrounding theme
 * scope — the engine ships dark by default but flips with the page theme
 * if a consumer wraps it in a light scope.
 */

import type { BodyInfo } from "./types"
import { timeWarpRef } from "./astronomy"

export function InfoPanel({ info }: { info: BodyInfo | null }) {
  if (!info) {
    return (
      <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/45 pointer-events-none">
        Hover any body for data
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
        className="w-32 md:w-40 accent-accent cursor-ew-resize"
      />
      <span className="font-mono text-[10px] tracking-widest text-foreground/85 tabular-nums w-10 text-right">
        {value === 0 ? "PAUSED" : `${value.toFixed(2)}×`}
      </span>
    </label>
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
