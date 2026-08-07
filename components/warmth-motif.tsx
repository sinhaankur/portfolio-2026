/**
 * A quiet SVG motif for Anita Sinha's memorial page — soft rising motes of
 * warmth, like light or embers drifting upward. Amber, low opacity, tender.
 * Server-safe (pure markup); the parallax comes from ParallaxBackdrop.
 */
export function WarmthMotif() {
  const motes = [
    { cx: 60, cy: 200, r: 2.5, o: 0.35 },
    { cx: 130, cy: 380, r: 1.6, o: 0.25 },
    { cx: 300, cy: 260, r: 3, o: 0.3 },
    { cx: 350, cy: 520, r: 1.8, o: 0.22 },
    { cx: 90, cy: 620, r: 2.2, o: 0.28 },
    { cx: 220, cy: 700, r: 1.4, o: 0.2 },
    { cx: 310, cy: 860, r: 2.6, o: 0.26 },
    { cx: 150, cy: 960, r: 1.6, o: 0.22 },
    { cx: 40, cy: 1040, r: 2, o: 0.24 },
    { cx: 270, cy: 1120, r: 1.5, o: 0.18 },
    { cx: 190, cy: 140, r: 1.4, o: 0.24 },
    { cx: 360, cy: 1000, r: 2.2, o: 0.2 },
  ]
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 400 1200"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
    >
      <defs>
        <radialGradient id="mote" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {motes.map((m, i) => (
        <circle key={i} cx={m.cx} cy={m.cy} r={m.r * 3} fill="url(#mote)" opacity={m.o} />
      ))}
    </svg>
  )
}
