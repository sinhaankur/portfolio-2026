"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 *
 * Universe Engine — "Did you know?" learn ticker.
 *
 * Ambient teaching: the engine already carries 240+ real facts on its bodies,
 * but they only surface if you click one. This rotates a single real fact at a
 * time — a quiet on-ramp for a passive viewer to actually LEARN something, in
 * line with the product vision (the engine as a place to understand the
 * universe; see memory project_universe_engine_product_vision).
 *
 * Deliberately low-chrome + dismissible to respect the engine's reverence-over-
 * spectacle mission, and mobile-safe (compact, no fixed-element collisions).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { planetsData, moons, namedBodies } from "./astronomy"

// `focusId` (when set) is the exact pointId the scene's `universe:sky-focus`
// handlers match on, so tapping the subject flies the camera to that body —
// turning a passive fact into an invitation to go look. Planets resolve on
// `planet:<Name>` (planet-body.tsx) and named bodies on `named:<Name>`
// (small-bodies.tsx); moons have no focus handler, so they stay plain text
// rather than offering a click that would do nothing.
type Fact = { subject: string; fact: string; focusId?: string }

/** Gather real, non-empty facts from the body data into one shuffled pool. */
function collectFacts(): Fact[] {
  const out: Fact[] = []
  const push = (subject: string, fact: string | undefined, focusId?: string) => {
    if (fact && fact.trim().length > 0) out.push({ subject, fact: fact.trim(), focusId })
  }
  planetsData.forEach((p) => push(p.name, p.fact, `planet:${p.name}`))
  moons.forEach((m) => push(m.name, m.fact)) // moons aren't a fly-to target
  namedBodies.forEach((b) => push(b.name, b.fact, `named:${b.name}`))
  // Fisher–Yates shuffle so the order differs each load.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Ask the scene to fly to a body by its pointId — the same event the "Jump to"
 *  destinations menu dispatches, so it works across both scale modes. */
function focusBody(focusId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: focusId } }))
}

const ROTATE_MS = 11000

export function LearnTicker({ suppressed = false }: { suppressed?: boolean }) {
  const facts = useMemo(() => collectFacts(), [])
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (dismissed || paused || suppressed || facts.length === 0) return
    timer.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % facts.length)
    }, ROTATE_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [dismissed, paused, suppressed, facts.length])

  // Step aside while a body is focused — its InfoPanel / sheet is the teaching
  // surface then, and two info layers would collide.
  if (dismissed || suppressed || facts.length === 0) return null
  const current = facts[index]

  return (
    <div
      // Mobile: sit ABOVE the hero's bottom-left CTA stack (VIEW MY WORK /
      // RÉSUMÉ / UPCOMING), which wraps to ~2 rows at ≤640px — 172px clears it
      // with a gap so the now-tappable subject never sits under those buttons.
      // Desktop: the CTAs are bottom-left and this is centered, so bottom-24 is
      // already clear. env() keeps it above the home-bar on notched phones.
      className="pointer-events-none fixed inset-x-0 bottom-[max(172px,calc(env(safe-area-inset-bottom)+172px))] z-20 flex justify-center px-3 md:bottom-24"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex max-w-[min(92vw,40rem)] items-start gap-3 rounded-2xl border border-foreground/12 bg-background/55 px-4 py-2.5 backdrop-blur-md"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span className="mt-0.5 shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/45">
          Did you know
        </span>
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-foreground/80 md:text-[13px]">
          {current.focusId ? (
            // Focusable subject → a real button that flies you there. The
            // inline-flex + min-h-[44px] guarantees a comfortable touch target
            // on mobile without inflating the visible text; -my-2 keeps it on
            // the sentence baseline. underline dotted signals "this is a link".
            <button
              type="button"
              onClick={() => focusBody(current.focusId!)}
              onPointerUp={() => focusBody(current.focusId!)}
              data-cursor-hover
              aria-label={`Fly to ${current.subject}`}
              className="
                -my-2 mr-1 inline-flex min-h-[44px] items-center align-baseline
                font-medium text-accent underline decoration-dotted underline-offset-2
                transition-colors hover:text-foreground focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-accent rounded
              "
            >
              {current.subject}
            </button>
          ) : (
            <span className="font-medium text-foreground/95">{current.subject}</span>
          )}
          <span className="text-foreground/95">.</span>{" "}
          {current.fact}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          onPointerUp={() => setDismissed(true)}
          aria-label="Hide facts"
          data-cursor-hover
          className="-mr-2 -mt-1.5 shrink-0 grid h-9 w-9 place-items-center rounded-full font-mono text-[13px] leading-none text-foreground/55 transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
