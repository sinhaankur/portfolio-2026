"use client"

/**
 * Intro — the site's opening EXPERIENCE, not a spinner.
 *
 * A deliberate cosmic-ignition build-up: black → a single point of light blooms
 * into a star field while an "ignition" progress runs 0→100 with evocative phase
 * lines, then the curtain DISSOLVES to reveal the live Universe Engine already
 * running underneath — so there's no snap/pop when the heavy R3F chunk mounts.
 *
 * Timing: holds a ~6s minimum AND waits for the engine's `universe-ready` event
 * (whichever is longer, capped) so the hand-off is seamless. Shows once per
 * browser session (sessionStorage); respects reduced motion.
 */

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const SESSION_KEY = "intro-shown-v2"
const MIN_VISIBLE_MS = 6000      // deliberate minimum on-screen time
const HARD_CAP_MS = 7500         // never hold past this, even if the engine never signals

const PHASES = [
  { at: 0.04, label: "Igniting" },
  { at: 0.28, label: "Calibrating star field" },
  { at: 0.52, label: "Plotting planetary orbits" },
  { at: 0.74, label: "Aligning constellations" },
  { at: 0.92, label: "Welcome" },
]

function phaseFor(p: number): string {
  let label = PHASES[0].label
  for (const ph of PHASES) if (p >= ph.at) label = ph.label
  return label
}

export function Intro() {
  const prefersReducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState(0)
  const engineReadyRef = useRef(false)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
    let already = false
    try {
      already = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      already = false
    }
    if (already) return

    setVisible(true)
    try {
      sessionStorage.setItem(SESSION_KEY, "1")
    } catch {
      /* private mode — fine */
    }

    // Reduced motion: short, quiet, no theatrics.
    if (prefersReducedMotion) {
      setProgress(1)
      const t = window.setTimeout(() => setVisible(false), 700)
      return () => window.clearTimeout(t)
    }

    const onReady = () => {
      engineReadyRef.current = true
    }
    window.addEventListener("universe-ready", onReady)

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      // Progress eases toward 1 over MIN_VISIBLE_MS, but the last ~8% is gated on
      // the engine actually being ready (or the hard cap) so the reveal is real.
      const timeP = Math.min(1, elapsed / MIN_VISIBLE_MS)
      const eased = 1 - Math.pow(1 - timeP, 2) // ease-out
      // Hold the last ~8% briefly to wait for the engine (so the home reveal has
      // no snap), but only as a SHORT grace window past the minimum — on pages
      // with no engine, or if it's slow, we still finish promptly.
      const pastMin = elapsed - MIN_VISIBLE_MS
      const waitingForEngine = !engineReadyRef.current && pastMin < 1500 && elapsed < HARD_CAP_MS
      const gate = waitingForEngine ? 0.92 : 1
      const p = Math.min(eased, gate)
      setProgress(p)

      const canFinish = elapsed >= MIN_VISIBLE_MS && !waitingForEngine
      if (canFinish && p >= 0.999) {
        setProgress(1)
        // brief beat at 100% ("Welcome") before the curtain lifts
        window.setTimeout(() => setVisible(false), 520)
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("universe-ready", onReady)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [prefersReducedMotion])

  // Lock scroll while the curtain is up.
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!mounted) return null

  const pct = Math.round(progress * 100)
  // The point of light blooms with progress.
  const bloom = 0.04 + progress * 1.0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] overflow-hidden bg-black"
          aria-hidden="true"
        >
          {/* Blooming point of light → star field. Pure CSS so it's instant. */}
          {!prefersReducedMotion && (
            <>
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  boxShadow: `0 0 ${40 * bloom}px ${14 * bloom}px rgba(255,246,224,${0.5 + progress * 0.4}), 0 0 ${160 * bloom}px ${60 * bloom}px rgba(140,180,255,${0.18 * progress})`,
                  background: "rgba(255,250,235,0.95)",
                  transform: `translate(-50%,-50%) scale(${1 + progress * 1.6})`,
                }}
              />
              {/* faint expanding ring — the ignition shock */}
              <div
                className="absolute left-1/2 top-1/2 rounded-full border border-white/10"
                style={{
                  width: 40,
                  height: 40,
                  transform: `translate(-50%,-50%) scale(${1 + progress * 16})`,
                  opacity: (1 - progress) * 0.5,
                }}
              />
              {/* drifting star specks fade in with progress */}
              <Starfield opacity={progress * 0.7} />
            </>
          )}

          {/* Centerpiece type + ignition progress */}
          <div className="relative z-10 grid h-full place-items-center px-6">
            <div className="flex flex-col items-center text-center">
              <motion.p
                className="font-display text-2xl md:text-3xl tracking-[-0.01em] text-white"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                Ankur Sinha
              </motion.p>
              <motion.p
                className="mt-1.5 font-mono text-[10px] tracking-[0.34em] uppercase text-white/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                Design × Engineering × AI
              </motion.p>
              <motion.p
                className="mt-4 font-mono text-[9px] tracking-[0.24em] uppercase text-white/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
              >
                Starting the Universe Engine — a real-time galaxy I built
              </motion.p>

              {/* progress line */}
              <div className="mt-8 h-px w-56 max-w-[70vw] overflow-hidden bg-white/12">
                <div
                  className="h-full bg-white/80"
                  style={{ width: `${pct}%`, transition: "width 120ms linear" }}
                />
              </div>
              <div className="mt-3 flex w-56 max-w-[70vw] items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
                <span>{phaseFor(progress)}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Lightweight CSS star specks that drift + fade in as the intro progresses. */
function Starfield({ opacity }: { opacity: number }) {
  const stars = useRef<{ x: number; y: number; s: number; d: number }[]>()
  if (!stars.current) {
    stars.current = Array.from({ length: 90 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: Math.random() * 1.6 + 0.4,
      d: Math.random() * 3,
    }))
  }
  return (
    <div className="absolute inset-0" style={{ opacity }}>
      {stars.current.map((st, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            opacity: 0.5 + Math.random() * 0.5,
            animation: `intro-twinkle ${2 + st.d}s ease-in-out ${st.d}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes intro-twinkle{0%,100%{opacity:.25}50%{opacity:.9}}`}</style>
    </div>
  )
}

// Back-compat: the layout imports { Preloader }.
export const Preloader = Intro
