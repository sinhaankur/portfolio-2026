"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion"
import { StaticStarfield } from "./universe-engine/static-starfield"

// The R3F universe scene is ~250 KB compressed of Three.js + drei + custom
// shaders. Loading it eagerly blocks the home page's first paint and bloats
// the initial JS payload for visitors who never scroll past the typography.
//
// Split it into a separate chunk that streams in after first paint. While
// it's loading, show the static starfield so the hero still reads as a
// cosmic scene instead of a blank rectangle.
const UniverseEngine = dynamic(
  () => import("./universe-engine").then((m) => ({ default: m.UniverseEngine })),
  {
    ssr: false,
    loading: () => <StaticStarfield />,
  },
)

export function Hero() {
  const containerRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [interactive, setInteractive] = useState(false)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8])

  // Esc exits explore mode
  useEffect(() => {
    if (!interactive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInteractive(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [interactive])

  return (
    <section
      ref={containerRef}
      aria-labelledby="hero-name"
      // Hero tracks the page theme. In dark mode it reads as the classic
      // planetarium; in light mode the universe engine flips itself into
      // chart mode (ink stars on cream paper, warm-amber sun, hairline orbits)
      // via its internal theme detection.
      className="relative h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {/* Visually-hidden semantic H1 — gives screen readers a clean page title */}
      <h1 id="hero-name" className="sr-only">
        Ankur Sinha — Principal UX Designer, Human–AI Interaction
      </h1>

      {/* Universe engine — galaxy + solar system + constellations.
          Passive backdrop by default so page scroll works; explore mode flips it interactive. */}
      <div className="absolute inset-0" aria-hidden="true">
        <UniverseEngine interactive={interactive} />
      </div>

      {/* Explore-mode toggle — placed BELOW the fixed navbar on mobile (top-20
          ≈ navbar height + gap) and at a clear top-right cluster on desktop. */}
      <div className="absolute top-20 right-4 md:top-24 md:right-12 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setInteractive((v) => !v)}
          data-cursor-hover
          aria-pressed={interactive}
          className="
            inline-flex items-center gap-2 px-4 py-2.5
            border border-foreground/25 rounded-full
            bg-background/40 backdrop-blur-sm
            font-mono text-[10px] tracking-[0.25em] uppercase
            text-foreground/85 hover:text-foreground hover:border-accent/60
            transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            focus-visible:ring-offset-2 focus-visible:ring-offset-background
            min-h-11 touch-manipulation
          "
        >
          {interactive ? (
            <>
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="hidden sm:inline">Exploring · Esc to exit</span>
              <span className="sm:hidden">Exploring · tap to exit</span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-accent">✺</span>
              Tap to explore
            </>
          )}
        </button>
      </div>

      {/* Drag/scroll hint while exploring */}
      {interactive && (
        <p className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/55 pointer-events-none">
          Drag to look · scroll to zoom from solar system to galaxy
        </p>
      )}

      {/* Typography Overlay — pointer-events disabled on the wrapper so drag passes through to the canvas */}
      <motion.div
        style={prefersReducedMotion ? undefined : { opacity, scale }}
        className="relative z-10 h-full flex flex-col justify-between p-8 md:p-12 md:px-12 md:py-20 pointer-events-none"
      >
        {/* Top Left */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-2">
            01 — DISCIPLINE
          </p>
          <p
            aria-hidden="true"
            className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-balance"
          >
            PRINCIPAL
            <br />
            <span className="italic">DESIGNER</span>
          </p>
        </motion.div>

        {/* CTA — anchored bottom-left, out of the way of the central sun */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute bottom-12 left-8 md:bottom-20 md:left-12 z-20 pointer-events-auto"
        >
          <motion.a
            href="#works"
            data-cursor-hover
            whileHover={prefersReducedMotion ? undefined : { x: 4 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="
              group relative inline-flex items-center gap-3
              px-7 py-3.5 border border-foreground/30 rounded-full
              font-mono text-xs tracking-[0.25em] uppercase
              bg-background/40 backdrop-blur-sm
              text-foreground
              hover:bg-foreground hover:text-background hover:border-foreground
              transition-colors duration-500
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              min-h-11
            "
          >
            <span
              aria-hidden="true"
              className="relative flex h-1.5 w-1.5"
            >
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Enter Work
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </motion.a>
        </motion.div>

        {/* Bottom Right */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="self-end text-right"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-2">
            02 — DOMAIN
          </p>
          <p
            aria-hidden="true"
            className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-balance"
          >
            HUMAN–AI
            <br />
            <span className="italic">INTERACTION</span>
          </p>
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        aria-hidden="true"
      >
        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : { y: [0, 8, 0] }
          }
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Scroll
          </span>
          <div className="w-px h-8 bg-linear-to-b from-foreground/50 to-transparent" />
        </motion.div>
      </motion.div>
    </section>
  )
}
