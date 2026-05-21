"use client"

import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { useRef, type MouseEvent } from "react"

type MagneticProps = {
  children: ReactNode
  className?: string
  /** How strong the magnetic pull is. 0.3 = subtle, 0.8 = aggressive. */
  strength?: number
}

/**
 * Wraps an element so it nudges toward the cursor while hovered.
 * Works well on small CTAs. Skipped under reduced-motion.
 */
export function Magnetic({
  children,
  className = "",
  strength = 0.35,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 200, damping: 18, mass: 0.4 })
  const sy = useSpring(my, { stiffness: 200, damping: 18, mass: 0.4 })

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    mx.set(dx * strength)
    my.set(dy * strength)
  }

  const handleLeave = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={prefersReducedMotion ? undefined : { x: sx, y: sy }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  )
}
