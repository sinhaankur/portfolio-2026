'use client';

import { useState } from 'react';
import type { GameState } from '../../../lib/neural-game-engine';
import { WORLD_STORIES } from './narrative';

interface NexusStationProps {
  gameState: GameState;
  onWorldSelect: (worldIndex: number) => void;
}

export function NexusStation({ gameState, onWorldSelect }: NexusStationProps) {
  const [selectedWorld, setSelectedWorld] = useState<number>(0);
  const worldStory = WORLD_STORIES[selectedWorld];

  return (
    <div className="fixed inset-0 z-50 bg-background pointer-events-auto overflow-y-auto">
      {/* Command center backdrop */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(59,182,242,0.3)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.2)_0%,transparent_50%)]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-foreground/10 px-6 md:px-12 py-8 space-y-4">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400">
            ◆ NEXUS COMMAND CENTER ◆
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-foreground leading-tight italic">
            Humanity Stands
          </h1>
          <p className="text-foreground/70 font-sans text-base max-w-2xl">
            Seven worlds. One weapon. The Cleaver is ready to defend.
          </p>
        </div>

        {/* Fleet Status */}
        <div className="px-6 md:px-12 py-8 border-b border-foreground/10">
          <div className="grid grid-cols-3 gap-4 md:gap-8">
            <div className="space-y-1">
              <div className="font-mono text-[9px] tracking-widest uppercase text-foreground/50">
                Worlds Held
              </div>
              <div className="font-mono text-3xl text-cyan-400">
                {gameState.worldsCompleted} / 7
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[9px] tracking-widest uppercase text-foreground/50">
                Current Score
              </div>
              <div className="font-mono text-2xl text-green-400">
                {gameState.score.toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[9px] tracking-widest uppercase text-foreground/50">
                Threat Level
              </div>
              <div className="font-mono text-lg text-red-400 uppercase">
                Critical
              </div>
            </div>
          </div>
        </div>

        {/* World selector and mission briefing */}
        <div className="px-6 md:px-12 py-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* World selection */}
            <div className="lg:col-span-1 space-y-4">
              <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55 mb-4">
                Select World
              </div>
              <div className="space-y-2">
                {WORLD_STORIES.map((world, idx) => (
                  <button
                    key={world.id}
                    onClick={() => setSelectedWorld(idx)}
                    className={`w-full px-4 py-3 rounded border transition-all text-left font-mono text-sm tracking-wider uppercase ${
                      selectedWorld === idx
                        ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
                        : 'border-foreground/20 hover:border-foreground/40 text-foreground/60 hover:text-foreground/80'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{world.number}. {world.name}</span>
                      {gameState.worldsCompleted > idx && <span className="text-green-400">✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mission briefing */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400">
                    {worldStory.number}. {worldStory.name} — {worldStory.threatLevel.toUpperCase()} THREAT
                  </div>
                  <h2 className="font-serif text-3xl text-foreground italic">
                    {worldStory.briefing}
                  </h2>
                </div>

                <div className="space-y-3 text-foreground/75 font-sans text-base leading-relaxed">
                  <p>{worldStory.story}</p>
                  <div className="pt-2 border-t border-foreground/10">
                    <p className="text-sm text-foreground/60">
                      <span className="text-foreground/80 font-semibold">Strategic Importance:</span> {worldStory.significance}
                    </p>
                  </div>
                </div>
              </div>

              {/* Commander message if exists */}
              {worldStory.commanderMessage && (
                <div className="bg-foreground/5 border border-foreground/10 rounded p-4 space-y-2">
                  <div className="font-mono text-[9px] tracking-widest uppercase text-foreground/50">
                    Command Center Message
                  </div>
                  <p className="font-mono text-sm text-foreground/80 italic">
                    "{worldStory.commanderMessage}"
                  </p>
                </div>
              )}

              {/* Launch button */}
              <button
                onClick={() => onWorldSelect(selectedWorld)}
                className="w-full px-6 py-3 border border-cyan-400/50 bg-cyan-400/10 text-cyan-400 font-mono text-sm tracking-widest uppercase hover:bg-cyan-400/20 transition-colors rounded"
              >
                LAUNCH DEFENSIVE MISSION
              </button>

              {/* Flavor status */}
              <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/40 text-center pt-2">
                {worldStory.flavor}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
