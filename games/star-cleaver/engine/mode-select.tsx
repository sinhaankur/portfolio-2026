'use client';

/**
 * Mode-select start screen — the two top-level sections of the game.
 *
 *   Deep Run     → roguelike: push outward, scavenge salvage, extract or die.
 *   Exploration  → free-roam the solar system.
 *   Defend Earth → combat: incoming asteroid swarm + enemy fleet.
 *
 * Rendered as a DOM overlay (not in the R3F canvas) while
 * `gameState.phase === 'mode-select'`. Picking a card calls `onSelect`, which
 * the canvas wires to `selectGameMode(...)`.
 */

type GameMode = 'explore' | 'defend' | 'run';

const MODES: {
  id: GameMode;
  eyebrow: string;
  name: string;
  description: string;
  accent: string;
}[] = [
  {
    id: 'run',
    eyebrow: '01 — DEEP RUN',
    name: 'Deep Run',
    description:
      'The real fight. Launch into hostile space, scavenge salvage from every kill, and gamble each jump — push deeper for more, or extract to bank it. Die and you lose the run; spend banked salvage to come back stronger.',
    accent: '#7af0c0',
  },
  {
    id: 'explore',
    eyebrow: '02 — FREE ROAM',
    name: 'Exploration',
    description:
      'Fly the solar system at your own pace. Real planets, the asteroid belt, and deep-sky beyond — no threats, just the void to cross.',
    accent: '#5fb8ff',
  },
  {
    id: 'defend',
    eyebrow: '03 — COMBAT',
    name: 'Defend Earth',
    description:
      'Hold the line. Incoming asteroid swarms and an enemy fleet bear down on Earth — intercept and clear every wave before they hit home.',
    accent: '#ff7a4a',
  },
];

export function ModeSelect({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md pointer-events-auto overflow-y-auto py-8">
      <div className="text-center max-w-4xl px-6 space-y-8">
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400 mb-4">
            Choose your mission
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight italic">
            Three ways into the dark.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className="group flex flex-col text-left rounded-xl border border-white/15 bg-white/[0.04] p-5 md:p-6 transition-colors active:border-white/40 active:bg-white/[0.08] hover:border-white/30 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:min-h-[240px]"
            >
              <div
                className="font-mono text-[10px] tracking-[0.22em] uppercase mb-2.5"
                style={{ color: mode.accent }}
              >
                {mode.eyebrow}
              </div>
              <div className="font-serif text-2xl text-foreground mb-2">{mode.name}</div>
              <p className="text-sm leading-relaxed text-foreground/70">{mode.description}</p>
              {/* LAUNCH affordance — a full-strength pill (was hover-only opacity,
                  which read as disabled on touch). Now a visible tappable-looking
                  chip at every input; mt-auto pins it to the card's bottom. */}
              <span
                className="mt-4 md:mt-auto inline-flex items-center gap-2 self-start rounded-full border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] min-h-11"
                style={{ color: mode.accent, borderColor: `${mode.accent}66`, backgroundColor: `${mode.accent}14` }}
              >
                Launch →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
