"use client"

/**
 * GestaltDemo — a live proof of the Gestalt grouping principles on /framework.
 *
 * A grid of dots. A single slider changes ONE thing — the spacing between
 * groups vs. within them — and the eye's reading flips from "one field" to
 * "four groups" with no lines, boxes or colour. It's the doc's practical rule
 * made interactive: give related things less space than their neighbours, and
 * grouping appears for free. A second toggle swaps proximity for similarity
 * (colour) to show the other lever.
 *
 * Self-contained, reduced-motion-safe, no deps.
 */

import { useState } from "react"

export function GestaltDemo() {
  // 0 = even spacing (reads as one field) → 1 = grouped spacing (reads as 4 groups)
  const [gap, setGap] = useState(0)
  const [mode, setMode] = useState<"proximity" | "similarity">("proximity")

  const groups = 4
  const perGroup = 9 // 3×3 mini-grid per group
  // within-group gap shrinks and between-group gap grows as `gap` rises.
  const withinGap = 10 - gap * 4 // 10 → 6 px
  const betweenGap = 12 + gap * 40 // 12 → 52 px
  const groupColors = ["#e0a34b", "#5aa9a3", "#c46fa0", "#7b8add"]

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h4 className="font-sans text-sm font-medium text-foreground">Feel Gestalt grouping</h4>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">live demo</span>
      </div>
      <p className="font-sans text-[13px] text-foreground/60 leading-relaxed mb-4">
        Same dots, no lines or boxes. Drag the slider and watch one field split
        into four groups — proximity alone does the grouping. Switch to colour to
        feel similarity do the same job.
      </p>

      {/* mode toggle */}
      <div className="mb-4 inline-flex rounded-full border border-border p-0.5">
        {(["proximity", "similarity"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            data-cursor-hover
            className={`rounded-full px-4 py-1 font-mono text-[10px] tracking-widest uppercase transition-colors ${
              mode === m ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "proximity" ? "By proximity" : "By similarity"}
          </button>
        ))}
      </div>

      {/* the dot field */}
      <div className="grid place-items-center rounded-xl border border-border bg-background/60 py-8">
        <div className="flex" style={{ gap: mode === "proximity" ? betweenGap : 22 }}>
          {Array.from({ length: groups }).map((_, gi) => (
            <div
              key={gi}
              className="grid grid-cols-3"
              style={{ gap: mode === "proximity" ? withinGap : 8 }}
            >
              {Array.from({ length: perGroup }).map((_, di) => (
                <span
                  key={di}
                  className="h-2.5 w-2.5 rounded-full transition-colors"
                  style={{
                    background: mode === "similarity" ? groupColors[gi] : "var(--accent, #e0a34b)",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* proximity slider (only meaningful in proximity mode) */}
      {mode === "proximity" && (
        <div className="mt-4">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            <span>one field</span>
            <span>four groups</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={gap}
            onChange={(e) => setGap(parseFloat(e.target.value))}
            aria-label="Group spacing"
            className="w-full accent-accent"
          />
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] text-muted-foreground leading-relaxed">
        {mode === "proximity"
          ? "Give related things less space than their neighbours and grouping appears — no borders needed. Most 'cluttered' layouts are really evenly-spaced ones."
          : "Shared colour reads as a set — the other grouping lever. Break it to signal 'this one is different'."}
      </p>
    </div>
  )
}
