'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const UniverseEngine = dynamic(() => import('@/components/universe-engine'), {
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
      </div>
    </div>
  );
}
