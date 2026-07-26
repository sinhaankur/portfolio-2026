/**
 * motion — one motion language for the whole site.
 *
 * Before this, two easing curves competed across components: the premium
 * expo-out `[0.16, 1, 0.3, 1]` (used most places) and an older, flatter
 * `[0.25, 0.46, 0.45, 0.94]`. Mixing them made the site feel slightly
 * inconsistent — some things settled crisply, others drifted. This file is the
 * single source of truth so every reveal, hover, and transition shares one calm,
 * cinematic feel.
 *
 * Usage (framer-motion):
 *   import { EASE, DUR, reveal } from "@/lib/motion"
 *   transition={{ duration: DUR.base, ease: EASE.out }}
 *   <motion.div {...reveal()} />
 */

/** Canonical easing curves (framer-motion cubic-bezier arrays). */
export const EASE = {
  /** The house curve — a soft, decisive expo-out. Use for almost everything:
   *  reveals, settles, camera, layout. */
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Symmetric ease for things that move A→B and should feel weighted at both
   *  ends (a fly-through, a scrub). */
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Gentle standard ease for small, incidental motion (a chip, a toggle). */
  soft: [0.4, 0, 0.2, 1] as [number, number, number, number],
} as const

/** The same house curve as a CSS `transition-timing-function` string. */
export const EASE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)"

/** Canonical durations (seconds), so timings don't drift component to component. */
export const DUR = {
  /** micro — hovers, toggles, tiny state flips. */
  fast: 0.2,
  /** base — the default for most reveals + transitions. */
  base: 0.6,
  /** slow — hero-scale reveals, section entrances. */
  slow: 0.9,
  /** cinematic — big curtain/scene moments. */
  cinematic: 1.2,
} as const

/**
 * A standard "reveal" — fade + a small rise, on the house curve. Pass a delay to
 * stagger. Returns framer-motion initial/animate/transition props.
 */
export function reveal(delay = 0, y = 16) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DUR.slow, delay, ease: EASE.out },
  }
}

/** A whileInView variant of reveal — for scroll-triggered section entrances. */
export function revealOnScroll(delay = 0, y = 20) {
  return {
    initial: { opacity: 0, y },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: DUR.slow, delay, ease: EASE.out },
  }
}
