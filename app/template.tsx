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
 * IMPORTANT: routes whose whole shell is a full-viewport `position: fixed`
 * element (the home galaxy hero, /sky, /tv, and the fixed-shell WebGL engine
 * pages /lab/celestial, /lab/big-bang, /story) render WITHOUT the wrapper. The
 * wrapper's `transform` (route-fade-in's translateY) turns every descendant
 * `position: fixed` into `absolute` relative to the (zero-height) wrapper, so a
 * `fixed inset-0` main collapses: its `h-full` child chain measures 0 and the
 * R3F <Canvas> falls back to its default 300×150 → the engine renders as a tiny
 * BLACK box ("/lab/celestial doesn't open / is a black screen"). The fade is for
 * normal CONTENT pages; these full-screen experiences keep their own backdrop.
 * (Pages that size themselves with `h-dvh` instead of `fixed` — /waves,
 * /embed/satellites — are immune and don't need listing here.)
 */
const NO_WRAP = new Set(["/", "/sky", "/tv", "/lab/celestial", "/lab/big-bang", "/story"])

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // next.config has trailingSlash:true, so usePathname() returns "/lab/celestial/"
  // — strip the trailing slash before matching or the exclusion silently misses
  // (which left the fixed-shell engine pages wrapped → collapsed to a black box).
  // Root "/" stays "/".
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (NO_WRAP.has(key)) return <>{children}</>
  return <div className="route-fade">{children}</div>
}
