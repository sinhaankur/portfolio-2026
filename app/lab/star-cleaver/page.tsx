'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const UniverseEngine = dynamic(() => import('@/components/universe-engine').then((mod) => mod.UniverseEngine), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#fff' }}>Loading Universe...</p>
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

  if (showGame) {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
        <GameCanvas />
        <button
          onClick={() => setShowGame(false)}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 50,
            padding: '8px 16px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
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
      <UniverseEngine interactive showHud showMusic invert />
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 30,
          maxWidth: '320px',
          padding: '12px 14px',
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
            fontSize: '10px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.62)',
            marginBottom: '6px',
          }}
        >
          Lab Engine · Science First
        </div>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: 'rgba(255, 255, 255, 0.78)' }}>
          This is the more detailed lab-side Universe Engine. It uses real astronomy data and stricter scale behavior than the home hero, and this is the version Star Cleaver launches from.
        </p>
      </div>
      {/* Overlay hint for game discovery */}
      <div
        style={{
          position: 'fixed',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <button
          onClick={() => setShowGame(true)}
          style={{
            pointerEvents: 'auto',
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
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
            fontSize: '11px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.72)',
            maxWidth: '320px',
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
