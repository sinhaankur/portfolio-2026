"use client"

/**
 * <Parallax> — scroll-linked depth. As the element scrolls through the viewport,
 * it drifts along Y at a configurable speed, so a page reads as layered space
 * instead of a flat stack: slower-moving things feel further back, faster ones
 * closer. The site-wide building block for the "explore an experience" feel.
 *
 * House rules (see the framer-motion skill):
 *  - Only the GPU-cheap `y` transform is animated — never width/height/top.
 *  - Reduced motion → no transform at all (renders a plain div).
 *  - Scroll input is smoothed with useSpring so it never feels jittery.
 *
 * Usage:
 *   <Parallax speed={-40}>…slower, drifts up as you pass (feels far)…</Parallax>
 *   <Parallax speed={60}>…faster, trails down (feels near)…</Parallax>
 *   speed is the total px of drift across the element's viewport pass.
 */

import { useRef } from "react"
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  type MotionStyle,
} from "framer-motion"

export function Parallax({
  children,
  speed = -40,
  className,
  style,
  as = "div",
}: {
  children: React.ReactNode
  /** Total Y drift (px) across the element's pass through the viewport. Negative = drifts up (far); positive = trails down (near). */
  speed?: number
  className?: string
  style?: MotionStyle
  as?: "div" | "section" | "span"
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // progress 0 (element entering bottom) → 1 (leaving top)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  // smooth the raw scroll so the drift glides instead of snapping to the wheel
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 30, mass: 0.3 })
  // map 0..1 → +half .. -half of the drift (centred so it's neutral mid-view)
  const y = useTransform(smooth, [0, 1], [speed / 2, -speed / 2])

  // Reduced motion (or SSR/first paint): render static, no transform.
  if (reduce) {
    return (
      <div ref={ref} className={className} style={style as React.CSSProperties}>
        {children}
      </div>
    )
  }

  // One motion component; `as` picks the semantic wrapper (div is the common case).
  const Comp =
    as === "section" ? motion.section : as === "span" ? motion.span : motion.div
  return (
    <Comp ref={ref} className={className} style={{ ...style, y }}>
      {children}
    </Comp>
  )
}
