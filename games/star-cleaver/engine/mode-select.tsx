'use client';

/**
 * Mode-select start screen — the two top-level sections of the game.
 *
 *   Exploration  → free-roam the solar system.
 *   Defend Earth → combat: incoming asteroid swarm + enemy fleet.
 *
 * Rendered as a DOM overlay (not in the R3F canvas) while
 * `gameState.phase === 'mode-select'`. Picking a card calls `onSelect`, which
 * the canvas wires to `selectGameMode(...)`.
 */

type GameMode = 'explore' | 'defend';

const MODES: {
  id: GameMode;
  eyebrow: string;
  name: string;
  description: string;
  accent: string;
}[] = [
  {
    id: 'explore',
    eyebrow: '01 — FREE ROAM',
    name: 'Exploration',
    description:
      'Fly the solar system at your own pace. Real planets, the asteroid belt, and deep-sky beyond — no threats, just the void to cross.',
    accent: '#5fb8ff',
  },
  {
    id: 'defend',
    eyebrow: '02 — COMBAT',
    name: 'Defend Earth',
    description:
      'Hold the line. Incoming asteroid swarms and an enemy fleet bear down on Earth — intercept and clear every wave before they hit home.',
    accent: '#ff7a4a',
  },
];

export function ModeSelect({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md pointer-events-auto">
      <div className="text-center max-w-3xl px-6 space-y-8">
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400 mb-4">
            Choose your mission
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight italic">
            Two ways into the dark.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className="group text-left rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/30 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              style={{ minHeight: 220 }}
            >
              <div
                className="font-mono text-[10px] tracking-[0.22em] uppercase mb-3"
                style={{ color: mode.accent }}
              >
                {mode.eyebrow}
              </div>
              <div className="font-serif text-2xl text-foreground mb-3">{mode.name}</div>
              <p className="text-sm leading-relaxed text-foreground/70">{mode.description}</p>
              <div
                className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ color: mode.accent }}
              >
                Launch →
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
