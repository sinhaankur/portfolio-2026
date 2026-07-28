"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * EmbedTracker — a lean, iframe-able satellite tracker. Others can drop a live
 * view of the ~18,500 tracked objects (real SGP4 orbits) into their own site
 * with one <iframe>. Minimal chrome, self-contained, and clearly labelled:
 * built on PUBLIC data, for AWARENESS/EDUCATION — not operational decisions.
 * Observe & understand, never operate (see SSA-OPENSOURCE-MAP.md).
 */

import dynamic from "next/dynamic"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"

// Reuse the exact same engine; lazy-load so the iframe paints instantly with the
// static starfield, then the R3F bundle blooms in — no heavy blocking payload.
const UniverseEngine = dynamic(
  () => import("@/components/universe-engine").then((m) => ({ default: m.UniverseEngine })),
  { ssr: false, loading: () => <StaticStarfield loading /> },
)

export function EmbedTracker() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* The engine, Earth-orbit only, lean chrome for an embed. */}
      <UniverseEngine interactive showHud showMusic={false} solarOnly minimalControls quietMobileChrome realtime />

      {/* Compliance + attribution strip — small, always visible, non-blocking.
          The bright line: this is transparency, not operations. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-center justify-between gap-2 px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
        <span className="font-mono text-[8px] sm:text-[9px] tracking-wide text-white/55 leading-tight">
          Live SGP4 · public data (CelesTrak/NORAD · NASA · NOAA). For awareness &amp; education —
          not operational maneuver decisions.
        </span>
        <a
          href="https://www.sinhaankur.com/lab/celestial/"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto shrink-0 font-mono text-[8px] sm:text-[9px] tracking-[0.15em] uppercase text-white/70 hover:text-white transition-colors"
        >
          sinhaankur.com ↗
        </a>
      </div>
    </div>
  )
}
