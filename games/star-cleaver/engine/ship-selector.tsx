'use client';

import type { GameState } from '../../../lib/neural-game-engine';

export interface ShipConfig {
  id: 'default-xwing' | 't70-xwing' | 'custom';
  name: string;
  description: string;
  stats: {
    speed: number; // 1-5
    armor: number; // 1-5
    weapons: number; // 1-5
  };
}

export const SHIP_CONFIGS: Record<string, ShipConfig> = {
  'default-xwing': {
    id: 'default-xwing',
    name: 'Classic X-Wing',
    description: 'Balanced fighter with strong weapons',
    stats: {
      speed: 3,
      armor: 3,
      weapons: 4,
    },
  },
  't70-xwing': {
    id: 't70-xwing',
    name: 'T-70 X-Wing',
    description: 'Modern variant. Faster, more agile.',
    stats: {
      speed: 4,
      armor: 2,
      weapons: 4,
    },
  },
};

export type SelectedShip = 'default-xwing' | 't70-xwing';

interface ShipSelectorProps {
  gameState: GameState;
  onSelect: (shipId: string) => void;
}

export function ShipSelector({ gameState, onSelect }: ShipSelectorProps) {
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
          {Object.values(SHIP_CONFIGS).map((ship) => (
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
                    <div className="font-mono text-[8px] tracking-[0.1em] uppercase text-foreground/50">
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
                    <div className="font-mono text-[8px] tracking-[0.1em] uppercase text-foreground/50">
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
                    <div className="font-mono text-[8px] tracking-[0.1em] uppercase text-foreground/50">
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

        <div className="text-foreground/50 font-mono text-[9px] tracking-[0.1em]">
          You can change your selection before each wave
        </div>
      </div>
    </div>
  );
}
