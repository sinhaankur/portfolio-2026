'use client';

import { useEffect } from 'react';

/**
 * Branded short URL: /aero → the live Aero Engine 3D app (deployed separately on
 * GitHub Pages). Gives sinhaankur.com/aero/ as a clean entry point. Static export
 * can't do a server redirect, so we redirect client-side (replace, so Back
 * doesn't bounce) with a <meta http-equiv> fallback for no-JS.
 */
const TARGET = 'https://sinhaankur.github.io/aero-engine-3d/';

export default function AeroRedirect() {
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
          background: '#05070d',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        Opening Aero Engine 3D…{' '}
        <a href={TARGET} style={{ color: '#7fbfff', marginLeft: 8 }}>
          Continue
        </a>
      </div>
    </>
  );
}
