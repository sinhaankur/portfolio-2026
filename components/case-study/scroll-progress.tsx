"use client"

/**
 * Reading-progress indicator for long-form case studies.
 *
 * A thin accent-coloured bar pinned just below the navbar that fills left-to-right
 * as the user scrolls. Works on every breakpoint — sits inside the navbar height
 * on mobile and just below the navbar's translucent strip on desktop.
 *
 * Uses framer-motion's useScroll + useSpring so the bar lerps smoothly with the
 * scroll position instead of jittering frame-by-frame. Respects reduced-motion
 * by disabling the spring smoothing (useTransform passes through linearly).
 */

import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion"

export function ScrollProgress() {
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  // Spring smooths the jitter that a raw motion value would produce, but only
  // when the user hasn't asked for reduced motion.
  const scaleX = useSpring(scrollYProgress, {
    stiffness: prefersReducedMotion ? 1000 : 180,
    damping: prefersReducedMotion ? 100 : 28,
    mass: 0.4,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="
        fixed top-[64px] md:top-[72px] left-0 right-0 z-40
        h-px bg-accent
        will-change-transform
      "
    />
  )
}
