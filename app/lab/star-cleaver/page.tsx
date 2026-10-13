'use client';

import { useEffect } from 'react';

/**
 * Legacy redirect: /lab/star-cleaver → /lab. Previously pointed at
 * /lab/helion-drift, but that game is hidden while its rendering is improved
 * (route removed 2026-10-12), so old Star Cleaver links now land on the Lab
 * index. Static export can't do a server redirect, so we redirect client-side
 * (replace, so Back doesn't bounce) with a <meta http-equiv> fallback for no-JS.
 */
const TARGET = '/lab/';

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
        Redirecting to the Lab…{' '}
        <a href={TARGET} style={{ color: '#7fbfff', marginLeft: 8 }}>
          Continue
        </a>
      </div>
    </>
  );
}
