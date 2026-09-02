/**
 * config.ts — the tunable surface of the Optical Flow engine.
 *
 * Everything that decides how the engine *looks and behaves* lives here, kept
 * out of the orchestrator so the engine reads as one knob-board you can adjust
 * without touching the camera/RAF plumbing or the CV math. Same separation the
 * Universe Engine keeps between its data/params spine and its render layer.
 */

import type { FeaturePoint } from "./flow-core"

/** Render modes. "flow" = the original motion-tracking dots; the rest turn the
 *  whole frame into data (see pattern-render.ts). Defined here (the tunables
 *  home) so both config and pattern-render share it without a circular import. */
export type PatternMode = "flow" | "dataField" | "edges" | "regions" | "ascii"

export const MODES: { id: PatternMode; label: string; hint: string }[] = [
  { id: "flow", label: "Flow", hint: "Motion-tracked feature points" },
  { id: "dataField", label: "Data", hint: "The whole image as a field of colour points" },
  { id: "edges", label: "Edges", hint: "Contours — the structure of the scene" },
  { id: "regions", label: "Regions", hint: "A living low-bit mosaic" },
  { id: "ascii", label: "ASCII", hint: "Rebuilt from characters" },
]

/** Processing resolution — the CV runs on a small grayscale copy of the frame
 *  for speed (the original did the same with modest-res NumPy arrays), then the
 *  surviving points are drawn upscaled to the display canvas. */
export const PROC_W = 240
export const PROC_H = 180

/** Pyramid depth for Lucas-Kanade (coarse-to-fine, catches large motion). */
export const PYRAMID_LEVELS = 3

/** Lucas-Kanade tracking params. */
export const LK = { winSize: 7, iters: 6 } as const

/** SGP4-style detection cadence: re-seed via Shi-Tomasi when the field thins
 *  below this fraction of target, or every N frames regardless. */
export const REPLENISH = { thinFraction: 0.7, everyNFrames: 12 } as const

/**
 * Density (0..1) → the two numbers that drive coverage. Pulled into one place
 * so "denser/sparser" is a single honest mapping, not magic numbers buried in
 * the loop.
 */
export function densityToDetection(d: number): {
  maxCorners: number
  minDistance: number
  qualityLevel: number
} {
  return {
    // Many more points at full density — a rich, complete field (was 900).
    maxCorners: Math.round(400 + d * 1400), // 400..1800
    // Tighter spacing so dots pack in closely without clumping (min 2px).
    minDistance: Math.max(2, Math.round(7 - d * 5)), // 7..2
    // very low bar so even faint corners (cheeks, neck, background texture)
    // register — the whole form + surroundings fill in, not just hot spots
    qualityLevel: 0.008,
  }
}

export type Palette = {
  name: string
  bg: string
  /** colour for a dot given its age (frames tracked) + birth corner strength */
  dot: (age: number, strength: number) => string
}

export const PALETTES: Palette[] = [
  {
    name: "Ember",
    bg: "#08060a",
    dot: (age) => {
      // young = white-hot, ageing = amber → deep orange
      const t = Math.min(1, age / 40)
      const g = Math.round(240 - t * 150)
      const b = Math.round(200 - t * 190)
      return `rgb(255,${g},${b})`
    },
  },
  {
    name: "Cyan",
    bg: "#03070a",
    dot: (age) => {
      const t = Math.min(1, age / 40)
      const r = Math.round(120 - t * 100)
      const g = Math.round(220 - t * 60)
      return `rgb(${r},${g},255)`
    },
  },
  {
    name: "Mono",
    bg: "#000000",
    dot: () => "rgba(255,255,255,0.92)",
  },
]

/** Render tuning for the dot field — soft, varied, glowing (not flat discs). */
export const RENDER = {
  /** dot core radius in proc-px: base + strength-scaled bonus. Smaller base so
   *  the denser field stays crisp rather than a blur. */
  sizeBase: 1.1,
  sizeStrengthDiv: 500,
  sizeStrengthMax: 2.2,
  /** soft glow extends this × the core radius — a wider, gentler halo. */
  glowSpread: 2.8,
  /** alpha = alphaBase + strength bonus, × age fade-in */
  alphaBase: 0.5,
  alphaStrengthDiv: 900,
  alphaStrengthMax: 0.45,
  /** frames over which a new dot fades in (a touch slower = smoother arrivals) */
  fadeInFrames: 8,
  /** bright pin-point core radius as a fraction of the glow — gives each dot a
   *  crisp centre inside its halo, like a real light source. */
  coreDotFraction: 0.22,
} as const

/** Default engine params on mount. */
export const DEFAULTS = {
  density: 0.78,
  paletteIdx: 0,
  /** ghost the source video under the dots — OFF: the form should read from
   *  the dot field alone, floating on near-black, true to the reference. */
  ghostSource: false,
  /** Render mode — "flow" is the original motion-tracking effect; the others
   *  turn the whole frame into data (see pattern-render.ts). */
  mode: "flow" as PatternMode,
} as const

export type EngineParams = {
  density: number
  paletteIdx: number
  ghostSource: boolean
  mode: PatternMode
}

/** Re-export so consumers can type point arrays without reaching into core. */
export type { FeaturePoint }
