'use client';

import { useMemo } from 'react';
import type { GameState } from '../../../lib/neural-game-engine';
import { formatScore, getCurrentWorldName } from './game-state';

interface HUDProps {
  gameState: GameState;
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

          {/* Phase overlay messages */}
          {gameState.phase === 'briefing' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-auto">
              <div className="text-center max-w-2xl px-6">
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55 mb-4">
                  INCOMING THREAT
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-foreground mb-6 leading-tight italic">
                  {worldName}
                </h2>
                <p className="text-foreground/75 font-sans text-base leading-relaxed mb-8">
                  Wave {gameState.wave} incoming. Prepare defensive systems.
                </p>
                <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/55">
                  CLICK TO BEGIN
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
