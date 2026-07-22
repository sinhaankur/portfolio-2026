'use client';

import { useEffect } from 'react';

/**
 * Legacy redirect: /lab/universe-assistant → /lab/celestial. The assistant is
 * now a keyless, on-device copilot folded into the Satellite Engine (tap the ✦
 * button). Static export can't do a server redirect, so we redirect client-side
 * (replace, so Back doesn't bounce) with a <meta refresh> fallback for no-JS.
 */
const TARGET = '/lab/celestial/';

export default function UniverseAssistantRedirect() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${TARGET}`} />
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#000',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        Opening the Satellite Engine…{' '}
        <a href={TARGET} style={{ color: '#7fbfff', marginLeft: 8 }}>
          Continue
        </a>
      </div>
    </>
  );
}
