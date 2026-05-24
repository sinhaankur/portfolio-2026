'use client';

import dynamic from 'next/dynamic';

const GameCanvas = dynamic(() => import('@/games/star-cleaver/engine/game-canvas'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#fff' }}>Loading Star Cleaver...</p>
    </div>
  ),
});

export default function StarCleaverGame() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      <GameCanvas />
    </div>
  );
}
