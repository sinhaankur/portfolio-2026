/**
 * Section 03 — Philosophy glyphs.
 *
 * One thin-line SVG per principle. Same celestial-atlas hand the
 * Universe Engine's constellation figures use — stroke currentColor,
 * no fills, ~48px square. Each glyph encodes the *idea* of its
 * principle, not a generic icon: the seam, the dial, the reversibility
 * axis, the prototype frame.
 *
 * Sized at 48×48 viewBox; consumers control display size via className.
 */

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
}

/* ---------- 01 · The seam is the design ----------
 * Two regions meet at a horizontal seam. The seam itself is the
 * darkest, most-articulated line — that's the principle made visible. */
export function SeamGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...strokeProps}>
      {/* Upper region — short angled ticks suggesting one surface (user) */}
      <line x1="8"  y1="14" x2="14" y2="14" />
      <line x1="18" y1="14" x2="24" y2="14" />
      <line x1="28" y1="14" x2="34" y2="14" />
      <line x1="38" y1="14" x2="40" y2="14" />
      <line x1="10" y1="20" x2="16" y2="20" />
      <line x1="22" y1="20" x2="28" y2="20" />
      <line x1="32" y1="20" x2="38" y2="20" />
      {/* The seam — bold, full-width, slight wobble at the midpoint to
          read as a place where two things meet, not a clean weld */}
      <path d="M 4 25 L 22 25 Q 24 24.3 26 25 L 44 25" strokeWidth="2" />
      {/* Lower region — dashed ticks suggesting another surface (agent) */}
      <line x1="6"  y1="30" x2="12" y2="30" strokeDasharray="1.5 2" />
      <line x1="16" y1="30" x2="22" y2="30" strokeDasharray="1.5 2" />
      <line x1="26" y1="30" x2="32" y2="30" strokeDasharray="1.5 2" />
      <line x1="36" y1="30" x2="42" y2="30" strokeDasharray="1.5 2" />
      <line x1="10" y1="36" x2="16" y2="36" strokeDasharray="1.5 2" />
      <line x1="20" y1="36" x2="26" y2="36" strokeDasharray="1.5 2" />
      <line x1="30" y1="36" x2="36" y2="36" strokeDasharray="1.5 2" />
    </svg>
  )
}

/* ---------- 02 · Uncertainty must be legible ----------
 * A confidence dial. Tick marks at "Low / Likely / Confident",
 * and a needle pointing somewhere between — never to a single number. */
export function DialGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...strokeProps}>
      {/* Outer arc — half-circle from 0° to 180° (left-pointing semicircle) */}
      <path d="M 6 32 A 18 18 0 0 1 42 32" />
      {/* Tick marks along the arc — 5 ticks evenly spaced */}
      <line x1="6"  y1="32" x2="6"  y2="36" />
      <line x1="13" y1="18.5" x2="15" y2="22" />
      <line x1="24" y1="14" x2="24" y2="18" />
      <line x1="35" y1="18.5" x2="33" y2="22" />
      <line x1="42" y1="32" x2="42" y2="36" />
      {/* Pivot */}
      <circle cx="24" cy="32" r="1.5" />
      {/* Needle — pointing at "Likely" (slightly left of centre, not committing
          to the top), with a small uncertainty arc around its tip */}
      <line x1="24" y1="32" x2="18" y2="21" strokeWidth="1.8" />
      <path d="M 16 19.5 Q 18 18 20 19.5" strokeDasharray="1 1.5" />
    </svg>
  )
}

/* ---------- 03 · Reversibility is the policy axis ----------
 * A horizontal axis with action markers, an arrow that goes BOTH
 * directions (the "undo" is part of the design, not an afterthought),
 * and a small "act / undo" tick pair. */
export function ReversibleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...strokeProps}>
      {/* The axis line */}
      <line x1="6" y1="24" x2="42" y2="24" />
      {/* Right arrowhead — action */}
      <polyline points="38,20 42,24 38,28" />
      {/* Left arrowhead — undo */}
      <polyline points="10,20 6,24 10,28" />
      {/* Centre pivot — the moment of decision */}
      <circle cx="24" cy="24" r="2.5" />
      <circle cx="24" cy="24" r="0.8" />
      {/* Tick markers at + and -1 positions, like a slider scale */}
      <line x1="14" y1="22" x2="14" y2="26" />
      <line x1="19" y1="22" x2="19" y2="26" />
      <line x1="29" y1="22" x2="29" y2="26" />
      <line x1="34" y1="22" x2="34" y2="26" />
      {/* Small "cost" labels — short ticks above */}
      <line x1="14" y1="16" x2="14" y2="14" />
      <line x1="34" y1="16" x2="34" y2="14" />
    </svg>
  )
}

/* ---------- 04 · Prototypes are the argument ----------
 * A small device viewport with a few content lines + a cursor/touch
 * dot. The frame is the artifact; the dot is the user proving it works. */
export function PrototypeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...strokeProps}>
      {/* Viewport frame */}
      <rect x="9" y="8" width="30" height="32" rx="3" />
      {/* Top bar (browser/window chrome) */}
      <line x1="9" y1="14" x2="39" y2="14" />
      {/* Three "tab" dots */}
      <circle cx="13" cy="11" r="0.9" />
      <circle cx="16.5" cy="11" r="0.9" />
      <circle cx="20" cy="11" r="0.9" />
      {/* Content lines — like a list of features being demonstrated */}
      <line x1="13" y1="20" x2="35" y2="20" />
      <line x1="13" y1="24" x2="28" y2="24" />
      <line x1="13" y1="28" x2="32" y2="28" />
      {/* Pointer/click — circle indicating the proof-of-use */}
      <circle cx="30" cy="33" r="2.5" strokeWidth="1.6" />
      <circle cx="30" cy="33" r="0.9" />
    </svg>
  )
}
