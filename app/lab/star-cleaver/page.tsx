'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
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
      <p style={{ color: '#fff' }}>Loading Star Cleaver...</p>
    </div>
  ),
});

export default function StarCleaverExperience() {
  const [showGame, setShowGame] = useState(false);
  const isMobile = useIsMobile();

  if (showGame) {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
        <UniverseRuntimeFallback>
          <GameCanvas />
        </UniverseRuntimeFallback>
        <button
          onClick={() => setShowGame(false)}
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
          This is the more detailed lab-side Universe Engine. It uses real astronomy data and stricter scale behavior than the home hero, and this is the version Star Cleaver launches from.
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
          onClick={() => setShowGame(true)}
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
          Launch Star Cleaver
        </button>
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
          Launch game, choose your world and ship together in Nexus, then go straight into ignition.
        </p>
      </div>
    </div>
  );
}
