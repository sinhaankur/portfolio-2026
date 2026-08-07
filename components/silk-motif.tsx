/**
 * A quiet SVG motif for Dr. Randhir Kumar Sinha's page — his life's field, drawn
 * in light: flowing silk filaments spun down the page, a few cocoons, and a
 * mulberry leaf (Bombyx mori feeds only on mulberry). Rendered in the amber
 * accent at low opacity so it reads as texture, never decoration that competes
 * with the words. Server-safe (pure markup).
 */
export function SilkMotif() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 1200"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
    >
      <defs>
        {/* Silk filaments fade as they fall. */}
        <linearGradient id="silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cocoon" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
        </radialGradient>
      </defs>

      {/* Spun silk threads — long, slightly waving vertical filaments. */}
      <g stroke="url(#silk)" strokeWidth="1" fill="none">
        <path d="M40 -40 C 70 200, 10 420, 55 700 S 30 1050, 60 1240" />
        <path d="M120 -60 C 150 260, 95 500, 140 760 S 110 1080, 150 1260" />
        <path d="M210 -30 C 180 220, 245 480, 200 720 S 235 1020, 205 1250" />
        <path d="M300 -50 C 335 240, 270 520, 320 780 S 285 1090, 330 1260" />
        <path d="M370 -40 C 345 200, 395 460, 360 740 S 390 1060, 355 1240" />
      </g>

      {/* A couple of cocoons nestled along the threads. */}
      <g>
        <ellipse cx="55" cy="360" rx="13" ry="22" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.14" />
        <ellipse cx="322" cy="600" rx="12" ry="20" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.14" />
        <ellipse cx="140" cy="880" rx="12" ry="21" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.12" />
      </g>

      {/* A single mulberry leaf, low and small — the food of Bombyx mori. */}
      <g transform="translate(250 940) rotate(18)" stroke="var(--accent)" strokeOpacity="0.16" fill="none" strokeWidth="1">
        <path d="M0 0 C 18 -14, 40 -12, 46 6 C 40 26, 16 30, 0 20 C -8 12, -6 6, 0 0 Z" />
        <path d="M6 4 L 40 8" />
      </g>
    </svg>
  )
}
