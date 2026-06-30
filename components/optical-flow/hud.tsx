"use client"

/**
 * hud.tsx — the control surface for the Optical Flow engine.
 *
 * Pure presentational controls (density · palette · ghost · stop). The
 * orchestrator owns the state; this just renders it and reports changes up.
 * Kept separate so the engine's "meaning/control layer" is distinct from its
 * camera + render plumbing — same split the Universe Engine keeps between its
 * scene and its HUD.
 */

import { PALETTES, type EngineParams } from "./config"

export function FlowHud({
  params,
  onChange,
  onStop,
}: {
  params: EngineParams
  onChange: (next: Partial<EngineParams>) => void
  onStop: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70">
        Density
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={params.density}
          onChange={(e) => onChange({ density: parseFloat(e.target.value) })}
          className="w-28 accent-accent"
          aria-label="Dot density"
        />
      </label>

      <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70">
        Palette
        {PALETTES.map((p, i) => (
          <button
            key={p.name}
            onClick={() => onChange({ paletteIdx: i })}
            data-cursor-hover
            className={`rounded-full px-3 py-1 border transition-colors ${
              params.paletteIdx === i
                ? "border-accent text-accent"
                : "border-border text-foreground/60 hover:text-foreground"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase text-foreground/70 cursor-pointer">
        <input
          type="checkbox"
          checked={params.ghostSource}
          onChange={(e) => onChange({ ghostSource: e.target.checked })}
          className="accent-accent"
        />
        Ghost source
      </label>

      <button
        onClick={onStop}
        data-cursor-hover
        className="ml-auto rounded-full border border-border px-3 py-1 font-mono text-[10px] tracking-wider uppercase text-foreground/60 hover:text-foreground transition-colors"
      >
        Stop
      </button>
    </div>
  )
}
