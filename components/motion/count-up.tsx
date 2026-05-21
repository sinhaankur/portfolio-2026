"use client"

import { useEffect, useRef, useState } from "react"
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "framer-motion"

type CountUpProps = {
  to: number
  from?: number
  duration?: number
  /** String shown before the number, e.g. "$". */
  prefix?: string
  /** String shown after the number, e.g. "+", "×", "%". */
  suffix?: string
  decimals?: number
  className?: string
}

/**
 * Ticks a number from `from` to `to` once it scrolls into view.
 * Under reduced-motion, jumps straight to the final value.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.4,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-15%" })
  const prefersReducedMotion = useReducedMotion()
  const motionValue = useMotionValue(from)
  const rounded = useTransform(motionValue, (v) =>
    `${prefix}${v.toFixed(decimals)}${suffix}`,
  )
  const [text, setText] = useState(`${prefix}${from.toFixed(decimals)}${suffix}`)

  useEffect(() => {
    const unsub = rounded.on("change", setText)
    return () => unsub()
  }, [rounded])

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion) {
      motionValue.set(to)
      return
    }
    const controls = animate(motionValue, to, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
    })
    return () => controls.stop()
  }, [inView, prefersReducedMotion, to, duration, motionValue])

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  )
}
