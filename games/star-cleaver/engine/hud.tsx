'use client';

import { useMemo } from 'react';
import type { GameState } from '../../../lib/neural-game-engine';
import { formatScore, getCurrentWorldName } from './game-state';
import { SHIP_CONFIGS, type SelectedShip } from './ship-selector';

interface HUDProps {
  gameState: GameState;
  onShipSelect?: (shipId: SelectedShip) => void;
}

/**
 * HUD: Desktop-first heads-up display for Star Cleaver.
 * Matches universe-engine/hud.tsx design language: font-mono, tracking-wide, backdrop-blur-sm.
 */
export function HUD({ gameState }: HUDProps) {
  const healthPercent = (gameState.playerEntity.health / gameState.playerMaxHealth) * 100;
  const planetHealthPercent = gameState.defendingPlanetHealth * 100;
  const chargePercent = (gameState.chargeLevel / gameState.maxCharge) * 100;
  const worldName = getCurrentWorldName(gameState);

  // Planet health color: green → yellow → red
  const planetHealthColor = useMemo(() => {
    if (planetHealthPercent > 66) return 'bg-green-500';
    if (planetHealthPercent > 33) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [planetHealthPercent]);

  return (
    <>
      {/* Top bar: world info, health, score */}
      <div className="fixed top-0 inset-x-0 z-40 pointer-events-none">
        <div className="flex justify-between items-center px-6 py-4 max-w-6xl mx-auto">
          {/* Left: World info */}
          <div className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/85">
            <div>{worldName}</div>
            <div className="text-foreground/55 mt-1">
              WAVE {gameState.wave}/4 · WORLD {gameState.worldIndex + 1}/7
            </div>
          </div>

          {/* Center: Player health bar */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-foreground/55 font-mono text-[9px] tracking-[0.2em] uppercase">
              HULL
            </div>
            <div className="w-64 h-2 rounded-full bg-foreground/10 border border-foreground/25 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-100"
                style={{
                  width: `${healthPercent}%`,
                  backgroundColor: healthPercent > 50 ? '#22c55e' : healthPercent > 25 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <div className="text-foreground/70 font-mono text-[9px]">
              {Math.ceil(gameState.playerEntity.health)} / {gameState.playerMaxHealth}
            </div>
          </div>

          {/* Right: Score */}
          <div className="text-right">
            <div className="font-mono text-[13px] tracking-[0.1em] uppercase text-foreground/85 tabular-nums">
              {formatScore(gameState.score)}
            </div>
            <div className="text-foreground/55 font-mono text-[11px] tracking-[0.2em] mt-1">
              ×{gameState.comboMultiplier.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: Planet health + charge meter */}
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
        <div className="flex flex-col items-center gap-4 pb-6 max-w-6xl mx-auto">
          {/* Planet health indicator */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-foreground/55 font-mono text-[9px] tracking-[0.2em] uppercase">
              PLANET SHIELD
            </div>
            <div className="w-96 h-1.5 rounded-full bg-foreground/10 border border-foreground/20 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${planetHealthColor}`}
                style={{ width: `${planetHealthPercent}%` }}
              />
            </div>
            <div className="text-foreground/70 font-mono text-[8px]">
              {Math.ceil(planetHealthPercent)}%
            </div>
          </div>

          {/* Charge meter - only visible when charging */}
          {gameState.phase === 'charging' && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-foreground/55 font-mono text-[9px] tracking-[0.2em] uppercase">
                CHARGE LEVEL
              </div>
              <div className="w-80 h-2.5 rounded-full bg-foreground/10 border border-foreground/25 overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-50"
                  style={{ width: `${chargePercent}%` }}
                />
              </div>
              <div className="text-foreground/70 font-mono text-[9px]">
                {Math.ceil(chargePercent)}% · RELEASE TO FIRE
              </div>
            </div>
          )}

          {/* Briefing overlay with ship selector */}
          {gameState.phase === 'briefing' && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md pointer-events-auto">
              <div className="max-w-5xl px-6 space-y-8 max-h-[90vh] overflow-y-auto">
                {/* Mission briefing */}
                <div className="text-center">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55 mb-4">
                    INCOMING THREAT
                  </div>
                  <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-6 leading-tight italic">
                    {worldName}
                  </h2>
                  <p className="text-foreground/75 font-sans text-base leading-relaxed">
                    Wave {gameState.wave} incoming. Prepare defensive systems.
                  </p>
                </div>

                {/* Ship selector */}
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400 mb-4">
                      SELECT YOUR VESSEL
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(SHIP_CONFIGS).map((ship) => (
                      <button
                        key={ship.id}
                        onClick={() => onShipSelect?.(ship.id as SelectedShip)}
                        className="group relative p-6 rounded-lg border border-foreground/20 bg-foreground/5 hover:border-cyan-400/50 hover:bg-cyan-400/10 transition-all duration-300 text-left"
                      >
                        <div className="absolute inset-0 rounded-lg bg-linear-to-r from-cyan-400/0 via-cyan-400/0 to-cyan-400/0 group-hover:from-cyan-400/20 group-hover:via-cyan-400/10 group-hover:to-cyan-400/0 pointer-events-none transition-all duration-300" />
                        <div className="relative space-y-3">
                          <h3 className="font-mono text-[11px] tracking-[0.2em] uppercase text-foreground/85">
                            {ship.name}
                          </h3>
                          <p className="text-foreground/60 text-sm font-sans">
                            {ship.description}
                          </p>
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-foreground/10">
                            {['speed', 'armor', 'weapons'].map((stat) => (
                              <div key={stat} className="space-y-1">
                                <div className="font-mono text-[8px] tracking-widest uppercase text-foreground/50">
                                  {stat}
                                </div>
                                <div className="flex gap-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className={`h-1.5 w-2 rounded-full ${
                                        i < ship.stats[stat as keyof typeof ship.stats]
                                          ? 'bg-cyan-400'
                                          : 'bg-foreground/20'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/55">
                    SELECT A SHIP · THEN PRESS SPACE TO LAUNCH
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ignition sequence */}
          {gameState.phase === 'ignition' && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
              <div className="text-center space-y-8">
                <div className="space-y-3">
                  <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-cyan-400">
                    SYSTEMS INITIALIZING
                  </div>
                  <div className="h-0.5 w-32 bg-linear-to-r from-transparent via-cyan-400 to-transparent mx-auto" />
                </div>

                {/* Boot sequence stages */}
                <div className="space-y-2 text-left">
                  <div className="font-mono text-[9px] tracking-[0.15em] text-foreground/70">
                    ▸ POWER CORE: <span className="text-green-400">ONLINE</span>
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-foreground/70">
                    ▸ ENGINES: <span className="text-cyan-400">SPOOLING</span>
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-foreground/70">
                    ▸ WEAPONS: <span className="text-yellow-400">ARMED</span>
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.15em] text-foreground/70">
                    ▸ SHIELDS: <span className="text-green-400">ACTIVE</span>
                  </div>
                </div>

                {/* Launch countdown */}
                <div className="space-y-2">
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/55">
                    LAUNCH IN
                  </div>
                  <div className="font-serif text-5xl text-cyan-400 font-light">
                    {Math.max(0, Math.ceil(3.5 - ((gameState.ignitionStartTime ?? 0) - gameState.simTime)))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {gameState.phase === 'victory' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-500/20 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <div className="font-serif text-5xl text-green-400 mb-4 italic">
                  WAVE CLEAR
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55">
                  {gameState.wave === 4 ? 'WORLD SECURED' : 'PREPARE FOR NEXT WAVE'}
                </div>
              </div>
            </div>
          )}

          {gameState.phase === 'defeat' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-500/20 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <div className="font-serif text-5xl text-red-400 mb-4 italic">
                  LOST
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55">
                  PLANET COMPROMISED · RESTARTING WAVE
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control hints and flight info */}
      {gameState.phase === 'combat' && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none text-center">
          <div className="font-mono text-[8px] tracking-[0.25em] uppercase text-foreground/40 mb-2">
            ↑↓←→ ROTATE · W THRUST · SHIFT BOOST · Q/E ROLL
          </div>
          <div className="font-mono text-[9px] tracking-[0.15em] text-foreground/50">
            SHIELD: {Math.ceil((gameState.defendingPlanetHealth) * 100)}% · ENEMIES: {gameState.enemies.length}
          </div>
        </div>
      )}

      {/* Briefing control hint */}
      {gameState.phase === 'briefing' && (
        <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none text-center">
          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/55">
            SPACE TO EXPLORE
          </div>
        </div>
      )}
    </>
  );
}
