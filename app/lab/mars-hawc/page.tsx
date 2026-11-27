'use client';

import { useEffect, useState } from 'react';

// Mars HAWC ships as a self-contained static bundle in public/games/mars-hawc/
// (a Claude-Docs .dc.html export + its three.js engine; three/React/Babel are
// vendored locally so the only external calls are fonts). We host it full-screen
// in an iframe rather than importing it as a module. This route is in the
// NO_WRAP set in app/template.tsx so the site chrome is stripped.
const GAME_SRC = '/games/mars-hawc/index.html';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function MarsHawcPage() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(hasWebGL()), []);

  if (ok === false) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'grid',
          placeItems: 'center',
          background: '#030405',
          color: 'rgba(239,230,210,.8)',
          fontFamily: 'var(--font-jetbrains), monospace',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 22, marginBottom: 10 }}>Mars HAWC needs WebGL</div>
          <div style={{ opacity: 0.7 }}>
            This browser or device has it switched off. Try a recent Chrome, Edge, Firefox or Safari.
          </div>
          <a href="/lab/" style={{ color: '#e2a516', display: 'inline-block', marginTop: 18 }}>
            Back to the Lab
          </a>
        </div>
      </div>
    );
  }
  if (ok === null) return <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#030405' }} />;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#030405' }}>
      <iframe
        src={GAME_SRC}
        title="Mars HAWC"
        allow="fullscreen; autoplay; gamepad; xr-spatial-tracking"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: '0', display: 'block' }}
      />
      <a
        href="/lab/"
        style={{
          position: 'fixed',
          top: 14,
          left: 16,
          zIndex: 70,
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 12,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'rgba(239,230,210,.72)',
          background: 'rgba(3,4,5,.55)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(239,230,210,.16)',
          borderRadius: 999,
          padding: '7px 13px',
          textDecoration: 'none',
        }}
      >
        ← Lab
      </a>
    </div>
  );
}
