/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Static starfield placeholder.
 *
 * Pure-CSS three-layer radial-gradient starfield. No JS, no Canvas, no
 * Three.js. Used as the lazy-load fallback for <UniverseEngine /> and as
 * the backdrop for the 404 page.
 *
 * Star density tiles in px so it stays consistent from phone (320 px) to
 * retina ultra-wide (3840 px+). Total weight is a couple of hundred bytes
 * after gzip — safe to render on every initial paint.
 */

import type { CSSProperties } from "react"

const DENSITY_PX: Record<"sparse" | "mid" | "dense", number> = {
  dense: 140,
  mid: 220,
  sparse: 320,
}

// Pre-computed pseudo-random star coordinates per layer so the
// server-rendered HTML matches the client render (no hydration mismatch).
const STAR_SEEDS: Record<"sparse" | "mid" | "dense", [number, number][]> = {
  dense: [
    [12, 18], [37, 56], [68, 22], [83, 73], [22, 88], [54, 41], [91, 32],
  ],
  mid: [
    [18, 28], [62, 14], [80, 60], [44, 78], [8, 64],
  ],
  sparse: [
    [30, 40], [70, 70], [50, 12],
  ],
}

function Layer({
  density,
  sizePx,
  blur,
  opacity,
}: {
  density: "sparse" | "mid" | "dense"
  sizePx: number
  blur: number
  opacity: number
}) {
  const tilePx = DENSITY_PX[density]
  const gradients = STAR_SEEDS[density]
    .map(
      ([x, y]) =>
        `radial-gradient(${sizePx}px ${sizePx}px at ${x}% ${y}%, rgba(255,255,255,${opacity}) 0%, transparent 60%)`,
    )
    .join(",")

  const style: CSSProperties = {
    backgroundImage: gradients,
    backgroundSize: `${tilePx}px ${tilePx}px`,
    backgroundRepeat: "repeat",
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
  }

  return <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={style} />
}

export function StaticStarfield() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <Layer density="dense" sizePx={1.5} blur={0} opacity={0.55} />
      <Layer density="mid" sizePx={2} blur={0.5} opacity={0.5} />
      <Layer density="sparse" sizePx={3} blur={1} opacity={0.7} />
    </div>
  )
}
