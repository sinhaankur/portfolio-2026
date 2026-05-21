"use client"

import { useRef } from "react"
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion"

const statements = [
  "I design the seam between humans and AI agents.",
  "The moment of decision, override, and trust.",
  "AI claims become trustworthy only when their uncertainty is legible.",
  "And their basis is checkable.",
  "Reversibility is the policy axis — not 'safety'.",
  "Code my own prototypes. The prototype is the design argument.",
]

export function About() {
  const containerRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-100%"])
  const smoothX = useSpring(x, { stiffness: 100, damping: 30 })

  return (
    <section
      ref={containerRef}
      id="about"
      aria-labelledby="about-heading"
      className="relative py-32 overflow-hidden md:py-24"
    >
      {/* Section Header — centered max-width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mx-auto w-full max-w-6xl px-6 md:px-10 mb-16 md:mb-20"
      >
        <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-4">
          03 — PHILOSOPHY
        </p>
        <h2
          id="about-heading"
          className="font-sans text-3xl md:text-5xl font-light italic"
        >
          Stream of consciousness
        </h2>
      </motion.div>

      {/* Horizontal Scroll Container (motion) / Stacked list (reduced-motion) */}
      {prefersReducedMotion ? (
        <ul className="mx-auto w-full max-w-6xl px-6 md:px-10 space-y-6">
          {statements.map((statement, index) => (
            <li
              key={index}
              className="font-sans text-2xl md:text-3xl font-light text-foreground/90 leading-snug"
            >
              {statement}
            </li>
          ))}
        </ul>
      ) : (
        <div className="relative flex items-center overflow-hidden py-0 gap-0 h-16">
          <motion.div
            style={{ x: smoothX }}
            aria-hidden="true"
            className="flex gap-16 md:gap-24 px-8 md:px-12 whitespace-nowrap"
          >
            {statements.map((statement, index) => (
              <p
                key={index}
                className="text-4xl md:text-6xl lg:text-7xl font-sans font-light tracking-tight text-foreground/90"
                style={{
                  WebkitTextStroke:
                    index % 2 === 0 ? "none" : "1px rgba(255,255,255,0.45)",
                  color: index % 2 === 0 ? "inherit" : "transparent",
                }}
              >
                {statement}
              </p>
            ))}
          </motion.div>

          {/* Accessible list — screen readers get the actual statements */}
          <ul className="sr-only">
            {statements.map((statement, index) => (
              <li key={index}>{statement}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Decorative Line — constrained to container width */}
      <motion.div
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-16 origin-left"
      >
        <div className="h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent" />
      </motion.div>
    </section>
  )
}
