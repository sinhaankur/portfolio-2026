"use client"

import { useState } from "react"

/**
 * ZoomLadder — the progressive drill-down control, the pattern every serious
 * orbit viewer uses (LeoLabs / CelesTrak): full-Earth overview → orbital shell →
 * close surface, reachable in one tap instead of hunting with the scroll wheel.
 *
 * It's DISCOVERABILITY for depth: free 360° orbit + scroll-zoom still work; this
 * just gives named stops so a newcomer knows how deep they can go. Each rung fires
 * the engine's existing `universe:sky-focus` channel with a `framing` the
 * planet-body listener understands (system reset · earth-moon · shell · surface).
 *
 * Right-edge vertical stepper, desktop; on mobile it collapses into the Time/Tools
 * bar area, so it never crowds the scene (kept off at ≤ md via the caller).
 */

type Rung = { id: string; label: string; framing?: string; system?: boolean }

const RUNGS: Rung[] = [
  { id: "system", label: "System", system: true },        // wide reset — whole solar view
  { id: "earth", label: "Earth", framing: "earth-moon" },  // Earth + Moon's orbit
  { id: "shell", label: "Shell", framing: "shell" },       // tight on the LEO satellite band
  { id: "surface", label: "Surface", framing: "surface" }, // skim just above the globe
]

export function ZoomLadder() {
  const [active, setActive] = useState<string | null>(null)

  const go = (r: Rung) => {
    setActive(r.id)
    if (r.system) {
      // Eased fly back to the wide view: the engine already glides to reset on
      // Escape (its capture-phase handler), so reuse that instead of threading a
      // new reset channel through the engine.
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      return
    }
    window.dispatchEvent(
      new CustomEvent("universe:sky-focus", {
        detail: { pointId: "planet:Earth", framing: r.framing },
      }),
    )
  }

  return (
    <div
      className="pointer-events-auto flex flex-col items-stretch gap-1 rounded-2xl border border-border bg-background/60 backdrop-blur-md p-1"
      role="group"
      aria-label="Zoom depth"
    >
      {RUNGS.map((r, i) => (
        <button
          key={r.id}
          type="button"
          data-cursor-hover
          onClick={() => go(r)}
          aria-pressed={active === r.id}
          title={`Zoom: ${r.label}`}
          className={`relative flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[10px] tracking-widest uppercase transition-colors ${
            active === r.id
              ? "bg-accent/15 text-accent"
              : "text-foreground/70 hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          {/* depth rail: a growing bar so the ladder reads as levels of depth */}
          <span
            aria-hidden
            className={`h-4 w-0.5 rounded-full ${active === r.id ? "bg-accent" : "bg-foreground/25"}`}
            style={{ transform: `scaleY(${0.5 + i * 0.18})`, transformOrigin: "center" }}
          />
          {r.label}
        </button>
      ))}
    </div>
  )
}
