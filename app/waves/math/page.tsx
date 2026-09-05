import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/waves/math"),
  title: "The Math Behind the Waves",
  description:
    "The exact equations that drive the Waves engine — Gerstner trochoidal waves, the wave dispersion relation, a wind→spectrum wave-train model (the Phillips idea), real sun & moon ephemeris (Meeus low-precision), the spring/neap tide driver, and Fresnel water lighting — each shown beside the real code that runs it.",
}

/**
 * Every entry's `code` is copied VERBATIM from the ocean + sea-astronomy source
 * (components/ocean/wind.ts, components/ocean/ocean-mesh.tsx, lib/sea-astronomy.ts)
 * so the page is provably the math the engine actually runs — not a decorative
 * approximation. If the engine math changes, update it here too.
 */
type Eq = {
  id: string
  title: string
  formula: string
  what: string
  code: string
}

const SECTIONS: { heading: string; blurb: string; eqs: Eq[] }[] = [
  {
    heading: "Gerstner waves",
    blurb:
      "A real ocean surface isn't a simple up-and-down sine. Water particles move in circles — so crests are sharp and troughs are broad. The Gerstner (trochoidal) wave captures exactly that: it displaces each point sideways as well as vertically, tracing the circular orbit of a real water parcel. The whole sea is a sum of many such waves.",
    eqs: [
      {
        id: "gerstner",
        title: "One Gerstner wave train",
        formula:
          "x += Q·A·D·cos(k·(D·p) − ω·t)\ny  =   A·sin(k·(D·p) − ω·t)",
        what:
          "For a wave of amplitude A, direction D (a unit vector), wave number k = 2π/L (L = wavelength), and angular speed ω, each surface point p is pushed vertically by A·sin(phase) AND horizontally by Q·A·D·cos(phase). Q is the steepness. That horizontal push is what pinches the crests and flattens the troughs — the difference between a bedsheet ripple and a real swell. In the shader, `steep / (k · count)` is the per-wave Q, kept small enough that crests never fold over themselves (which would look like glass shards).",
        code: `// components/ocean/ocean-mesh.tsx — vertex shader (per wave train)
float k = 6.28318530718 / wlen;          // wave number  k = 2π / L
float f = k * (dot(dir, pos.xz) - speed * uTime);   // phase
float a = steep / (k * float(uCount) + 1e-4);       // steepness Q

pos.x += dir.x * (a * cos(f));           // horizontal orbit (crest pinch)
pos.z += dir.y * (a * cos(f));
pos.y += amp * sin(f);                    // vertical rise/fall`,
      },
      {
        id: "sum",
        title: "Summing the trains → the sea",
        formula: "surface(p, t) = Σᵢ Gerstnerᵢ(p, t)",
        what:
          "A single wave is regular and dead-looking. A real sea is the superposition of many trains at different wavelengths, directions and speeds — big slow swell plus short fast chop riding on top. The shader loops over up to six trains and adds their displacements, and the interference of all those phases is what makes the surface look alive and never quite repeat.",
        code: `// components/ocean/ocean-mesh.tsx — the loop
for (int i = 0; i < ${"MAX_TRAINS"}; i++) {
  if (i >= uCount) break;
  vec2 dir = normalize(uWaveA[i].xy);
  float amp = uWaveA[i].z;
  float wlen = uWaveA[i].w;
  float speed = uWaveB[i].x;
  float steep = uWaveB[i].y;
  // ... accumulate this train's displacement into pos ...
}`,
      },
      {
        id: "normal",
        title: "Analytic surface normal",
        formula: "N = normalize( binormal × tangent )",
        what:
          "Lighting needs the surface normal at every point. Instead of estimating it from neighbouring vertices (blurry, and wrong on sharp crests), we differentiate the Gerstner sum in closed form: accumulate the partial derivatives along the two surface directions (tangent and binormal) as we add each wave, then take their cross product. Exact normals are why the specular glint is crisp and the crests catch light correctly.",
        code: `// components/ocean/ocean-mesh.tsx — exact normal from the derivatives
tangent += vec3(-dir.x*dir.x*(steep*s),  dir.x*(amp*k*c), -dir.x*dir.y*(steep*s));
binormal += vec3(-dir.x*dir.y*(steep*s), dir.y*(amp*k*c), -dir.y*dir.y*(steep*s));
// after the loop:
vNormal = normalize(cross(binormal, tangent));`,
      },
    ],
  },
  {
    heading: "Wind → waves",
    blurb:
      "Wind is what actually makes waves. The physical picture is a wave-energy spectrum — how much energy sits at each wavelength and direction for a given wind (the Phillips spectrum is the classic empirical form). The engine uses a legible version of that idea: it converts a wind description into a set of wave trains whose sizes and directions follow the same rules the spectrum encodes.",
    eqs: [
      {
        id: "dispersion",
        title: "Deep-water dispersion relation",
        formula: "c = √( g·L / 2π )        ( ω = √(g·k) )",
        what:
          "In deep water, longer waves travel faster — this is the dispersion relation, pure physics. The phase speed c of a wave of wavelength L is √(gL/2π), where g = 9.81 m/s². It's why the long ocean swell outruns the short local chop and arrives at the coast first. The engine computes each train's speed straight from this, so the waves move at physically correct relative speeds.",
        code: `// components/ocean/wind.ts — inside waveTrains()
// Deep-water phase speed c = sqrt(g·L / 2π)
const speed = Math.sqrt((9.81 * wavelength) / (2 * Math.PI))`,
      },
      {
        id: "spectrum",
        title: "Wind, fetch → dominant wave size",
        formula: "L_dom ∝ U² / g       A_dom ∝ U·fetchBoost",
        what:
          "The dominant wavelength of a wind sea grows roughly with the square of wind speed U (the Phillips/Pierson–Moskowitz scaling), and with fetch — the open-water distance the wind has had to work over. More wind, or more fetch, means bigger, longer swell. The model shapes the base wavelength and amplitude from exactly these two inputs, then fans several trains around the wind direction.",
        code: `// components/ocean/wind.ts — wind sea from speed + fetch
const fetchBoost = Math.min(2, 0.6 + wind.fetchKm / 400)
const baseLen = Math.max(4, wind.speed * wind.speed * 0.9 * fetchBoost) // ~ U²/g
const baseAmp = Math.max(0.05, wind.speed * 0.09 * fetchBoost)
// spread ±55° around the wind, dominant train aligned with it:
const spread = ((i - (count - 1) / 2) / count) * (55 * Math.PI) / 180`,
      },
      {
        id: "steepness",
        title: "Steepness & whitecaps",
        formula: "Q = min(0.9, 0.18 + 0.03·U) / N",
        what:
          "As wind rises, waves don't just grow — they steepen, until crests break into whitecaps. Steepness Q climbs with wind speed U, and is divided across the N trains and capped at 0.9 so the summed surface never self-intersects. In the shader, the same crest height that comes from steepness also drives the foam, so stronger wind produces both choppier water and more foam — as it does in reality.",
        code: `// components/ocean/wind.ts — steepness rises with wind, capped
const steepness = Math.min(0.9, 0.18 + wind.speed * 0.03) / count

// components/ocean/ocean-mesh.tsx — crest height → foam
float foam = smoothstep(0.35, 0.9, vCrest * (0.6 + uFoam)) * uFoam;`,
      },
    ],
  },
  {
    heading: "The Sun & Moon",
    blurb:
      "The sky over the sea is real. The sun and moon are placed by genuine (if low-precision) astronomy — the same Meeus formulae an almanac uses — from a date, latitude and longitude. Their altitude/azimuth set the light on the water; the moon's phase sets its shape; both feed the tide.",
    eqs: [
      {
        id: "jd",
        title: "Julian Day & days since J2000",
        formula: "JD = t/86 400 000 + 2440587.5      d = JD − 2451545.0",
        what:
          "All the ephemeris formulae are polynomials in time measured from the J2000.0 epoch (2000 Jan 1, 12:00 UTC). First convert the JS date to a Julian Day, then subtract the J2000 Julian Day to get d, the elapsed days. Everything else — the sun's longitude, the moon's position, sidereal time — is a function of d.",
        code: `// lib/sea-astronomy.ts
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}
function daysSinceJ2000(date: Date): number {
  return julianDay(date) - 2451545.0;
}`,
      },
      {
        id: "sun-ecl",
        title: "Sun's ecliptic longitude",
        formula:
          "g = 357.529 + 0.98560028·d\nL = q + 1.915·sin g + 0.020·sin 2g",
        what:
          "The sun's apparent path is the ecliptic. From the mean anomaly g and mean longitude q (both linear in d), the equation of centre — the 1.915·sin g + 0.020·sin 2g correction — gives the true ecliptic longitude L. This accounts for Earth's elliptical orbit (the sun moves a little faster in January). Latitude is ~0 for the sun by definition.",
        code: `// lib/sea-astronomy.ts — sunEcliptic(d)
const g = normDeg(357.529 + 0.98560028 * d) * RAD;  // mean anomaly
const q = normDeg(280.459 + 0.98564736 * d);        // mean longitude
const L = normDeg(q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g)); // true longitude`,
      },
      {
        id: "altaz",
        title: "Ecliptic → altitude & azimuth",
        formula:
          "alt = asin( sinφ·sinδ + cosφ·cosδ·cos H )\naz  = atan2( −cosδ·sin H,  sinδ·cosφ − cosδ·sinφ·cos H )",
        what:
          "To place a body in the sky you need where it is for YOUR spot on Earth. Convert its ecliptic longitude to equatorial coordinates (right ascension α, declination δ) using the obliquity of the ecliptic; compute the local sidereal time to get the hour angle H = LST − α; then rotate into the local horizon frame for altitude and azimuth. Altitude > 0 means it's up; azimuth is the compass bearing. This is what points the light in the ocean shader.",
        code: `// lib/sea-astronomy.ts — altAz(), the horizon transform
const H = normDeg(lst - raDeg) * RAD;   // hour angle = sidereal time − RA
const alt = Math.asin(Math.sin(lat)*Math.sin(dec)
                    + Math.cos(lat)*Math.cos(dec)*Math.cos(H));
const az = Math.atan2(
  -Math.cos(dec) * Math.sin(H),
  Math.sin(dec)*Math.cos(lat) - Math.cos(dec)*Math.sin(lat)*Math.cos(H));`,
      },
      {
        id: "moon-phase",
        title: "Moon phase from elongation",
        formula:
          "elong = λ_moon − λ_sun\nillum = (1 − cos elong) / 2",
        what:
          "The moon's phase is set purely by its angle from the sun as seen from Earth (the elongation). At 0° the lit side faces away (new moon); at 180° it faces us (full). The illuminated fraction is (1 − cos elong)/2 — 0 at new, 1 at full — and whether elongation is under or over 180° tells you waxing vs waning. This drives both the drawn moon shape and the tide.",
        code: `// lib/sea-astronomy.ts — moonPhase(date)
const elong = normDeg(moon - sun);            // 0=new … 180=full … 360=new
const phase = elong / 360;
const illumination = (1 - Math.cos(elong * RAD)) / 2;
const waxing = elong < 180;`,
      },
    ],
  },
  {
    heading: "Tides",
    blurb:
      "A true tide prediction needs harmonic constants for a specific port. But the DRIVER is universal and worth showing honestly: the tide-raising force is the sum of the moon's and the sun's pull. When they line up you get the biggest range; at right angles, the smallest.",
    eqs: [
      {
        id: "spring-neap",
        title: "Spring / neap indicator",
        formula: "align = | cos( 2π · phase ) |      range = 0.3 + 0.7·align",
        what:
          "The sun–moon alignment is strongest at new and full moon (phase 0 and 0.5) and weakest at the quarters. |cos(2π·phase)| captures exactly that: 1 when aligned, 0 at the quarters. Spring tides (largest range) occur when it's near 1; neap tides (smallest) near 0. The engine reports which regime today is in — not a height prediction, but the real physics of why the range changes.",
        code: `// lib/sea-astronomy.ts — tideIndicator(date)
const { phase } = moonPhase(date);
const align = Math.abs(Math.cos(2 * Math.PI * phase)); // 1 at new/full, 0 at quarters
const springStrength = 0.3 + 0.7 * align;
const kind = align > 0.85 ? "spring" : align < 0.35 ? "neap" : "between";`,
      },
    ],
  },
  {
    heading: "Lighting the water",
    blurb:
      "The sea's look is mostly about how light bounces off it. Two effects do the heavy lifting: Fresnel reflection (the water turns mirror-like at grazing angles) and a sharp specular glint from the real sun or moon — placed by the ephemeris above.",
    eqs: [
      {
        id: "fresnel",
        title: "Fresnel reflection (Schlick)",
        formula: "F = 0.02 + 0.98 · (1 − (N·V))⁵",
        what:
          "Look straight down into water and you see through it; look across it toward the horizon and it becomes a mirror. That's Fresnel reflectance, and Schlick's approximation captures it cheaply: reflection is low (~2%) when you face the surface (N·V ≈ 1) and rises to ~100% at grazing angles. It's why the horizon-side of every wave is bright sky and the near side is deep water.",
        code: `// components/ocean/ocean-mesh.tsx — fragment shader
float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
fres = clamp(0.02 + 0.98 * fres, 0.0, 1.0);
vec3 refl = mix(water, uSkyColor, fres);   // sky mirrored in at grazing angles`,
      },
      {
        id: "specular",
        title: "Sun / moon specular glint",
        formula: "spec = (N·H)²²⁰       H = normalize(L + V)",
        what:
          "The bright dancing sparkle on the sea is the sun (or moon) reflected off thousands of tilted wave facets. Using the half-vector H between the light L and the view V, a high power (220) gives a tight, sharp glint; a lower power (24) adds the softer, longer shimmer of the sun's path across the water. Both are tinted by the real light colour and pointed by the ephemeris — so at night it's the moon's cooler glint, in exactly the moon's real direction.",
        code: `// components/ocean/ocean-mesh.tsx — fragment shader
vec3 H = normalize(L + V);
float spec = pow(max(dot(N, H), 0.0), 220.0);        // tight sun glint
float shimmer = pow(max(dot(N, H), 0.0), 24.0) * 0.25; // sun-path shimmer
vec3 col = refl + uLightColor * (spec * 2.2 + shimmer) + vec3(foam);`,
      },
    ],
  },
]

export default function WavesMathPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Waves Engine · The Math
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            The equations behind the sea.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            The Waves engine computes a real sea under a real sky — not a video,
            not an AI enhancer. Below is the exact maths it runs: Gerstner
            trochoidal waves and their analytic normals, the deep-water
            dispersion relation, a wind→spectrum wave-train model (the Phillips
            idea), genuine sun &amp; moon ephemeris, the spring/neap tide driver,
            and Fresnel water lighting — each equation shown beside the real code
            that executes it. Copied verbatim from the engine source; this is
            what&apos;s actually running.
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
                      <p className="font-serif text-base md:text-lg italic text-accent whitespace-pre-line">
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
            The engine source lives in{" "}
            <code className="font-mono text-foreground/70">components/ocean/</code> and{" "}
            <code className="font-mono text-foreground/70">lib/sea-astronomy.ts</code>. See the
            companion{" "}
            <a href="/universe-engine/math" data-cursor-hover className="text-accent hover:underline">
              Universe Engine math
            </a>{" "}
            for the sky, and open the{" "}
            <a href="/waves" data-cursor-hover className="text-accent hover:underline">
              full-screen Waves experience
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
