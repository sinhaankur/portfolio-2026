"use client"

/**
 * Star Cleaver page — full-bleed game container.
 *
 * Lazy-loads the game module the same way the home hero lazy-loads
 * the Universe Engine: keeps the R3F bundle off the first paint and
 * shows the static starfield as a fallback while React Three Fiber
 * hydrates. The page chrome is minimal — a small top-left back link
 * over the scene, no global navbar (the game is the page).
 */

import dynamic from "next/dynamic"
import Link from "next/link"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"

const StarCleaver = dynamic(
  () => import("@/components/games/star-cleaver").then((m) => m.StarCleaver),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0">
        <StaticStarfield />
      </div>
    ),
  },
)

export function StarCleaverPage() {
  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <StarCleaver />

      {/* Top-right back link — kept small, doesn't fight the HUD. */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30">
        <Link
          href="/games/Gamelist.html"
          className="
            inline-flex items-center gap-1.5
            font-mono text-[10px] sm:text-xs uppercase tracking-[0.18em]
            text-white/70 hover:text-white
            bg-black/40 hover:bg-black/60
            px-2.5 py-1.5 rounded
            border border-white/15
            backdrop-blur-sm
            transition-colors
          "
          aria-label="Back to games index"
        >
          ← Games
        </Link>
      </div>
    </div>
  )
}
