'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { StaticStarfield } from '@/components/universe-engine/static-starfield';
import { useIsMobile } from '@/hooks/use-mobile';
import { UniverseRuntimeFallback } from '@/components/universe-engine/runtime-fallback';

const UniverseEngine = dynamic(() => import('@/components/universe-engine').then((mod) => mod.UniverseEngine), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <StaticStarfield />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255, 255, 255, 0.82)', fontFamily: 'monospace', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Loading Universe
        </p>
      </div>
    </div>
  ),
});

const GameCanvas = dynamic(() => import('@/games/star-cleaver/engine/game-canvas'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#fff' }}>Loading Helion Drift...</p>
    </div>
  ),
});

export default function HelionDriftExperience() {
  const [showGame, setShowGame] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [gameLoadTimedOut, setGameLoadTimedOut] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const isMobile = useIsMobile();

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
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
        <UniverseRuntimeFallback>
          <GameCanvas onReady={() => setGameReady(true)} />
        </UniverseRuntimeFallback>

        {gameLoadTimedOut && !gameReady && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '16px',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                maxWidth: '500px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.78)',
                backdropFilter: 'blur(12px)',
                padding: '16px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                Launch interrupted
              </p>
              <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: 1.5 }}>
                WebGL initialization took too long or failed in this environment.
              </p>
              <button
                type="button"
                onClick={handleBackToUniverse}
                style={{
                  marginTop: '14px',
                  padding: '8px 14px',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Back to Universe
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleBackToUniverse}
          style={{
            position: 'fixed',
            top: isMobile ? 'max(12px, env(safe-area-inset-top))' : '16px',
            left: isMobile ? '12px' : '16px',
            zIndex: 50,
            padding: isMobile ? '10px 14px' : '8px 16px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            fontSize: isMobile ? '11px' : '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: isMobile ? '0.08em' : '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ← Back to Universe
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      <UniverseRuntimeFallback>
        <UniverseEngine interactive showHud showMusic={false} />
      </UniverseRuntimeFallback>
      <div
        style={{
          position: 'fixed',
          top: isMobile ? 'max(12px, env(safe-area-inset-top))' : '16px',
          right: isMobile ? '12px' : '16px',
          left: isMobile ? '12px' : 'auto',
          zIndex: 30,
          maxWidth: isMobile ? 'none' : '320px',
          padding: isMobile ? '10px 12px' : '12px 14px',
          background: 'rgba(0, 0, 0, 0.58)',
          color: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '14px',
          backdropFilter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: isMobile ? '9px' : '10px',
            letterSpacing: isMobile ? '0.16em' : '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.62)',
            marginBottom: '6px',
          }}
        >
          Lab Engine · Science First
        </div>
        <p style={{ margin: 0, fontSize: isMobile ? '11px' : '12px', lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.78)' }}>
          This is the more detailed lab-side Universe Engine. It uses real astronomy data and stricter scale behavior than the home hero, and this is the version Helion Drift launches from.
        </p>
      </div>
      {/* Overlay hint for game discovery */}
      <div
        style={{
          position: 'fixed',
          bottom: isMobile ? 'max(14px, env(safe-area-inset-bottom))' : '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          textAlign: 'center',
          pointerEvents: 'none',
          width: isMobile ? 'calc(100vw - 24px)' : 'auto',
          maxWidth: isMobile ? '420px' : 'none',
        }}
      >
        <button
          onClick={handleLaunchGame}
          style={{
            pointerEvents: 'auto',
            width: isMobile ? '100%' : 'auto',
            padding: isMobile ? '12px 16px' : '12px 24px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            fontSize: isMobile ? '11px' : '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: isMobile ? '0.08em' : '0.1em',
            textTransform: 'uppercase',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
        >
          Launch Helion Drift
        </button>
        {launchError && (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: isMobile ? '10px' : '11px',
              lineHeight: 1.5,
              color: 'rgba(255, 170, 170, 0.95)',
              maxWidth: isMobile ? '100%' : '420px',
              fontFamily: 'monospace',
              letterSpacing: '0.03em',
            }}
          >
            {launchError}
          </p>
        )}
        <p
          style={{
            margin: '10px 0 0',
            fontSize: isMobile ? '10px' : '11px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.72)',
            maxWidth: isMobile ? '100%' : '320px',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
        >
          One-click launch. Start beside Earth and fly immediately in exploration mode.
        </p>
      </div>
    </div>
  );
}
