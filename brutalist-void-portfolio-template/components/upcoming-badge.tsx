"use client"

import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

type UpcomingBadgeProps = {
  href?: string
  label?: string
}

export function UpcomingBadge({
  href = "/upcoming",
  label = "Upcoming",
}: UpcomingBadgeProps) {
  const prefersReducedMotion = useReducedMotion()
  const [isMounted, setIsMounted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <motion.a
      href={href}
      aria-label={`${label} — preview the next portfolio build`}
      data-cursor-hover
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isMounted ? 1 : 0,
        y: isMounted ? 0 : 20,
      }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="
        group fixed bottom-6 right-6 z-50
        inline-flex items-center gap-3
        rounded-full border border-border
        bg-background/70 backdrop-blur-md
        px-4 py-3 md:px-5 md:py-3
        font-mono text-[11px] tracking-[0.25em] uppercase
        text-foreground/90 hover:text-foreground
        shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]
        transition-colors duration-300
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-accent
        focus-visible:ring-offset-2 focus-visible:ring-offset-background
        min-h-11
      "
    >
      {/* Pulse dot — motion-safe only */}
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {!prefersReducedMotion && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>

      <span>{label}</span>

      <motion.span
        aria-hidden="true"
        animate={
          prefersReducedMotion
            ? undefined
            : { rotate: isHovered ? 45 : 0, x: isHovered ? 2 : 0 }
        }
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="inline-flex"
      >
        <ArrowUpRight className="h-4 w-4" />
      </motion.span>
    </motion.a>
  )
}
