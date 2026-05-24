'use client';

import { useState } from 'react';
import type { GameState } from '../../../lib/neural-game-engine';

interface TestingConsoleProps {
  gameState: GameState;
  onStateChange: (state: GameState) => void;
}

export function TestingConsole({ gameState, onStateChange }: TestingConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'flight' | 'combat' | 'progression' | 'debug'>('flight');

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 px-3 py-1.5 bg-foreground/10 border border-foreground/30 rounded text-xs font-mono uppercase tracking-wider hover:bg-foreground/20 transition-colors"
        title="Testing Console (Ctrl+Shift+T)"
      >
        Test
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 max-h-[60vh] bg-background/95 border border-cyan-400/30 rounded-lg overflow-hidden flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-foreground/10 bg-foreground/5">
        <div className="font-mono text-[10px] tracking-widest uppercase text-cyan-400">Testing Console</div>
        <button onClick={() => setIsOpen(false)} className="text-foreground/50 hover:text-foreground">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-2 border-b border-foreground/10">
        {['flight', 'combat', 'progression', 'debug'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 text-xs font-mono tracking-widest uppercase transition-colors ${
              activeTab === tab ? 'text-cyan-400 border-b border-cyan-400' : 'text-foreground/50 hover:text-foreground/75'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-mono">
        {activeTab === 'flight' && (
          <div className="space-y-1">
            <div>Position: {gameState.playerEntity.position.x.toFixed(1)}, {gameState.playerEntity.position.y.toFixed(1)}, {gameState.playerEntity.position.z.toFixed(1)}</div>
            <div>Velocity: {gameState.playerEntity.velocity.x.toFixed(1)}, {gameState.playerEntity.velocity.y.toFixed(1)}, {gameState.playerEntity.velocity.z.toFixed(1)}</div>
            <div>Rotation: {gameState.playerEntity.rotation.x.toFixed(2)}, {gameState.playerEntity.rotation.y.toFixed(2)}, {gameState.playerEntity.rotation.z.toFixed(2)}</div>
            <button
              onClick={() => onStateChange({
                ...gameState,
                playerEntity: { ...gameState.playerEntity, position: { x: 0, y: 0, z: 0 } }
              })}
              className="mt-2 px-2 py-1 bg-cyan-400/20 border border-cyan-400/50 rounded text-cyan-400 hover:bg-cyan-400/30"
            >
              Reset Position
            </button>
          </div>
        )}

        {activeTab === 'combat' && (
          <div className="space-y-1">
            <div>Phase: {gameState.phase}</div>
            <div>Enemies: {gameState.enemies.length}</div>
            <div>Player Health: {gameState.playerEntity.health} / {gameState.playerMaxHealth}</div>
            <div>Planet Health: {(gameState.defendingPlanetHealth * 100).toFixed(0)}%</div>
            <div>Charge: {gameState.chargeLevel.toFixed(2)} / {gameState.maxCharge}</div>
            <button
              onClick={() => onStateChange({
                ...gameState,
                playerEntity: { ...gameState.playerEntity, health: gameState.playerMaxHealth }
              })}
              className="mt-2 px-2 py-1 bg-green-400/20 border border-green-400/50 rounded text-green-400 hover:bg-green-400/30"
            >
              Full Health
            </button>
          </div>
        )}

        {activeTab === 'progression' && (
          <div className="space-y-1">
            <div>World: {gameState.worldIndex + 1} / 7</div>
            <div>Wave: {gameState.wave} / 4</div>
            <div>Worlds Completed: {gameState.worldsCompleted}</div>
            <div>Score: {gameState.score}</div>
            <div>Ship: {gameState.selectedShip || 'none'}</div>
            <button
              onClick={() => onStateChange({
                ...gameState,
                worldsCompleted: Math.min(gameState.worldsCompleted + 1, 7)
              })}
              className="mt-2 px-2 py-1 bg-yellow-400/20 border border-yellow-400/50 rounded text-yellow-400 hover:bg-yellow-400/30"
            >
              +1 World Completed
            </button>
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="space-y-1">
            <div>Game State:</div>
            <div className="bg-foreground/5 p-2 rounded text-[9px] overflow-auto max-h-40">
              {JSON.stringify({
                phase: gameState.phase,
                worldIndex: gameState.worldIndex,
                wave: gameState.wave,
                worldsCompleted: gameState.worldsCompleted,
                selectedShip: gameState.selectedShip,
                simTime: gameState.simTime.toFixed(2),
              }, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
