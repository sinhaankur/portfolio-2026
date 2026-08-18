"use client"

/**
 * TerrainHud — the DOM overlay for the terrain explorer: body picker, vertical
 * exaggeration slider (ALWAYS labelled — honesty rule), layer toggles
 * (hypsometric tint, slope shading, ocean for Earth), and the data attribution.
 * Mobile-first: controls sit in a compact bottom bar, edge-guttered, no
 * hover-only affordances.
 */

import { visibleTerrainBodies, type TerrainBody } from "@/lib/terrain/bodies"

interface Props {
  body: TerrainBody
  onPickBody: (id: string) => void
  exaggeration: number
  onExaggeration: (v: number) => void
  hypsometric: boolean
  onHypsometric: (v: boolean) => void
  slopeShade: boolean
  onSlopeShade: (v: boolean) => void
  oceanVisible: boolean
  onOcean: (v: boolean) => void
}

export function TerrainHud({
  body,
  onPickBody,
  exaggeration,
  onExaggeration,
  hypsometric,
  onHypsometric,
  slopeShade,
  onSlopeShade,
  oceanVisible,
  onOcean,
}: Props) {
  return (
    <>
      {/* Top-left: title + provenance */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 max-w-[min(90vw,22rem)] md:left-6 md:top-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Planetary Terrain
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl" style={{ color: body.accent }}>
          {body.name}
        </h1>
        <p className="mt-1 text-[12px] leading-snug text-white/65">{body.tagline}</p>
        <p className="mt-2 text-[10px] leading-snug text-white/40">{body.attribution}</p>
      </div>

      {/* Body picker: top-right chips */}
      <div className="pointer-events-auto absolute right-4 top-4 z-30 flex flex-wrap justify-end gap-1.5 md:right-6 md:top-6">
        {visibleTerrainBodies().map((b) => {
          const active = b.id === body.id
          const baking = b.heightMap === null
          return (
            <button
              key={b.id}
              onClick={() => onPickBody(b.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? "border-white/60 bg-white/15 text-white"
                  : "border-white/15 bg-black/40 text-white/70 hover:border-white/35 hover:text-white"
              }`}
              title={baking ? "Elevation map baking — shown smooth for now" : b.tagline}
            >
              {b.name}
              {baking && <span className="ml-1 text-white/40">·baking</span>}
            </button>
          )
        })}
      </div>

      {/* Bottom control bar */}
      <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-30 mx-auto max-w-2xl md:bottom-6">
        <div className="rounded-xl border border-white/12 bg-black/70 px-3 py-2.5 backdrop-blur">
          {/* Exaggeration — always labelled with the current factor */}
          <div className="flex items-center gap-3">
            <label className="shrink-0 text-[11px] text-white/70">
              Vertical scale
              <span className="ml-1 font-mono text-white" title="1× is true-to-life; higher exaggerates relief for legibility">
                {exaggeration === 1 ? "1× (true)" : `${exaggeration}×`}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={exaggeration}
              onChange={(e) => onExaggeration(parseInt(e.target.value, 10))}
              className="h-1 flex-1 cursor-pointer accent-white"
              aria-label="Vertical exaggeration"
            />
          </div>

          {/* Layer toggles */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Toggle label="Elevation tint" on={hypsometric} onChange={onHypsometric} />
            <Toggle label="Slope shading" on={slopeShade} onChange={onSlopeShade} />
            {body.hasOcean && (
              <Toggle label={oceanVisible ? "Ocean: on" : "Ocean: drained"} on={oceanVisible} onChange={onOcean} />
            )}
          </div>

          {/* Elevation legend — real metres */}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-white/45">
            <span className="font-mono">{fmt(body.elevationMinM)}</span>
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-[#1a2e4d] via-[#9e7248] to-[#f2ebe0]" />
            <span className="font-mono">{fmt(body.elevationMaxM)}</span>
          </div>
        </div>
      </div>
    </>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        on ? "border-white/50 bg-white/12 text-white" : "border-white/15 bg-black/30 text-white/60 hover:text-white"
      }`}
      aria-pressed={on}
    >
      {label}
    </button>
  )
}

function fmt(m: number): string {
  const km = m / 1000
  return `${km >= 0 ? "+" : ""}${km.toFixed(1)} km`
}
