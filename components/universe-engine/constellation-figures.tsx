"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Universe Engine — constellation figures.
 *
 * Classical celestial-atlas line drawings (Hevelius / Bayer tradition) for
 * the constellations whose mythological figures we render on focus. Pure
 * stroke art — no fills, currentColor stroke — so the figure inherits the
 * page theme (white-on-ink in dark mode, ink-on-cream in chart mode).
 *
 * Each figure is normalised to a 200×200 viewBox centred on (100, 100).
 * The scene renders the figure inside a drei <Html> overlay at the
 * constellation's centroid, scaled to roughly span the constellation's
 * footprint on the sky-shell. We don't aim for pixel-perfect star-by-star
 * alignment; the figure is an annotation that says "this is what this
 * asterism represents," not a tracing.
 *
 * To add another constellation:
 *   1. Add an SVG component below.
 *   2. Register it in CONSTELLATION_FIGURES.
 *   3. Done — the scene picks it up by constellation id.
 */

import type { ReactNode } from "react"
import type { ConstellationId } from "./types"

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
}

/* ---------- Orion the Hunter ---------- */
/**
 * Standing figure mid-stride. Bow drawn back in left hand, club raised in
 * right. The belt (three short ticks horizontal across the torso) sits
 * where the actual belt stars project. Sword hangs below the belt.
 */
function OrionFigure() {
  return (
    <svg viewBox="0 0 200 200" {...strokeProps}>
      {/* Head */}
      <circle cx="100" cy="38" r="9" />
      {/* Body / spine */}
      <line x1="100" y1="47" x2="100" y2="118" />
      {/* Shoulders */}
      <line x1="78" y1="60" x2="122" y2="60" />
      {/* Right arm — raised, holding club */}
      <path d="M 122 60 L 150 50 L 160 30" />
      {/* Club (a thicker short segment at the wrist) */}
      <line x1="158" y1="34" x2="168" y2="22" strokeWidth="2.2" />
      {/* Left arm — drawing bow */}
      <path d="M 78 60 L 52 76" />
      {/* The bow (curve) — vertical arc to the left of the figure */}
      <path d="M 42 50 Q 28 78 42 110" />
      {/* Bowstring */}
      <line x1="42" y1="50" x2="42" y2="110" strokeDasharray="2 3" />
      {/* Belt — three short tick marks across the torso */}
      <line x1="86"  y1="92" x2="92"  y2="92" />
      <line x1="96"  y1="92" x2="104" y2="92" />
      <line x1="108" y1="92" x2="114" y2="92" />
      {/* Sword hanging from belt */}
      <line x1="100" y1="94" x2="100" y2="112" />
      <line x1="96"  y1="110" x2="104" y2="110" />
      {/* Hips */}
      <line x1="86" y1="118" x2="114" y2="118" />
      {/* Legs — mid-stride */}
      <line x1="86" y1="118" x2="72" y2="172" />
      <line x1="114" y1="118" x2="128" y2="172" />
      {/* Feet */}
      <line x1="65" y1="172" x2="78" y2="172" />
      <line x1="122" y1="172" x2="135" y2="172" />
    </svg>
  )
}

/* ---------- Leo the Lion ---------- */
/**
 * Lion in profile, walking left. Mane curves over the head/neck (matching
 * the famous "Sickle" asterism — Leo's head is a reverse question mark).
 * Body horizontal, tail curving up at the back.
 */
function LeoFigure() {
  return (
    <svg viewBox="0 0 200 200" {...strokeProps}>
      {/* Head profile — facing left */}
      <path d="M 60 92 Q 44 88 42 100 Q 44 112 56 110" />
      {/* Nose tick */}
      <line x1="40" y1="100" x2="36" y2="100" />
      {/* Mane — the Sickle curve, sweeping from behind the head up and back */}
      <path d="M 56 92 Q 70 60 100 60 Q 130 64 142 88" />
      {/* Body — horizontal back line */}
      <path d="M 56 110 Q 100 116 152 108" />
      {/* Belly */}
      <path d="M 70 122 Q 110 130 144 122" />
      {/* Front legs */}
      <line x1="64" y1="120" x2="60" y2="158" />
      <line x1="78" y1="124" x2="74" y2="158" />
      <line x1="56" y1="158" x2="68" y2="158" />
      <line x1="70" y1="158" x2="82" y2="158" />
      {/* Back legs */}
      <line x1="132" y1="122" x2="128" y2="158" />
      <line x1="146" y1="118" x2="142" y2="158" />
      <line x1="124" y1="158" x2="136" y2="158" />
      <line x1="138" y1="158" x2="150" y2="158" />
      {/* Tail — curves up from the back hip */}
      <path d="M 150 110 Q 168 96 170 76" />
      {/* Tail tuft */}
      <path d="M 168 78 L 174 70 M 170 76 L 178 74" />
    </svg>
  )
}

/* ---------- Cygnus the Swan ---------- */
/**
 * Swan in flight along the Milky Way, wings outstretched. The asterism is
 * famously called the Northern Cross — the figure renders as a cross-like
 * shape with the wings as the crossbar and the neck/tail as the upright.
 */
