"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * ClearCacheButton — a small "wipe my temp data" escape hatch.
 *
 * Clears everything the site stashes in the browser: localStorage (tour-seen,
 * theme + display prefs, visitor id, dismissals), sessionStorage (intro/gesture
 * flags), the Cache Storage API, and any service worker — then hard-reloads with
 * a cache-busting query so you always get the freshest deploy. Useful when a
 * stale asset or a remembered flag is making the page misbehave.
 */

import { useState } from "react"
import { RotateCcw, Check } from "lucide-react"

export function ClearCacheButton({ className = "" }: { className?: string }) {
  const [done, setDone] = useState(false)

  async function clearAll() {
    try { localStorage.clear() } catch { /* private mode */ }
    try { sessionStorage.clear() } catch { /* */ }
    // Cache Storage API (any cached responses / assets).
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch { /* not supported */ }
    // Unregister any service worker so it can't serve stale files.
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch { /* */ }
    setDone(true)
    // Hard reload with a cache-busting param so the browser re-fetches.
    const url = new URL(window.location.href)
    url.searchParams.set("fresh", Date.now().toString(36))
    setTimeout(() => { window.location.replace(url.toString()) }, 350)
  }

  return (
    <button
      type="button"
      onClick={clearAll}
      data-cursor-hover
      aria-label="Clear cached data and reload"
      title="Clear cache & reload"
      className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-background/60 backdrop-blur-sm text-foreground/75 hover:text-accent hover:border-accent/60 transition-colors ${className}`}
    >
      {done ? <Check className="h-4 w-4 text-accent" /> : <RotateCcw className="h-4 w-4" />}
    </button>
  )
}
