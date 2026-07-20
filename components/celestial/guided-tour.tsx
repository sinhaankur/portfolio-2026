"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * GuidedTour — the first-run walkthrough that makes the whole toolkit legible to
 * someone landing cold. All the space-tech tools now exist, but a newcomer won't
 * discover them behind a menu. This is a short, skippable sequence — "what's
 * overhead · what's falling · the junk up there · collision risk" — each step
 * with one tap to actually try it. Shows once (localStorage), re-openable via the
 * "?" chip. Tools everyone can use and explore, made discoverable.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Compass, MapPin, Flame, Trash2, Crosshair, ArrowRight } from "lucide-react"

const SEEN_KEY = "celestial-tour-seen-v1"

export type TourAction = "overhead" | "reentry" | "debris" | "conjunctions"

type Step = {
  icon: React.ReactNode
  title: string
  body: string
  action?: { label: string; key: TourAction }
}

const STEPS: Step[] = [
  {
    icon: <Compass className="h-4 w-4" />,
    title: "18,600 real objects, live",
    body:
      "Everything orbiting Earth right now — satellites, spent rockets, debris — on real orbits from public tracking data. Not a picture; it's computed live in your browser.",
  },
  {
    icon: <MapPin className="h-4 w-4" />,
    title: "What's over you right now",
    body:
      "Share your location and it finds the closest object passing overhead, and shows how far any satellite is from you — the sky above your head, made visible.",
    action: { label: "Find what's overhead", key: "overhead" },
  },
  {
    icon: <Flame className="h-4 w-4" />,
    title: "What's falling back",
    body:
      "Some objects are sinking out of orbit and will re-enter soon. See which ones — and whether any pass over your latitude.",
    action: { label: "Open re-entry watch", key: "reentry" },
  },
  {
    icon: <Trash2 className="h-4 w-4" />,
    title: "The junk up there",
    body:
      "Four events made most of the debris in orbit. Isolate one cloud — a single 2007 anti-satellite test left ~1,900 tracked fragments, still circling.",
    action: { label: "Show debris clouds", key: "debris" },
  },
  {
    icon: <Crosshair className="h-4 w-4" />,
    title: "Close calls",
    body:
      "Objects pass dangerously close constantly. See the next 24 hours of near-misses, and fly to one to watch it happen — the awareness commercial operators pay for, open.",
    action: { label: "Open conjunction watch", key: "conjunctions" },
  },
]

export function GuidedTour({
  open,
  onClose,
  onAction,
}: {
  open: boolean
  onClose: () => void
  onAction: (key: TourAction) => void
}) {
  const [step, setStep] = useState(0)

  // Reset to the first step whenever it (re)opens.
  useEffect(() => { if (open) setStep(0) }, [open])

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, "1") } catch { /* private mode */ }
    onClose()
  }

  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-accent/40 bg-background/95 backdrop-blur-md p-4 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.8)] pointer-events-auto"
          role="dialog"
          aria-label="Guided tour"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-accent">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-accent/40 bg-accent/10">{s.icon}</span>
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
                Tour · {step + 1}/{STEPS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close tour"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <h3 className="mt-3 font-display text-lg font-light tracking-[-0.01em] leading-snug">{s.title}</h3>
          <p className="mt-1.5 font-sans text-[12px] leading-relaxed text-foreground/75">{s.body}</p>

          {s.action && (
            <button
              type="button"
              onClick={() => { onAction(s.action!.key); close() }}
              data-cursor-hover
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase text-accent hover:bg-accent/20 transition-colors"
            >
              {s.action.label} <ArrowRight className="h-3 w-3" />
            </button>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            {/* progress dots */}
            <div className="flex items-center gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-accent" : "w-1.5 bg-border"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => (last ? close() : setStep((v) => v + 1))}
                data-cursor-hover
                className="rounded-full bg-accent px-3.5 py-1.5 font-mono text-[10px] tracking-wider uppercase text-background hover:bg-accent/90 transition-colors"
              >
                {last ? "Explore" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Whether the tour has been seen before (SSR-safe). */
export function tourSeen(): boolean {
  if (typeof window === "undefined") return true
  try { return localStorage.getItem(SEEN_KEY) === "1" } catch { return true }
}
