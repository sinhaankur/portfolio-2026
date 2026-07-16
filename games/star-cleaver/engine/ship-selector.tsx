'use client';

import type { GameState } from '../../../lib/neural-game-engine';

export interface ShipConfig {
  id: SelectedShip;
  name: string;
  description: string;
  visualSource: 'glb' | 'procedural';
  visualNote: string;
  stats: {
    speed: number; // 1-5
    armor: number; // 1-5
    weapons: number; // 1-5
  };
}

export const SHIP_CONFIGS: Record<string, ShipConfig> = {
  // id stays 'default-vanguard' so existing saves/state keep resolving; the
  // craft itself is now the Peregrine quad-foil strike fighter.
  'default-vanguard': {
    id: 'default-vanguard',
    name: 'Peregrine Strike Fighter',
    description: 'Quad-foil strike fighter — wing-root nacelles, four wingtip cannons, cockpit HUD.',
    visualSource: 'glb',
    visualNote: 'Styled GLB',
    stats: {
      speed: 3,
      armor: 3,
      weapons: 4,
    },
  },
  // Falcon family, same fleet palette (blender/space-assets/build_new_ships.py).
  kestrel: {
    id: 'kestrel',
    name: 'Kestrel Interceptor',
    description: 'Forward-swept interceptor — canards, twin canted tails, quad micro-nozzle cluster.',
    visualSource: 'glb',
    visualNote: 'Styled GLB',
    stats: {
      speed: 5,
      armor: 2,
      weapons: 3,
    },
  },
  gyrfalcon: {
    id: 'gyrfalcon',
    name: 'Gyrfalcon Gunship',
    description: 'Twin-hull gunship — paired chin guns, dorsal turret, four heavy engines.',
    visualSource: 'glb',
    visualNote: 'Styled GLB',
    stats: {
      speed: 2,
      armor: 5,
      weapons: 5,
    },
  },
};

export type SelectedShip = 'default-vanguard' | 'kestrel' | 'gyrfalcon';

/**
 * Get available ships based on worlds completed.
 * All three hulls fly today; unlock gating can return when progression wants it.
 */
export function getAvailableShips(worldsCompleted: number): ShipConfig[] {
  void worldsCompleted;
  return [SHIP_CONFIGS['default-vanguard'], SHIP_CONFIGS['kestrel'], SHIP_CONFIGS['gyrfalcon']];
}

interface ShipSelectorProps {
  gameState: GameState;
  onSelect: (shipId: string) => void;
}

export function ShipSelector({ gameState, onSelect }: ShipSelectorProps) {
  const availableShips = getAvailableShips(gameState.worldsCompleted);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md pointer-events-auto">
      <div className="text-center max-w-3xl px-6 space-y-8">
        <div className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400 mb-4">
            SELECT YOUR VESSEL
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight italic">
            Choose Your Fighter
          </h2>
        </div>

        {/* Ship cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableShips.map((ship) => (
            <button
              key={ship.id}
              onClick={() => onSelect(ship.id)}
              className="group relative p-6 rounded-lg border border-foreground/20 bg-foreground/5 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all duration-300 text-left"
            >
              {/* Gradient border on hover */}
              <div className="absolute inset-0 rounded-lg bg-linear-to-r from-cyan-400/0 via-cyan-400/0 to-cyan-400/0 group-hover:from-cyan-400/20 group-hover:via-cyan-400/10 group-hover:to-cyan-400/0 pointer-events-none transition-all duration-300" />

              <div className="relative space-y-4">
                {/* Ship name and description */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em] ${
                      ship.visualSource === 'glb'
                        ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-300'
                        : 'border-foreground/20 bg-foreground/5 text-foreground/55'
                    }`}>
                      {ship.visualNote}
                    </span>
                  </div>
                  <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-foreground/85 mb-2">
                    {ship.name}
                  </h3>
                  <p className="text-foreground/60 text-sm font-sans">
                    {ship.description}
                  </p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-foreground/10">
                  <div className="space-y-1">
                    <div className="font-mono text-[8px] tracking-widest uppercase text-foreground/50">
                      Speed
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-2 rounded-full ${
                            i < ship.stats.speed ? 'bg-cyan-400' : 'bg-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[8px] tracking-widest uppercase text-foreground/50">
                      Armor
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-2 rounded-full ${
                            i < ship.stats.armor ? 'bg-green-400' : 'bg-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-mono text-[8px] tracking-widest uppercase text-foreground/50">
                      Weapons
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 w-2 rounded-full ${
                            i < ship.stats.weapons ? 'bg-yellow-400' : 'bg-foreground/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Select button */}
                <div className="pt-2">
                  <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    → SELECT
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-foreground/50 font-mono text-[9px] tracking-widest">
          You can change your selection before each wave
        </div>
      </div>
    </div>
  );
}
