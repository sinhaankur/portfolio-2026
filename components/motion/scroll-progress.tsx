"use client"

import { motion, useScroll, useSpring } from "framer-motion"

/**
 * Thin accent-colored line at the very top of the page that fills as the user
 * scrolls. A small, premium visual signal that always tells the reader where
 * they are in the document.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 20,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: smooth, transformOrigin: "0% 50%" }}
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-accent"
    />
  )
}
