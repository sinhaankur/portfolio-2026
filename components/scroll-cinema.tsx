"use client"

/**
 * ScrollCinema — a pinned, scroll-scrubbed act break ("scrollytelling").
 *
 * The technique: the section is N-viewports tall, its inner stage is
 * `position: sticky`, and scroll position *scrubs* an animation timeline
 * instead of moving the page — each line blooms in, holds while stationary
 * (readable), and recedes as the next takes the stage. Built natively with
 * framer-motion's useScroll/useTransform — no scroll-jacking, no library:
 * momentum, accessibility, and the scrollbar all stay honest.
 *
 * Used as an overture BEFORE the philosophy section: the four principle
 * claims pass cinematically at full-viewport scale, then the calm manifesto
 * below carries the actual reading (that section deliberately doesn't move —
 * see about.tsx). Reduced motion skips the overture entirely; the same
 * copy remains fully readable below, so nothing is lost.
 */

import { useRef } from "react"
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"

/** Per-viewport scroll length each line occupies. <1 keeps the scrub brisk. */
const VH_PER_LINE = 0.85

export function ScrollCinema({
  lines,
  startVisible = false,
}: {
  lines: string[]
  /**
   * Render the first line at full opacity at scroll position 0. Off by default:
   * as a mid-page act break the empty-stage opening works because the visitor
   * arrives already scrolling. Turn it ON when the cinema is the first thing on
   * a page (e.g. /lab) — otherwise landing there is a blank viewport with no
   * cue that anything exists below.
   */
  startVisible?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  })

  // The copy lives (readable, static) in the section below — the overture is
  // pure motion, so reduced-motion visitors simply skip it.
  if (prefersReducedMotion) return null

  const heightVh = Math.round(lines.length * VH_PER_LINE * 100 + 100)

  return (
    <section
      ref={ref}
      aria-hidden="true"
      // z-10 so the principle lines render ABOVE the hero's fixed galaxy
      // backdrop (z-0), which persists behind this act break as part of the
      // cinematic descent. The stage stays transparent so the stars show
      // through; the sky dissolves to background partway through (driven in
      // hero.tsx) so the lines finish over calm space, not a busy field.
      className="relative z-10"
      style={{ height: `${heightVh}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {lines.map((text, i) => (
          <CinemaLine
            key={i}
            text={text}
            index={i}
            total={lines.length}
            progress={scrollYProgress}
            startVisible={startVisible && i === 0}
          />
        ))}

        {/* Quiet scene counter, bottom-centre — the only chrome. */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {lines.map((_, i) => (
            <CinemaTick key={i} index={i} total={lines.length} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CinemaLine({
  text,
  index,
  total,
  progress,
  startVisible = false,
}: {
  text: string
  index: number
  total: number
  progress: MotionValue<number>
  startVisible?: boolean
}) {
  // Each line owns an equal window of the scrub; it blooms in over the first
  // quarter, holds (stationary = readable), and recedes over the last quarter.
  // A startVisible line skips the bloom: already on stage at progress 0, it
  // only holds and recedes.
  const start = index / total
  const end = (index + 1) / total
  const q = (end - start) / 4

  const opacity = useTransform(
    progress,
    [start, start + q, end - q, end],
    [startVisible ? 1 : 0, 1, 1, 0],
  )
  const scale = useTransform(
    progress,
    [start, start + q, end - q, end],
    [startVisible ? 1 : 0.94, 1, 1, 1.03],
  )
  const y = useTransform(progress, [start, end], [startVisible ? 0 : 28, -28])

  return (
    <motion.p
      style={{ opacity, scale, y }}
      className="
        absolute px-6 text-center
        font-display font-light italic tracking-[-0.01em] leading-[1.08]
        text-4xl md:text-6xl lg:text-7xl
        text-foreground max-w-5xl text-balance
        will-change-[opacity,transform]
      "
    >
      {text}
    </motion.p>
  )
}

function CinemaTick({
  index,
  total,
  progress,
}: {
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const start = index / total
  const end = (index + 1) / total
  const opacity = useTransform(progress, [start - 0.02, start, end, end + 0.02], [0.25, 1, 1, 0.25])
  return (
    <motion.span
      style={{ opacity }}
      className="block h-1 w-6 rounded-full bg-accent"
    />
  )
}
