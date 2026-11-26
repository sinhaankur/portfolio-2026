'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { StaticStarfield } from '@/components/universe-engine/static-starfield';

const HelionDrift = dynamic(() => import('@/games/star-cleaver/drift/game'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }}>
      <StaticStarfield loading />
    </div>
  ),
});

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function HelionDriftPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(hasWebGL()), []);

  if (ok === false) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: '#000', color: 'rgba(239,230,210,.8)', fontFamily: 'var(--font-jetbrains), monospace', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 22, marginBottom: 10 }}>Helion Drift needs WebGL</div>
          <div style={{ opacity: 0.7 }}>This browser or device has it switched off. Try a recent Chrome, Edge, Firefox or Safari.</div>
          <a href="/lab/" style={{ color: '#e2a516', display: 'inline-block', marginTop: 18 }}>Back to the Lab</a>
        </div>
      </div>
    );
  }
  if (ok === null) return <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }} />;
  return <HelionDrift onExit={() => { window.location.href = '/lab/'; }} />;
}
