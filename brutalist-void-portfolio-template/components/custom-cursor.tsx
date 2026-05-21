"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [enabled, setEnabled] = useState(false)

  // Only enable the custom cursor on devices with a fine pointer (mouse/trackpad)
  // AND when the user has NOT opted into reduced motion.
  useEffect(() => {
    if (typeof window === "undefined") return
    const finePointer = window.matchMedia("(pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    const update = () => {
      setEnabled(finePointer.matches && !reducedMotion.matches)
    }
    update()
    finePointer.addEventListener("change", update)
    reducedMotion.addEventListener("change", update)
    return () => {
      finePointer.removeEventListener("change", update)
      reducedMotion.removeEventListener("change", update)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      setIsVisible(true)
    }

    const handleMouseEnter = () => setIsVisible(true)
    const handleMouseLeave = () => setIsVisible(false)

    const handleHoverStart = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("a, button, [data-cursor-hover]")) {
        setIsHovering(true)
      }
    }

    const handleHoverEnd = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("a, button, [data-cursor-hover]")) {
        setIsHovering(false)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseenter", handleMouseEnter)
    document.addEventListener("mouseleave", handleMouseLeave)
    document.addEventListener("mouseover", handleHoverStart)
    document.addEventListener("mouseout", handleHoverEnd)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseenter", handleMouseEnter)
      document.removeEventListener("mouseleave", handleMouseLeave)
      document.removeEventListener("mouseover", handleHoverStart)
      document.removeEventListener("mouseout", handleHoverEnd)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      {/* Main cursor dot */}
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 w-3 h-3 bg-white rounded-full pointer-events-none z-10000 mix-blend-difference"
        animate={{
          x: position.x - 6,
          y: position.y - 6,
          scale: isHovering ? 0 : 5,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
      />
      {/* Hover ring */}
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 w-12 h-12 border border-white rounded-full pointer-events-none z-10000 mix-blend-difference"
        animate={{
          x: position.x - 24,
          y: position.y - 24,
          scale: isHovering ? 1 : 0,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20, mass: 0.8 }}
      />
    </>
  )
}
