/**
 * Section 07 — Stack glyphs.
 *
 * One thin-line SVG per category. Same celestial-atlas hand as the
 * principle glyphs in section 03 — stroke currentColor, no fills, ~36px
 * square. Each glyph encodes the category's *job* (markup, device shell,
 * code tokens, agent graph, design surface), not a brand.
 *
 * Kept small + muted so they read as a quiet visual rhythm down the
 * left edge of the stack inventory, not as decorative stamps.
 */

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
}

/* ---------- Frontend — angle brackets ---------- */
export function FrontendGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} {...strokeProps}>
      {/* Left chevron */}
      <polyline points="14,10 6,18 14,26" />
      {/* Right chevron */}
      <polyline points="22,10 30,18 22,26" />
      {/* Slash between — JSX feel */}
      <line x1="20" y1="11" x2="16" y2="25" />
    </svg>
  )
}

/* ---------- Native — small device frame ---------- */
export function NativeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} {...strokeProps}>
      {/* Device outline — slightly tall (mobile portrait) */}
      <rect x="11" y="6" width="14" height="24" rx="2.5" />
      {/* Speaker slot */}
      <line x1="15" y1="9.5" x2="21" y2="9.5" />
      {/* Home indicator */}
      <line x1="15" y1="27" x2="21" y2="27" />
      {/* Content lines */}
      <line x1="14" y1="15" x2="22" y2="15" />
      <line x1="14" y1="19" x2="20" y2="19" />
    </svg>
  )
}

/* ---------- Languages — curly braces with a midline ---------- */
export function LanguagesGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} {...strokeProps}>
      {/* Left brace */}
      <path d="M 12 8 Q 8 8 8 12 L 8 16 Q 8 18 6 18 Q 8 18 8 20 L 8 24 Q 8 28 12 28" />
      {/* Right brace */}
      <path d="M 24 8 Q 28 8 28 12 L 28 16 Q 28 18 30 18 Q 28 18 28 20 L 28 24 Q 28 28 24 28" />
      {/* Inner cursor — "the thing you write between the braces" */}
      <line x1="16" y1="18" x2="20" y2="18" />
    </svg>
  )
}

/* ---------- AI & runtime — small node graph ---------- */
export function AIGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} {...strokeProps}>
      {/* Central node */}
      <circle cx="18" cy="18" r="2.5" />
      {/* Three outer nodes — like an agent's surface points */}
      <circle cx="8"  cy="10" r="1.8" />
      <circle cx="28" cy="10" r="1.8" />
      <circle cx="8"  cy="26" r="1.8" />
      <circle cx="28" cy="26" r="1.8" />
      {/* Edges connecting them — the "graph" between human + agent surfaces */}
      <line x1="10"  y1="11" x2="16" y2="17" />
      <line x1="26"  y1="11" x2="20" y2="17" />
      <line x1="10"  y1="25" x2="16" y2="19" />
      <line x1="26"  y1="25" x2="20" y2="19" />
    </svg>
  )
}

/* ---------- Design — pen + canvas ---------- */
export function DesignGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} {...strokeProps}>
      {/* Canvas — a square plate */}
      <rect x="6" y="14" width="18" height="14" rx="1" />
      {/* A short stroke on the canvas — the artifact */}
      <path d="M 10 22 Q 14 20 18 24" />
      {/* Pen — diagonal stylus on the upper-right */}
      <line x1="22" y1="6" x2="32" y2="16" />
      <line x1="22" y1="6" x2="20" y2="8" />
      <line x1="32" y1="16" x2="30" y2="18" />
      {/* Pen nib accent */}
      <circle cx="32.5" cy="16.5" r="0.9" />
    </svg>
  )
}
