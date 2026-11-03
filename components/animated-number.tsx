"use client"

/**
 * AnimatedNumber — a number that EASES to its value instead of snapping.
 *
 * Built on framer-motion (the site's one animation system — no new dependency).
 * This is the "feels alive, measured" touch from animation showcases: when a
 * real figure appears or updates (a satellite count, a stat, a distance), it
 * counts up to the target rather than popping in. The spring makes it feel
 * physical, not mechanical.
 *
 * Honest by default: respects prefers-reduced-motion (shows the final value
 * instantly, no motion), and formats with the SAME toLocaleString the raw
 * numbers already use, so "18,744" stays "18,744" — only the arrival animates.
 *
 * Usage:
 *   <AnimatedNumber value={swarmCount.total} />
 *   <AnimatedNumber value={26670} suffix=" ly" />
 */

import { useEffect } from "react"
import {
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  motion,
} from "framer-motion"

export function AnimatedNumber({
  value,
  /** appended after the number, inside the same element (e.g. " km", "+") */
  suffix = "",
  /** decimal places to show (default 0 — whole numbers) */
  decimals = 0,
  /** spring stiffness/damping — the default reads calm + settles cleanly */
  className,
}: {
  value: number
  suffix?: string
  decimals?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  // A raw motion value we push the target into; a spring smooths the journey.
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 1 })
  // Format each frame's value the same way the rest of the site does.
  const text = useTransform(spring, (v) =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix,
  )

  useEffect(() => {
    // Reduced motion (or SSR-safe fallback): jump straight to the value.
    if (reduce) {
      mv.jump(value)
      return
    }
    mv.set(value)
  }, [value, reduce, mv])

  // tabular-nums so the digits don't jitter width while counting.
  return <motion.span className={className}>{reduce ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix : text}</motion.span>
}
