"use client"

import { useEffect, useRef, useState } from "react"
import { RotateCcw, X } from "lucide-react"

/**
 * UpdateToast — a quiet "a new version is available" prompt.
 *
 * The site registers a service worker (public/sw.js) that caches the shell. When
 * a new deploy lands, the SW installs in the background and waits; without a nudge
 * the visitor keeps seeing the old cached version until they happen to reload.
 * This listens for that waiting worker and offers a one-tap refresh — the honest
 * fix for "I deployed but people see the old site".
 *
 * Also clears caches + storage on refresh (same as ClearCacheButton) so nothing
 * stale survives. Fully self-contained; renders nothing until an update is ready.
 * Respects reduced motion (CSS handles the entrance).
 */
export function UpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)
  // One guard shared by BOTH reload paths (controllerchange + the fallback
  // timeout) so a refresh can never fire two reloads.
  const reloadingRef = useRef(false)
  const reloadOnce = () => {
    if (reloadingRef.current) return
    reloadingRef.current = true
    window.location.reload()
  }

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    let cancelled = false

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return

      // Already a worker waiting (installed on a prior visit) → prompt now.
      if (reg.waiting) setWaiting(reg.waiting)

      // A new worker started installing → watch it reach "installed" (waiting).
      const onUpdateFound = () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener("statechange", () => {
          // Only prompt if there's an existing controller (i.e. this is an UPDATE,
          // not the very first install where nothing was cached yet).
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(sw)
          }
        })
      }
      reg.addEventListener("updatefound", onUpdateFound)

      // Nudge the browser to check for a fresh SW on load.
      reg.update().catch(() => {})
    })

    // When the new worker takes control, reload once to get the fresh assets.
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refresh() {
    // Clear caches + storage so nothing stale survives the reload.
    try { if (typeof caches !== "undefined") { const k = await caches.keys(); await Promise.all(k.map((n) => caches.delete(n))) } } catch { /* */ }
    // Tell the waiting worker to activate; controllerchange (above) reloads once.
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" })
      // Fallback if the worker never takes control — reloadOnce guards the race.
      setTimeout(reloadOnce, 1200)
    } else {
      reloadOnce()
    }
  }

  if (!waiting || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="update-toast fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-full border border-border bg-background/95 px-4 py-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md max-w-[calc(100vw-2rem)]"
    >
      <span className="font-sans text-[13px] text-foreground/85">A new version is available.</span>
      <button
        type="button"
        onClick={refresh}
        data-cursor-hover
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-mono text-[10px] tracking-[0.15em] uppercase text-accent-foreground hover:opacity-90 transition-opacity"
      >
        <RotateCcw className="h-3 w-3" /> Refresh
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-foreground/40 hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
