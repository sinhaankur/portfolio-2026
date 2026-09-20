// The "equations, visible" series — one source of truth for both the top-level
// hub (/math) and the Lab-scoped index (/lab/math), and anything else that lists
// the set. Each entry is a live, original interactive visualization of real math.

export type MathPiece = { href: string; title: string; line: string; tag: string }

export const MATH_SERIES: MathPiece[] = [
  {
    href: "/lab/pi",
    title: "π — why it never ends",
    line: "A two-arm curve whose irrational ratio never closes — the visceral reason π has no exact value. Plus three ways to compute it, live.",
    tag: "Irrationality",
  },
  {
    href: "/lab/euler",
    title: "Euler's identity — e^(iπ) + 1 = 0",
    line: "The 'most beautiful equation' is just a point taking half a turn around a circle. Sweep the angle and watch it land on −1.",
    tag: "Complex plane",
  },
  {
    href: "/lab/fourier",
    title: "Fourier — any wave is spinning circles",
    line: "A square wave built from pure sines, drawn as stacked epicycles. The idea behind MP3, JPEG, radio and MRI, made visible.",
    tag: "Signals",
  },
  {
    href: "/lab/golden-ratio",
    title: "The golden ratio — φ, and sunflowers",
    line: "Fibonacci homes in on 1.618…, the 'most irrational' number — which is exactly why seeds at the golden angle pack perfectly.",
    tag: "Nature",
  },
  {
    href: "/lab/pythagoras",
    title: "Pythagoras — a² + b² = c², by area",
    line: "No algebra — four triangles, two arrangements of one square, and the theorem proves itself. A finite proof you hold in one picture.",
    tag: "Geometry",
  },
  {
    href: "/lab/bell-curve",
    title: "The bell curve — order from randomness",
    line: "Balls bounce through pegs on coin-flips and pile into the same bell every time. The Central Limit Theorem, made visible.",
    tag: "Probability",
  },
  {
    href: "/lab/logarithms",
    title: "Logarithms — adding becomes multiplying",
    line: "On a log scale, distance is the logarithm — so laying two lengths end to end multiplies the numbers. The slide rule, and why log books ran the world.",
    tag: "The slide rule",
  },
  {
    href: "/waves/math",
    title: "Waves — the ocean's real math",
    line: "Gerstner trochoidal waves: watch water particles circle to make sharp crests, then sum trains into a living sea.",
    tag: "Physics",
  },
  {
    href: "/universe-engine/math",
    title: "The Universe Engine — orbital math",
    line: "The real equations that place the planets and satellites: Kepler, SGP4, J2000 — shown beside the code that runs them.",
    tag: "Astronomy",
  },
]