function CygnusFigure() {
  return (
    <svg viewBox="0 0 200 200" {...strokeProps}>
      {/* Long neck + head */}
      <path d="M 100 30 L 100 70 Q 96 76 92 78" />
      {/* Beak */}
      <line x1="92" y1="78" x2="84" y2="80" />
      {/* Body */}
      <ellipse cx="100" cy="105" rx="14" ry="22" />
      {/* Wings — outstretched, each a long curved line with feather ticks */}
      {/* Left wing */}
      <path d="M 88 100 L 30 92" />
      <path d="M 88 105 L 28 108" />
      {/* Left wing feathers */}
      <line x1="46" y1="94" x2="42" y2="84" />
      <line x1="58" y1="94" x2="54" y2="86" />
      <line x1="70" y1="98" x2="68" y2="90" />
      {/* Right wing */}
      <path d="M 112 100 L 170 92" />
      <path d="M 112 105 L 172 108" />
      {/* Right wing feathers */}
      <line x1="154" y1="94" x2="158" y2="84" />
      <line x1="142" y1="94" x2="146" y2="86" />
      <line x1="130" y1="98" x2="132" y2="90" />
      {/* Tail */}
      <path d="M 100 127 L 100 158" />
      <line x1="92" y1="158" x2="108" y2="158" />
      {/* Tail feathers */}
      <line x1="94" y1="154" x2="90" y2="166" />
      <line x1="100" y1="154" x2="100" y2="168" />
      <line x1="106" y1="154" x2="110" y2="166" />
    </svg>
  )
}

/* ---------- Lyra the Lyre ---------- */
/**
 * Orpheus's lyre. A small harp shape with two curved arms and four strings
 * stretched between them. Vega — Lyra's brightest star — sits roughly
 * where the soundbox meets the arms in the classical drawings.
 */
function LyraFigure() {
  return (
    <svg viewBox="0 0 200 200" {...strokeProps}>
      {/* Soundbox base (small turtle-shell trapezoid) */}
      <path d="M 78 158 L 122 158 L 130 138 L 70 138 Z" />
      {/* Two curved arms rising from the soundbox */}
      <path d="M 76 138 Q 50 100 70 50" />
      <path d="M 124 138 Q 150 100 130 50" />
      {/* Crossbar between the arm tips */}
      <line x1="64" y1="56" x2="136" y2="56" />
      {/* Strings */}
      <line x1="80" y1="56" x2="84" y2="138" />
      <line x1="92" y1="56" x2="95" y2="138" />
      <line x1="108" y1="56" x2="105" y2="138" />
      <line x1="120" y1="56" x2="116" y2="138" />
      {/* Tuning pegs */}
      <circle cx="80" cy="56" r="2.5" />
      <circle cx="92" cy="56" r="2.5" />
      <circle cx="108" cy="56" r="2.5" />
      <circle cx="120" cy="56" r="2.5" />
    </svg>
  )
}

/* ---------- Cassiopeia the Queen ---------- */
/**
 * Queen Cassiopeia seated on her throne. The asterism is the W-shape
 * (or M-shape depending on the season); the figure shows the seated
 * queen whose silhouette traces that zigzag.
 */
function CassiopeiaFigure() {
  return (
    <svg viewBox="0 0 200 200" {...strokeProps}>
      {/* Head with simple crown */}
      <circle cx="100" cy="50" r="9" />
      <path d="M 91 44 L 91 36 M 100 41 L 100 33 M 109 44 L 109 36" />
      {/* Body / dress */}
      <path d="M 90 60 L 80 130 L 120 130 L 110 60 Z" />
      {/* Arm raised holding mirror (a vanity motif from classical art) */}
      <line x1="110" y1="70" x2="142" y2="58" />
      {/* The mirror */}
      <circle cx="148" cy="54" r="6" />
      {/* Other arm resting on throne */}
      <line x1="90" y1="70" x2="62" y2="86" />
      {/* The throne — vertical back rails + cross piece */}
      <line x1="54" y1="50" x2="54" y2="170" />
      <line x1="146" y1="50" x2="146" y2="170" />
      <line x1="54" y1="50" x2="146" y2="50" />
      <line x1="54" y1="170" x2="146" y2="170" />
      {/* Legs */}
      <line x1="86" y1="130" x2="82" y2="158" />
      <line x1="114" y1="130" x2="118" y2="158" />
      {/* Throne base */}
      <line x1="80" y1="158" x2="118" y2="158" />
    </svg>
  )
}

/* ---------- Registry ---------- */

type FigureEntry = {
  /** Render the SVG figure. */
  render: () => ReactNode
  /**
   * How much to scale the figure (in scene units) when overlayed. The
   * scene-graph multiplies this against drei <Html> distanceFactor — the
   * larger the number, the bigger the figure reads against the stars.
   * Picked per-constellation so each figure roughly spans its asterism.
   */
  sizeFactor: number
  /** Decorative — fade-in opacity target when active. */
  opacityTarget: number
}

export const CONSTELLATION_FIGURES: Partial<Record<ConstellationId, FigureEntry>> = {
  orion:      { render: () => <OrionFigure />,      sizeFactor: 95, opacityTarget: 0.55 },
  leo:        { render: () => <LeoFigure />,        sizeFactor: 90, opacityTarget: 0.55 },
  cygnus:     { render: () => <CygnusFigure />,     sizeFactor: 80, opacityTarget: 0.55 },
  lyra:       { render: () => <LyraFigure />,       sizeFactor: 55, opacityTarget: 0.6  },
  cassiopeia: { render: () => <CassiopeiaFigure />, sizeFactor: 70, opacityTarget: 0.55 },
  // ursa-major, polaris — left intentionally without a figure.
  // The Big Dipper IS the iconic figure (a pan/ladle), so the asterism alone
  // already does the job. Polaris is a single star with no asterism to
  // overlay a figure on.
}
