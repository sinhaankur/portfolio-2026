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

type Fact = { subject: string; fact: string }

/** Gather real, non-empty facts from the body data into one shuffled pool. */
function collectFacts(): Fact[] {
  const out: Fact[] = []
  const push = (subject: string, fact?: string) => {
    if (fact && fact.trim().length > 0) out.push({ subject, fact: fact.trim() })
  }
  planetsData.forEach((p) => push(p.name, p.fact))
  moons.forEach((m) => push(m.name, m.fact))
  namedBodies.forEach((b) => push(b.name, b.fact))
  // Fisher–Yates shuffle so the order differs each load.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const ROTATE_MS = 11000

export function LearnTicker({ suppressed = false }: { suppressed?: boolean }) {
  const facts = useMemo(collectFacts, [])
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
      className="pointer-events-none fixed inset-x-0 bottom-[max(84px,calc(env(safe-area-inset-bottom)+84px))] z-20 flex justify-center px-3 md:bottom-24"
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
          <span className="font-medium text-foreground/95">{current.subject}.</span>{" "}
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
