/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
 *
 * Living starfield placeholder.
 *
 * Pure-CSS three-layer radial-gradient starfield. No JS, no Canvas, no
 * Three.js. Used as the lazy-load fallback for <UniverseEngine /> and as
 * the backdrop for the 404 page.
 *
 * Each layer twinkles on its own cadence and drifts slowly for parallax (see
 * the `ue-star-*` keyframes in globals.css), so while the ~250 KB R3F bundle
 * loads the fallback reads as "alive + loading" rather than a frozen image.
 * Pass `loading` to overlay a soft breathing "Loading" indicator. Honors
 * prefers-reduced-motion + the in-app Display "reduce motion" toggle.
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
  twinkle,
  drift,
  driftX,
  driftY,
}: {
  density: "sparse" | "mid" | "dense"
  sizePx: number
  blur: number
  opacity: number
  twinkle: number   // seconds per twinkle cycle
  drift: number     // seconds per parallax drift
  driftX: number    // px the layer drifts horizontally
  driftY: number
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
    // consumed by the ue-star-* keyframes
    ["--ue-twinkle" as string]: `${twinkle}s`,
    ["--ue-drift" as string]: `${drift}s`,
    ["--ue-drift-x" as string]: `${driftX}px`,
    ["--ue-drift-y" as string]: `${driftY}px`,
    ["--ue-star-min" as string]: `${Math.max(0, opacity - 0.3)}`,
    ["--ue-star-max" as string]: `${opacity}`,
  }

  return <div aria-hidden="true" className="ue-star-layer absolute inset-0 pointer-events-none" style={style} />
}

export function StaticStarfield({ loading = false }: { loading?: boolean }) {
  return (
    <div aria-hidden={!loading} className="absolute inset-0 overflow-hidden">
      {/* near layer twinkles fastest + drifts most (parallax); far layer is calm */}
      <Layer density="dense" sizePx={1.5} blur={0} opacity={0.55} twinkle={3.2} drift={70} driftX={60} driftY={36} />
      <Layer density="mid" sizePx={2} blur={0.5} opacity={0.5} twinkle={4.6} drift={110} driftX={36} driftY={22} />
      <Layer density="sparse" sizePx={3} blur={1} opacity={0.7} twinkle={6.2} drift={160} driftX={18} driftY={12} />

      {loading && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2.5">
            <span className="ue-loading-dot inline-block h-1.5 w-1.5 rounded-full bg-foreground/80" />
            <span className="ue-loading-label font-mono text-[10px] tracking-[0.28em] uppercase text-foreground/70">
              Loading
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
