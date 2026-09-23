"use client"

/**
 * SunHistoryPanel — an OPT-IN walk through the real history and future of the
 * Sun. The Sun renders as "today" by default; only when the user scrubs this
 * timeline does the engine's Sun actually change (sunLifeStageRef drives the
 * shader colour + the mesh swell/collapse live in the scene). Every era, number,
 * and planet fate is sourced astrophysics from lib/sun-timeline.ts — inference is
 * labelled, sources are listed. Closing the panel returns the Sun to today.
 *
 * https://github.com/sinhaankur/portfolio-2026
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sun, X, RotateCcw } from "lucide-react"
import { sunLifeStageRef } from "@/components/universe-engine/astronomy"
import {
  SUN_ERAS,
  PLANET_FATES,
  PAST_HABITABILITY,
  SUN_TIMELINE_SOURCES,
  SUN_AGE_NOW_GYR,
} from "@/lib/sun-timeline"

// Map an era's time-from-now to the shader life stage (0 today → 1 red giant →
// 2 white dwarf). Pre-giant eras stay at 0 (the Sun looks like today); the giant
// branch ramps 0→1, then the remnant 1→2.
function eraToStage(atGyrFromNow: number): number {
  if (atGyrFromNow <= 3.5) return 0
  if (atGyrFromNow <= 5.0) return 0.5
  if (atGyrFromNow <= 5.4) return 1.0
  if (atGyrFromNow <= 7.6) return 1.6
  return 2.0
}

export function SunHistoryPanel({ onClose }: { onClose: () => void }) {
  // default to "now" (index of the atGyrFromNow===0 era)
  const nowIdx = Math.max(0, SUN_ERAS.findIndex((e) => e.atGyrFromNow === 0))
  const [idx, setIdx] = useState(nowIdx)
  const era = SUN_ERAS[idx]

  // Drive the engine Sun live as the user scrubs. Reset to "today" on close.
  useEffect(() => {
    sunLifeStageRef.current = eraToStage(era.atGyrFromNow)
  }, [era])
  useEffect(() => {
    return () => { sunLifeStageRef.current = 0 } // restore the Sun on unmount
  }, [])

  const relTime = (g: number) => {
    if (g === 0) return "today"
    const abs = Math.abs(g)
    const t = abs >= 1 ? `${abs.toFixed(abs < 10 ? 1 : 0)} billion yr` : `${Math.round(abs * 1000)} million yr`
    return g < 0 ? `${t} ago` : `in ${t}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(26rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#ffb347]/45 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ffb347]">
          <Sun className="h-3.5 w-3.5" /> History &amp; fate of the Sun
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="font-sans text-[13px] leading-relaxed text-foreground/70">
          The Sun stays as it is <span className="text-foreground">today</span> unless
          you scrub — this is opt-in. Drag through its ~10-billion-year life and the
          Sun in the scene changes with you.
        </p>

        {/* the scrubber */}
        <input
          type="range"
          min={0}
          max={SUN_ERAS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => setIdx(parseInt(e.target.value, 10))}
          className="w-full accent-[#ffb347]"
          aria-label="Sun life-stage timeline"
        />
        <div className="flex items-center justify-between font-mono text-[9px] tracking-wider text-muted-foreground">
          <span>formation</span>
          <button
            type="button"
            onClick={() => setIdx(nowIdx)}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> back to today
          </button>
          <span>white dwarf</span>
        </div>

        {/* current era */}
        <div className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#ffb347]">{era.phase}</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{relTime(era.atGyrFromNow)}</span>
          </div>
          <h3 className="mt-1 font-display text-lg leading-tight text-foreground">{era.title}</h3>
          {era.lumVsNow != null && (
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              brightness ≈ {era.lumVsNow >= 1 ? `${era.lumVsNow}×` : `${Math.round(era.lumVsNow * 100)}%`} of today
              {era.inference && <span className="ml-1 text-[#ffb347]/80">· projected</span>}
            </p>
          )}
          <p className="mt-2 font-sans text-[13px] leading-relaxed text-foreground/80">{era.detail}</p>
          <p className="mt-2 font-sans text-[12px] leading-relaxed text-foreground/60">
            <span className="text-foreground/80">The planets — </span>{era.planets}
          </p>
        </div>

        {/* past habitability — the honest, counter-intuitive bit */}
        <details className="rounded-lg border border-border bg-background/40 p-3">
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
            Could Venus or Mars have hosted life?
          </summary>
          <div className="mt-2 space-y-2">
            {PAST_HABITABILITY.map((h) => (
              <p key={h.name} className="font-sans text-[12px] leading-relaxed text-foreground/70">
                <span className="text-foreground/90">{h.name}: </span>{h.note}
              </p>
            ))}
          </div>
        </details>

        {/* planet fates */}
        <details className="rounded-lg border border-border bg-background/40 p-3">
          <summary className="cursor-pointer font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
            Each planet&apos;s fate
          </summary>
          <ul className="mt-2 space-y-1.5">
            {PLANET_FATES.map((p) => (
              <li key={p.name} className="font-sans text-[12px] leading-relaxed text-foreground/70">
                <span className="text-foreground/90">{p.name} — </span>{p.fate}
              </li>
            ))}
          </ul>
        </details>

        <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/70">
          Sun is {SUN_AGE_NOW_GYR} billion years old. Sources: {SUN_TIMELINE_SOURCES.join(" · ")}.
        </p>
      </div>
    </motion.div>
  )
}
