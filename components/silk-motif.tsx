/**
 * A living silk field for Dr. Randhir Kumar Sinha's page — his life's work, drawn in
 * light: many flowing filaments spun down the page, cocoons nestled along them, a
 * mulberry leaf (Bombyx mori feeds only on mulberry). The threads drift gently and
 * shimmer, so the whole page sits on a quiet, breathing silk backdrop rather than
 * blank space — texture, never decoration that competes with the words.
 *
 * Server-safe: pure SVG + CSS keyframes (no JS). Honors prefers-reduced-motion.
 */
export function SilkMotif() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 1200"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
          <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="silk2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fa8d8" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#7fa8d8" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#7fa8d8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cocoon" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
        </radialGradient>
        {/* a soft warm bloom near the top, so the field feels lit from the hero */}
        <radialGradient id="bloom" cx="50%" cy="0%" r="70%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.07" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="400" height="1200" fill="url(#bloom)" />

      {/* the drifting group — a slow lateral sway, seamless */}
      <g className="silk-drift">
        {/* warm silk filaments */}
        <g stroke="url(#silk)" strokeWidth="1" fill="none">
          <path d="M40 -40 C 70 200, 10 420, 55 700 S 30 1050, 60 1240" />
          <path d="M120 -60 C 150 260, 95 500, 140 760 S 110 1080, 150 1260" />
          <path d="M210 -30 C 180 220, 245 480, 200 720 S 235 1020, 205 1250" />
          <path d="M300 -50 C 335 240, 270 520, 320 780 S 285 1090, 330 1260" />
          <path d="M370 -40 C 345 200, 395 460, 360 740 S 390 1060, 355 1240" />
        </g>
        {/* a few cooler blue filaments woven between (like the hero) */}
        <g stroke="url(#silk2)" strokeWidth="0.8" fill="none">
          <path d="M80 -50 C 110 240, 55 520, 100 800 S 70 1100, 110 1260" />
          <path d="M255 -40 C 225 220, 285 500, 245 780 S 280 1080, 250 1250" />
          <path d="M340 -60 C 310 260, 365 520, 330 800 S 360 1090, 335 1260" />
        </g>
      </g>

      {/* cocoons nestled along the threads */}
      <g>
        <ellipse cx="55" cy="360" rx="13" ry="22" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.16" />
        <ellipse cx="322" cy="600" rx="12" ry="20" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.16" />
        <ellipse cx="140" cy="880" rx="12" ry="21" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.14" />
        <ellipse cx="300" cy="1050" rx="11" ry="19" fill="url(#cocoon)" stroke="var(--accent)" strokeOpacity="0.13" />
      </g>

      {/* mulberry leaves, low and small — the food of Bombyx mori */}
      <g transform="translate(250 940) rotate(18)" stroke="var(--accent)" strokeOpacity="0.18" fill="none" strokeWidth="1">
        <path d="M0 0 C 18 -14, 40 -12, 46 6 C 40 26, 16 30, 0 20 C -8 12, -6 6, 0 0 Z" />
        <path d="M6 4 L 40 8" />
      </g>
      <g transform="translate(70 1080) rotate(-12)" stroke="var(--accent)" strokeOpacity="0.14" fill="none" strokeWidth="1">
        <path d="M0 0 C 14 -11, 32 -10, 37 5 C 32 21, 13 24, 0 16 C -6 10, -5 5, 0 0 Z" />
        <path d="M5 3 L 32 6" />
      </g>

      <style>{`
        .silk-drift { animation: silkDrift 26s ease-in-out infinite; transform-origin: 50% 0; }
        @keyframes silkDrift {
          0%,100% { transform: translateX(0) skewX(0deg); }
          50%     { transform: translateX(10px) skewX(0.6deg); }
        }
        @media (prefers-reduced-motion: reduce) { .silk-drift { animation: none; } }
      `}</style>
    </svg>
  )
}
