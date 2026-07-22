'use client';

import { useEffect } from 'react';

/**
 * Legacy redirect: /lab/star-cleaver → /lab/helion-drift. The game moved to the
 * Helion Drift name; this keeps old links working. Static export can't do a
 * server redirect, so we redirect client-side (replace, so Back doesn't bounce)
 * with a <meta http-equiv> fallback for no-JS. noindex is set in layout.tsx.
 */
const TARGET = '/lab/helion-drift/';

export default function StarCleaverRedirect() {
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
        Redirecting to Helion Drift…{' '}
        <a href={TARGET} style={{ color: '#7fbfff', marginLeft: 8 }}>
          Continue
        </a>
      </div>
    </>
  );
}
