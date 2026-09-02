"use client"

/**
 * MotionDemo — feel the Motion & Time laws on the /framework page.
 *
 * Two proofs in one card:
 *   1. Spring vs. tween — the SAME move (a dot crossing the arena) played with a
 *      timed easing curve and with simulated physics, side by side, so you feel
 *      the difference between "animated to a schedule" and "obeys physics".
 *   2. Doherty threshold — the same button action with an injected delay you can
 *      dial from instant to sluggish, so <400ms "feels like now" stops being an
 *      abstraction and becomes something your hand notices.
 *
 * Self-contained, reduced-motion-safe (falls back to opacity), no extra deps
 * beyond framer-motion (already a dependency).
 */

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

export function MotionDemo() {
  const reduce = useReducedMotion()
  // Spring-vs-tween: bump a key to replay both simultaneously.
  const [run, setRun] = useState(0)
  // Doherty: injected latency in ms, and the pending/committed state of the action.
  const [latency, setLatency] = useState(120)
  const [state, setState] = useState<"idle" | "pending" | "done">("idle")

  const play = () => setRun((n) => n + 1)

  const fire = () => {
    if (state === "pending") return
    setState("pending")
    window.setTimeout(() => {
      setState("done")
      window.setTimeout(() => setState("idle"), 900)
    }, latency)
  }

  const verdict =
    latency <= 100 ? "Instant — you stay in flow."
    : latency <= 400 ? "Still feels responsive (under the ~400ms Doherty line)."
    : latency <= 1000 ? "Noticeably laggy — attention starts to drift."
    : "Slow enough to context-switch away."

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h4 className="font-sans text-sm font-medium text-foreground">Feel motion &amp; time</h4>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">live demo</span>
      </div>
      <p className="font-sans text-[13px] text-foreground/60 leading-relaxed mb-5">
        Two things you can only understand by feeling them: the difference between
        a <span className="text-foreground/80">timed curve</span> and{" "}
        <span className="text-foreground/80">physics</span>, and where response
        time stops feeling instant.
      </p>

      {/* ── 1 · Spring vs tween ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-background/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Same move, two engines
          </span>
          <button
            type="button"
            onClick={play}
            data-cursor-hover
            className="rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 font-mono text-[10px] tracking-widest uppercase text-accent hover:bg-accent/20 transition-colors"
          >
            Play ▸
          </button>
        </div>
        <div className="space-y-3">
          {/* Tween track */}
          <div>
            <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-foreground/50">Tween · timed ease-out</div>
            <div className="relative h-8 rounded-full bg-secondary/40">
              <motion.span
                key={`tween-${run}`}
                className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-foreground"
                initial={reduce ? { opacity: 0, left: "calc(100% - 1.25rem)" } : { left: 2 }}
                animate={reduce ? { opacity: 1, left: "calc(100% - 1.25rem)" } : { left: "calc(100% - 1.25rem)" }}
                transition={reduce ? { duration: 0.3 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
          {/* Spring track */}
          <div>
            <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-foreground/50">Spring · physics (settles + overshoots)</div>
            <div className="relative h-8 rounded-full bg-secondary/40">
              <motion.span
                key={`spring-${run}`}
                className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-accent"
                initial={reduce ? { opacity: 0, left: "calc(100% - 1.25rem)" } : { left: 2 }}
                animate={reduce ? { opacity: 1, left: "calc(100% - 1.25rem)" } : { left: "calc(100% - 1.25rem)" }}
                transition={reduce ? { duration: 0.3 } : { type: "spring", stiffness: 260, damping: 12 }}
              />
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          The tween arrives on a schedule and stops dead. The spring accelerates,
          overshoots, and settles — the right feel for anything the user grabs.
        </p>
      </div>

      {/* ── 2 · Doherty threshold ───────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-4">
        <div className="mb-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
          The Doherty threshold — dial the delay
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={fire}
            data-cursor-hover
            aria-live="polite"
            className={`relative grid h-11 min-w-[7rem] place-items-center rounded-full px-5 font-mono text-[11px] tracking-widest uppercase transition-colors ${
              state === "done"
                ? "bg-accent text-background"
                : "border border-foreground/30 bg-foreground/5 text-foreground hover:border-accent/60"
            }`}
          >
            {state === "pending" ? (
              <motion.span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
                animate={reduce ? {} : { rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                aria-label="Working"
              />
            ) : state === "done" ? "Done ✓" : "Save"}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={1400}
              step={20}
              value={latency}
              onChange={(e) => setLatency(Number(e.target.value))}
              aria-label="Injected response latency in milliseconds"
              className="w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
              <span className="tabular-nums text-foreground/80">{latency} ms</span>
              <span>{verdict}</span>
            </div>
          </div>
        </div>
        {/* the 400ms line, marked on the scale */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary/40">
          <div
            className={`h-full rounded-full transition-all ${latency <= 400 ? "bg-accent/70" : "bg-red-400/60"}`}
            style={{ width: `${Math.min(100, (latency / 1400) * 100)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Tap Save at each delay. Under ~400ms the action feels like a direct
          extension of your intent; past it, you feel yourself waiting.
        </p>
      </div>
    </div>
  )
}
