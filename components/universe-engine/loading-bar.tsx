"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 *
 * LoadingBar — a single hairline progress bar pinned to the very bottom of the
 * screen while the engine is still streaming assets in. "Quality increases with
 * time": the scene paints light + instantly, then textures/geometry bloom in,
 * and this bar quietly communicates that the richer detail is on its way instead
 * of the wait reading as jank. It fills with REAL load progress (drei's
 * useProgress → three's DefaultLoadingManager), not a fake timer, then fades out
 * the moment loading completes. Purely presentational, DOM-only, zero per-frame
 * cost (a CSS width transition, no React churn while idle).
 */

import { useEffect, useRef, useState } from "react"
import { useProgress } from "@react-three/drei"

export function LoadingBar({ invert = false }: { invert?: boolean }) {
  const { active, progress } = useProgress()
  // Keep the bar mounted briefly after `active` drops so the fill can reach 100%
  // and fade out gracefully instead of vanishing mid-stream.
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    if (active) {
      if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null }
      setVisible(true)
    } else {
      // Let it settle at full, then fade.
      hideTimer.current = window.setTimeout(() => setVisible(false), 650)
    }
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current) }
  }, [active])

  // Never render a stuck empty bar: only show once there's real progress OR
  // loading is genuinely active.
  const width = active ? Math.max(4, Math.min(100, progress)) : 100

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-[2px] overflow-hidden transition-opacity duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Track (barely-there) */}
      <div className={invert ? "absolute inset-0 bg-black/5" : "absolute inset-0 bg-white/5"} />
      {/* Fill — real load %, eased. Warm-amber glow in dark mode, ink in light. */}
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
        style={{
          width: `${width}%`,
          background: invert
            ? "linear-gradient(90deg, rgba(20,20,20,0.4), rgba(20,20,20,0.85))"
            : "linear-gradient(90deg, rgba(255,190,120,0.35), rgba(255,214,170,0.95))",
          boxShadow: invert ? "none" : "0 0 8px rgba(255,200,140,0.5)",
        }}
      />
    </div>
  )
}
