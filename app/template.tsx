"use client"

import { usePathname } from "next/navigation"

/**
 * Route transition — a quick, tasteful fade-in on every navigation so moving
 * between pages reads as a soft cut rather than a hard jump. App-Router
 * `template.tsx` re-mounts on each route change, so this runs per navigation.
 *
 * NO-JS / PRE-HYDRATION SAFE: the fade is a pure CSS keyframe animation
 * (`route-fade-in`, defined in globals.css) — content renders fully visible by
 * default; the animation just eases opacity from 0→1 when the browser paints it.
 * If JS never runs, the element is simply opaque. No opacity state, no invisible
 * content. prefers-reduced-motion disables the keyframe in CSS.
 *
 * IMPORTANT: routes with a full-viewport `position: fixed` WebGL backdrop (the
 * home galaxy hero, /sky, /tv) render WITHOUT the wrapper — an animated element
 * establishes a stacking context, and those pages rely on their fixed sky
 * painting at the root behind a transparent body. The fade is for content pages,
 * which is where it actually helps the flow.
 */
const NO_WRAP = new Set(["/", "/sky", "/tv"])

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (NO_WRAP.has(pathname)) return <>{children}</>
  return <div className="route-fade">{children}</div>
}
