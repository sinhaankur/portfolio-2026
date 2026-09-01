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

import { PALETTES, MODES, type EngineParams } from "./config"

export function FlowHud({
  params,
  onChange,
  onStop,
}: {
  params: EngineParams
  onChange: (next: Partial<EngineParams>) => void
  onStop: () => void
}) {
  const activeMode = MODES.find((m) => m.id === params.mode)
  return (
    <div className="mt-4 space-y-3">
      {/* Mode selector — the pattern engine's heart. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-wider uppercase text-foreground/50">
          Mode
        </span>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange({ mode: m.id })}
            data-cursor-hover
            title={m.hint}
            className={`rounded-full px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase border transition-colors ${
              params.mode === m.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground/55 hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
        {activeMode && (
          <span className="font-sans text-[11px] text-foreground/40">
            {activeMode.hint}
          </span>
        )}
      </div>

    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
    </div>
  )
}
