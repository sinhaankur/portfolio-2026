"use client"

import { useReducedMotion } from "framer-motion"

/**
 * VeraMark — the animated emblem for Vera (the Cognitive Twin).
 *
 * Deliberately NOT a Siri-style circle/orb. It's a hexagon with internal facets
 * echoing the geometric precision of Ashokan / Mauryan design (the spoked
 * discipline of the Ashoka Chakra, rendered as a faceted hex rather than a
 * wheel). A soft inner pulse + slow spoke shimmer keeps the "listening"
 * animation Ankur liked, without imitating Siri.
 *
 * Pure SVG + CSS (no per-frame JS). Respects reduced motion. `size` in px.
 */
export function VeraMark({
  size = 96,
  className = "",
  active = true,
}: {
  size?: number
  className?: string
  active?: boolean
}) {
  const reduce = useReducedMotion()
  const animate = active && !reduce

  // Flat-top hexagon points on a 100-box, centered.
  const R = 46
  const cx = 50
  const cy = 50
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6 // pointy-top
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
  })
  const hexPath = hex.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + " Z"

  // Inset hexagon (the faceted frame within the frame).
  const inner = hex.map(([x, y]) => [cx + (x - cx) * 0.52, cy + (y - cy) * 0.52])
  const innerPath = inner.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ") + " Z"

  // The Ashoka Chakra proper: 24 spokes (the Dharmachakra count on the Sarnath
  // capital + the Indian flag). Rendered inside the hexagon so it reads as
  // "chakra within a hex", the real Mauryan discipline rather than a Siri circle.
  const CHAKRA_R = 34
  const spokes24 = Array.from({ length: 24 }, (_, i) => {
    const a = (Math.PI / 12) * i
    return [cx + CHAKRA_R * Math.cos(a), cy + CHAKRA_R * Math.sin(a)]
  })
  // A beaded ring (Mauryan pillar/abacus bead detail) at the spoke tips.
  const beads = spokes24

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`vera-mark ${animate ? "vera-mark--on" : ""} ${className}`}
      role="img"
      aria-label="Vera"
      fill="none"
    >
      <defs>
        <radialGradient id="vera-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft inner glow that breathes (the "listening" pulse). */}
      <circle className="vera-core" cx={cx} cy={cy} r="30" fill="url(#vera-core)" />

      {/* Outer hexagon frame. */}
      <path d={hexPath} stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" opacity="0.9" />

      {/* Inset hexagon. */}
      <path d={innerPath} stroke="var(--accent)" strokeWidth="1" strokeLinejoin="round" opacity="0.5" />

      {/* Ashoka Chakra — 24 spokes + a rim + beaded tips, the authentic
          Dharmachakra, turning slowly (the "listening" motion). */}
      <g className="vera-spokes" opacity="0.6">
        <circle cx={cx} cy={cy} r={CHAKRA_R} stroke="var(--accent)" strokeWidth="0.8" opacity="0.6" />
        {spokes24.map(([x, y], i) => (
          <line key={i} x1={cx} y1={cy} x2={x.toFixed(2)} y2={y.toFixed(2)}
            stroke="var(--accent)" strokeWidth="0.5" opacity="0.55" />
        ))}
        {beads.map(([x, y], i) => (
          <circle key={`b${i}`} cx={x.toFixed(2)} cy={y.toFixed(2)} r="0.9" fill="var(--accent)" opacity="0.7" />
        ))}
      </g>

      {/* Center hub. */}
      <circle cx={cx} cy={cy} r="3" fill="var(--accent)" />
      <circle cx={cx} cy={cy} r="5.5" stroke="var(--accent)" strokeWidth="0.8" opacity="0.5" />

      <style>{`
        .vera-core { transform-origin: 50% 50%; }
        .vera-spokes { transform-origin: 50% 50%; }
        .vera-mark--on .vera-core {
          animation: vera-breathe 3.2s ease-in-out infinite;
        }
        .vera-mark--on .vera-spokes {
          animation: vera-turn 24s linear infinite;
        }
        @keyframes vera-breathe {
          0%, 100% { opacity: 0.55; transform: scale(0.94); }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        @keyframes vera-turn {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vera-mark--on .vera-core,
          .vera-mark--on .vera-spokes { animation: none; }
        }
      `}</style>
    </svg>
  )
}
