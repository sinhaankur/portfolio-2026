'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { StaticStarfield } from '@/components/universe-engine/static-starfield';
import { UniverseRuntimeFallback } from '@/components/universe-engine/runtime-fallback';

const UniverseEngine = dynamic(() => import('@/components/universe-engine').then((mod) => mod.UniverseEngine), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <StaticStarfield loading />
    </div>
  ),
});

const GameCanvas = dynamic(() => import('@/games/star-cleaver/engine/game-canvas'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <StaticStarfield loading />
    </div>
  ),
});

export default function HelionDriftExperience() {
  const [showGame, setShowGame] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [gameLoadTimedOut, setGameLoadTimedOut] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const canUseWebGL = () => {
    if (typeof window === 'undefined') return true;
    try {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      if (gl2) return true;
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return Boolean(gl);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!showGame || gameReady) return;
    setGameLoadTimedOut(false);
    const timer = window.setTimeout(() => {
      setGameLoadTimedOut(true);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [showGame, gameReady]);

  const handleLaunchGame = () => {
    setLaunchError(null);
    setGameReady(false);
    setGameLoadTimedOut(false);

    if (!canUseWebGL()) {
      setLaunchError('WebGL is unavailable in this browser/device context.');
      return;
    }

    setShowGame(true);
  };

  const handleBackToUniverse = () => {
    setShowGame(false);
    setGameReady(false);
    setGameLoadTimedOut(false);
  };

  if (showGame) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-background">
        <UniverseRuntimeFallback>
          <GameCanvas onReady={() => setGameReady(true)} />
        </UniverseRuntimeFallback>

        {gameLoadTimedOut && !gameReady && (
          <div className="fixed inset-0 z-[45] grid place-items-center p-4 pointer-events-none">
            <div className="pointer-events-auto max-w-md rounded-2xl border border-foreground/20 bg-background/85 backdrop-blur-xl p-5 text-center text-foreground/90">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/60">
                Launch interrupted
              </p>
              <p className="mt-2.5 text-sm leading-relaxed">
                WebGL initialization took too long or failed in this environment.
              </p>
              <button
                type="button"
                onClick={handleBackToUniverse}
                data-cursor-hover
                className="mt-3.5 inline-flex items-center rounded-full border border-foreground/30 bg-background/40 px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Back to Universe
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleBackToUniverse}
          data-cursor-hover
          className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-50 inline-flex min-h-11 items-center rounded-full border border-foreground/30 bg-background/50 px-4 py-2.5 font-mono text-[11px] tracking-[0.1em] uppercase text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:left-4 md:top-4 md:text-xs"
        >
          ← Back to Universe
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Pre-launch backdrop: interactive solar system, but the engine's own
          HUD is suppressed so it doesn't collide with this page's launch
          chrome (timeline ↔ Launch button, reset/toggles ↔ info panel). The
          page owns a single, clean chrome layer for a premium feel. */}
      <UniverseRuntimeFallback>
        <UniverseEngine interactive showHud={false} showMusic={false} />
      </UniverseRuntimeFallback>

      {/* Lab-engine note — top-right info panel */}
      <div className="pointer-events-none fixed left-3 right-3 top-[max(12px,env(safe-area-inset-top))] z-30 rounded-2xl border border-foreground/15 bg-background/70 p-3 backdrop-blur-xl md:left-auto md:right-4 md:top-4 md:max-w-80 md:p-3.5">
        <div className="mb-1.5 font-mono text-[9px] tracking-[0.16em] uppercase text-foreground/55 md:text-[10px] md:tracking-[0.22em]">
          Lab Engine · Science First
        </div>
        <p className="text-[11px] leading-relaxed text-foreground/75 md:text-xs">
          This is the more detailed lab-side Universe Engine. It uses real astronomy data and stricter scale behavior than the home hero, and this is the version Helion Drift launches from.
        </p>
      </div>

      {/* Launch CTA — bottom-center */}
      <div className="pointer-events-none fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-[55] w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 text-center md:bottom-8 md:w-auto md:max-w-none">
        <button
          onClick={handleLaunchGame}
          data-cursor-hover
          className="pointer-events-auto inline-flex w-full min-h-11 items-center justify-center rounded-full border border-foreground/30 bg-background/50 px-6 py-3 font-mono text-[11px] tracking-[0.1em] uppercase text-foreground backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:w-auto md:text-xs"
        >
          Launch Helion Drift
        </button>
        {launchError && (
          <p className="mx-auto mt-2 max-w-full font-mono text-[10px] leading-relaxed tracking-[0.03em] text-destructive md:max-w-[420px] md:text-[11px]">
            {launchError}
          </p>
        )}
        <p className="mx-auto mt-2.5 max-w-full font-mono text-[10px] leading-relaxed tracking-[0.04em] text-foreground/70 md:max-w-80 md:text-[11px]">
          One-click launch. Start beside Earth and fly immediately in exploration mode.
        </p>
      </div>
    </div>
  );
}
