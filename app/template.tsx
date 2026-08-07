"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Route transition — a quick, tasteful fade-in on every navigation so moving
 * between pages reads as a soft cut rather than a hard jump. App-Router
 * `template.tsx` re-mounts on each route change, so this runs per navigation.
 *
 * Kept deliberately minimal: opacity only (no transform), a short 260ms ease,
 * and fully disabled under prefers-reduced-motion. It never blocks interaction.
 *
 * IMPORTANT: routes with a full-viewport `position: fixed` WebGL backdrop (the
 * home galaxy hero, /sky, /tv) are rendered WITHOUT the wrapper. An `opacity`
 * div establishes a stacking context, and those pages rely on their fixed sky
 * painting at the root behind a transparent body — wrapping them would trap it.
 * The fade is for content pages, which is where it actually helps the flow.
 */
const NO_WRAP = new Set(["/", "/sky", "/tv"])

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const skip = NO_WRAP.has(pathname)
  const [shown, setShown] = useState(false)
  const [instant, setInstant] = useState(false)

  useEffect(() => {
    if (skip) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInstant(true)
      setShown(true)
      return
    }
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [skip])

  if (skip) return <>{children}</>

  return (
    <div
      style={{
        opacity: shown ? 1 : 0,
        transition: instant ? "none" : "opacity 260ms ease-out",
      }}
    >
      {children}
    </div>
  )
}
