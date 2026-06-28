import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/universe-engine/math"),
  title: "The Math Behind the Universe Engine",
  description:
    "The exact equations that drive the Universe Engine — Kepler's equation, J2000 mean-anomaly propagation, RA/Dec → Cartesian, Schwarzschild & Kerr horizons, and the scene-scale transforms — shown beside the real TypeScript that runs them.",
}

/**
 * Every entry's `code` is copied VERBATIM from
 * components/universe-engine/astronomy.ts so the page is provably the math the
 * engine actually runs — not a decorative approximation. If the engine math
 * changes, update it here too.
 */
type Eq = {
  id: string
  title: string
  formula: string        // plain-text math notation (rendered in a styled block)
  what: string           // plain-English: what it does + why it matters
  code: string           // the real TypeScript from the engine
}

const SECTIONS: { heading: string; blurb: string; eqs: Eq[] }[] = [
  {
    heading: "Time → position",
    blurb:
      "Every body's location is a pure function of the simulation date. Scrub the timeline to any instant and the whole solar system lands where it genuinely was — because position is computed, not animated.",
    eqs: [
      {
        id: "days-since-j2000",
        title: "Days since the J2000 epoch",
        formula: "d(t) = (t − t_J2000) / 86 400 000",
        what:
          "The clock everything hangs on. t is the simulation instant in Unix milliseconds; J2000 (2000 Jan 1, 12:00 UTC) is the reference epoch all the orbital elements are anchored to. Dividing by the milliseconds-per-day gives elapsed days.",
        code: `export function daysSinceJ2000(simMs: number): number {
  return (simMs - J2000_MS) / 86_400_000
}`,
      },
      {
        id: "mean-anomaly",
        title: "Mean anomaly at a given date",
        formula: "M(t) = M₀ + 2π · ( d(t) / P )   (wrapped to [0, 2π))",
        what:
          "How far a body has swept around its orbit since J2000, in radians. M₀ is the body's mean anomaly at J2000 (a real catalog value per planet); P is the orbital period in days. This is the foundation of the scrubbable timeline — pure function of the date.",
        code: `export function meanAnomalyAt(m0Rad: number, periodDays: number, simMs: number): number {
  const M = m0Rad + (2 * Math.PI * daysSinceJ2000(simMs)) / periodDays
  const twoPi = 2 * Math.PI
  return ((M % twoPi) + twoPi) % twoPi
}`,
      },
    ],
  },
  {
    heading: "Kepler's orbit",
    blurb:
      "Real orbits are ellipses, and bodies sweep them unevenly — fast at perihelion, slow at aphelion (Kepler's 2nd law). Turning the smooth mean anomaly into the real angular position takes a transcendental solve.",
    eqs: [
      {
        id: "kepler",
        title: "Kepler's equation (Newton–Raphson)",
        formula: "M = E − e · sin E      →  solve for E",
        what:
          "There's no closed form for the eccentric anomaly E given the mean anomaly M, so we iterate Newton–Raphson: Eₙ₊₁ = Eₙ − f/f′ with f = E − e·sinE − M and f′ = 1 − e·cosE. It converges in ~4–6 steps. e is the orbit's eccentricity (0 = circle).",
        code: `export function solveKepler(meanAnomaly: number, e: number): number {
  if (e >= 1) return meanAnomaly
  let E = meanAnomaly + e * Math.sin(meanAnomaly)
  for (let i = 0; i < 8; i++) {
    const f  = E - e * Math.sin(E) - meanAnomaly
    const fp = 1 - e * Math.cos(E)
    const dE = f / fp
    E -= dE
    if (Math.abs(dE) < 1e-8) break
  }
  return E
}`,
      },
      {
        id: "true-anomaly",
        title: "Eccentric anomaly → true anomaly",
        formula: "ν = 2 · atan2( √(1+e) · sin(E/2),  √(1−e) · cos(E/2) )",
        what:
          "E is an abstract construction angle; ν (the true anomaly) is the body's actual angular position as seen from the Sun at one focus. This conversion is what makes a planet visibly linger at aphelion and race through perihelion.",
        code: `export function eccentricToTrue(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )
}`,
      },
      {
        id: "radius",
        title: "Orbital radius from the true anomaly",
        formula: "r(ν) = a · (1 − e²) / (1 + e · cos ν)",
        what:
          "The polar form of the ellipse with the Sun at one focus. Combined with ν above, this places the body at its real distance from the Sun for the date — so eccentric orbits (Pluto, comets) trace their true shape, not a circle.",
        code: `// in the per-frame placement (scene.tsx):
const E        = solveKepler(M, eccentricity)
const trueAnom = eccentricToTrue(E, eccentricity)
const r = (baseR * (1 - eccentricity * eccentricity)) /
          (1 + eccentricity * Math.cos(trueAnom))`,
      },
    ],
  },
  {
    heading: "Sky → scene",
    blurb:
      "Stars, galaxies, and constellations are catalogued in equatorial coordinates (right ascension + declination). Placing them in the 3D scene is a spherical-to-Cartesian transform onto the sky shell.",
    eqs: [
      {
        id: "radec",
        title: "RA / Dec → Cartesian",
        formula:
          "x = D·cosδ·cosα   y = D·sinδ   z = D·cosδ·sinα   (α = RA, δ = Dec, D = distance)",
        what:
          "Right ascension α (converted from hours to radians) and declination δ define a direction on the celestial sphere; D is the shell radius (or, for the nearby-stars layer, the real distance in light-years). The result is the star's true position, offset to the Sun's location in the scene.",
        code: `export function raDecToScenePos(
  raHours: number, decDeg: number, distance: number,
): [number, number, number] {
  const raRad  = (raHours / 24) * 2 * Math.PI
  const decRad = decDeg * (Math.PI / 180)
  const x = distance * Math.cos(decRad) * Math.cos(raRad)
  const y = distance * Math.sin(decRad)
  const z = distance * Math.cos(decRad) * Math.sin(raRad)
  return [SUN_OFFSET_SCENE + x, y, z]
}`,
      },
    ],
  },
  {
    heading: "Black holes",
    blurb:
      "Sagittarius A* and stellar-mass black holes are drawn from general relativity — the event-horizon radius is a direct function of mass (and spin), so the horizon you see is the real size for the stated mass.",
    eqs: [
      {
        id: "schwarzschild",
        title: "Schwarzschild radius",
        formula: "r_s = 2GM / c²",
        what:
          "The event-horizon radius of a non-rotating black hole. G is Newton's constant, c the speed of light, M the mass (here converted from solar masses to kilograms). For the Sun, r_s ≈ 3 km; for Sgr A* (4.15M M☉), ~12 million km.",
        code: `export function schwarzschildRadiusMeters(massSolar: number): number {
  const massKg = massSolar * SOLAR_MASS_KG
  return (2 * G_NEWTON * massKg) / (C_LIGHT * C_LIGHT)
}`,
      },
      {
        id: "kerr",
        title: "Kerr horizon (rotating black hole)",
        formula: "r₊ = (r_s / 2) · ( 1 + √(1 − a²) )",
        what:
          "Real black holes spin. The Kerr horizon shrinks with spin a (0 = static, 1 = maximal): it reduces to r_s at a=0 and to half that at a=1. The engine clamps a to 0.9999 to stay numerically safe.",
        code: `export function kerrHorizonRadiusMeters(massSolar: number, spin: number): number {
  const rs = schwarzschildRadiusMeters(massSolar)
  const a = Math.min(Math.max(spin, 0), 0.9999)
  return (rs / 2) * (1 + Math.sqrt(1 - a * a))
}`,
      },
    ],
  },
  {
    heading: "Scene scale",
    blurb:
      "The real solar system is mostly void — Neptune is 30× farther than Earth. To keep it legible the engine compresses distance, with a toggle back to true linear ratios. Scale is a mode, not a constant.",
    eqs: [
      {
        id: "compress",
        title: "Distance compression (Explore vs True)",
        formula:
          "Explore:  r_scene = √(r_AU) · S      True:  r_scene = r_AU · K",
        what:
          "In Explore mode distances are square-root compressed (S = 3) so the inner and outer planets share one legible frame. Flip to True scale and it's linear in AU (K = 3) — Neptune springs out to 30× Earth's distance, and you feel the real emptiness.",
        code: `export function compressRadius(rAU: number): number {
  const r = Math.max(rAU, 0)
  if (scaleModeRef.current === "true") return r * TRUE_SCALE_AU
  return Math.sqrt(r) * SCENE_SCALE
}`,
      },
    ],
  },
]

