'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GameState } from '../../../lib/neural-game-engine';
import { WORLD_STORIES } from './narrative';
import { PlayerShipModel, ProceduralPlayerShipModel } from './player-ship-model';
import { getAvailableShips, type SelectedShip } from './ship-selector';

interface NexusStationProps {
  gameState: GameState;
  onLaunchMission: (worldIndex: number, shipId: SelectedShip) => void;
}

function ShipPreviewModel({ shipId }: { shipId: SelectedShip }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.55;
    groupRef.current.rotation.x = -0.18 + Math.sin(state.clock.elapsedTime * 0.9) * 0.05;
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]} rotation={[-0.16, 0.6, 0]}>
      <Suspense fallback={<ProceduralPlayerShipModel shipId={shipId} mode="preview" />}>
        <PlayerShipModel shipId={shipId} mode="preview" />
      </Suspense>
    </group>
  );
}

function ShipPreviewPanel({ shipId, shipName }: { shipId: SelectedShip; shipName: string }) {
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-linear-to-b from-cyan-400/8 via-background/90 to-background/95 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div>
          <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-cyan-400/80">
            Live 3D Preview
          </div>
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-foreground/85 mt-1">
            {shipName}
          </div>
        </div>
        <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-foreground/45">
          Combat-ready silhouette
        </div>
      </div>

      <div className="relative h-64 overflow-hidden rounded-xl border border-foreground/10 bg-[radial-gradient(circle_at_50%_35%,rgba(96,165,250,0.18)_0%,rgba(8,11,18,0.92)_58%,rgba(3,5,9,1)_100%)] md:h-72">
        <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-cyan-300/10 to-transparent pointer-events-none" />
        <div className="absolute inset-x-8 bottom-6 h-px bg-linear-to-r from-transparent via-cyan-400/35 to-transparent pointer-events-none" />
        <Canvas camera={{ position: [0, 1.1, 8.2], fov: 34 }} dpr={[1, 1.5]}>
          <ambientLight intensity={1.35} />
          <directionalLight position={[5, 4, 6]} intensity={1.8} color="#d8f3ff" />
          <directionalLight position={[-4, -2, -5]} intensity={0.8} color="#8b5cf6" />
          <pointLight position={[0, 0, 4]} intensity={1.4} color="#22d3ee" />
          <ShipPreviewModel shipId={shipId} />
        </Canvas>
      </div>

      <p className="pt-3 font-mono text-[8px] tracking-[0.18em] uppercase text-foreground/45">
        Auto-rotating model uses the same procedural fighter variant you launch in-game.
      </p>
    </div>
  );
}

export function NexusStation({ gameState, onLaunchMission }: NexusStationProps) {
  const [selectedWorld, setSelectedWorld] = useState<number>(0);
  const [selectedShip, setSelectedShip] = useState<SelectedShip>(gameState.selectedShip as SelectedShip);
  const worldStory = WORLD_STORIES[selectedWorld];
  const availableShips = getAvailableShips(gameState.worldsCompleted);
  const selectedShipConfig = availableShips.find((ship) => ship.id === selectedShip) ?? availableShips[0];

  useEffect(() => {
    if (!availableShips.some((ship) => ship.id === selectedShip)) {
      setSelectedShip(availableShips[0].id as SelectedShip);
    }
  }, [availableShips, selectedShip]);

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
            Seven worlds. One weapon. Choose the target and the fighter, then launch.
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

            {/* Mission briefing + ship selection */}
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

              <div className="space-y-4 border-t border-foreground/10 pt-6">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-400 mb-4">
                    Select Vessel
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] gap-5 items-start">
                  <ShipPreviewPanel shipId={selectedShip} shipName={selectedShipConfig.name} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableShips.map((ship) => (
                      <button
                        key={ship.id}
                        onClick={() => setSelectedShip(ship.id as SelectedShip)}
                        className={`group relative p-5 rounded-lg border transition-all duration-300 text-left ${
                          selectedShip === ship.id
                            ? 'border-cyan-400/60 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_18px_50px_rgba(8,145,178,0.12)]'
                            : 'border-foreground/20 bg-foreground/5 hover:border-cyan-400/40 hover:bg-cyan-400/8'
                        }`}
                      >
                        <div className="relative space-y-3">
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
                onClick={() => onLaunchMission(selectedWorld, selectedShip)}
                className="w-full px-6 py-3 border border-cyan-400/50 bg-cyan-400/10 text-cyan-400 font-mono text-sm tracking-widest uppercase hover:bg-cyan-400/20 transition-colors rounded"
              >
                LAUNCH {worldStory.name.toUpperCase()} WITH {availableShips.find((ship) => ship.id === selectedShip)?.name.toUpperCase() ?? 'CLASSIC X-WING'}
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