export default function UniverseMathPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Universe Engine · The Math
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            The equations behind the sky.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            The Universe Engine computes real positions, not animations. Below is
            the exact maths it runs — Kepler's equation, J2000 propagation, the
            sky transform, relativistic horizons, the scene-scale modes — each
            equation shown beside the real TypeScript that executes it. Copied
            verbatim from the engine source; this is what's actually running.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-14 md:mt-20 space-y-16 md:space-y-24 pb-24">
          {SECTIONS.map((section) => (
            <section key={section.heading} className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10">
              <div className="md:w-56 md:sticky md:top-28 md:self-start">
                <h2 className="font-serif text-2xl text-foreground mb-2">{section.heading}</h2>
                <p className="text-sm text-foreground/60 leading-relaxed">{section.blurb}</p>
              </div>

              <div className="space-y-8">
                {section.eqs.map((eq) => (
                  <article
                    key={eq.id}
                    className="rounded-xl border border-border bg-white/[0.02] p-5 md:p-6"
                  >
                    <h3 className="font-medium text-foreground mb-3">{eq.title}</h3>

                    {/* the formula — styled math block, no external dep */}
                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 px-4 py-3 mb-4">
                      <p className="font-serif text-base md:text-lg italic text-accent whitespace-nowrap">
                        {eq.formula}
                      </p>
                    </div>

                    <p className="text-sm text-foreground/70 leading-relaxed mb-4">{eq.what}</p>

                    {/* the real code */}
                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-4 text-[12px] leading-relaxed">
                      <code className="font-mono text-foreground/85">{eq.code}</code>
                    </pre>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8">
            Data sources for every body, star, and texture are listed on the{" "}
            <a href="/references" data-cursor-hover className="text-accent hover:underline">
              references page
            </a>
            . The engine source lives in{" "}
            <code className="font-mono text-foreground/70">components/universe-engine/astronomy.ts</code>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
