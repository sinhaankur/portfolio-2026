import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/writing/universe-engine"),
  // The root layout's title template already appends "· Ankur Sinha", so this
  // stands alone (avoids the doubled-name "… — Ankur Sinha · Ankur Sinha").
  title: "How I built a real-data universe engine",
  description:
    "18,500 satellites on real SGP4 orbits, a true-scale solar system, Mars rover coverage, and validated Earth→Mars transfer math — in the browser, from real NASA / NORAD / NOAA data. A technical walkthrough.",
  keywords: [
    "universe engine",
    "SGP4 in the browser",
    "satellite visualization WebGL",
    "three.js satellites",
    "real-time orbit simulation",
    "react three fiber",
    "space data visualization",
  ],
}

// Universe Engine as a distinct entity — a rich-result-eligible SoftwareApplication.
// It's the site's most link-worthy asset, so giving it its own schema (rather than
// leaving it implicit under the Person) helps search engines surface it directly.
const engineSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Universe Engine",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web browser (WebGL)",
  url: "https://www.sinhaankur.com/lab/celestial/",
  author: { "@type": "Person", name: "Ankur Sinha", url: "https://www.sinhaankur.com" },
  description:
    "A real-time, real-data 3D universe in the browser: 18,500 satellites on SGP4 orbits, a true-scale solar system, Mars rover coverage, and validated Earth→Mars transfer math — built from NASA / NORAD / NOAA data.",
  featureList: [
    "18,500 satellites on real SGP4 orbits",
    "True-scale solar system with real planet positions (JPL Horizons)",
    "Mars rover traverse coverage",
    "Live space weather and aurora (NOAA SWPC)",
    "Validated Earth→Mars transfer math",
  ],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
}

// A tiny prose helper so the article reads consistently without a markdown dep.
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em] text-foreground mt-14 mb-4">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[15px] md:text-base text-foreground/80 leading-relaxed mb-5">{children}</p>
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/90">{children}</code>
}

export default function UniverseEnginePost() {
  return (
    <main className="mx-auto max-w-3xl px-6 md:px-12 py-20 md:py-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(engineSchema) }}
      />
      <Link
        href="/writing"
        className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
        Writing
      </Link>

      <article>
        <p className="font-mono text-[10px] tracking-widest uppercase text-foreground/45 mb-3">July 5, 2026</p>
        <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.02em] leading-[1.06] mb-6">
          How I built a real-data universe engine
        </h1>
        <p className="font-sans text-base md:text-lg text-foreground/70 leading-relaxed mb-4">
          There&apos;s a live solar system on{" "}
          <Link href="/lab/celestial" className="text-accent hover:underline">this site</Link>. 18,500
          satellites on real orbits, every planet at true distance, the Mars sites rovers have
          actually photographed, live space weather, and Earth→Mars transfer math you can check
          against a textbook. It runs in the browser, from real data. Here&apos;s how, and why every
          number is real.
        </p>

        <H2>The rule: real over invented</H2>
        <P>
          The whole engine follows one rule — if a body&apos;s position, size, or state isn&apos;t
          real, it doesn&apos;t ship. A star&apos;s measured temperature drives its colour. A
          satellite&apos;s two-line element set drives where it is. Where something genuinely
          isn&apos;t known, it&apos;s labelled as inference, never presented as fact. That rule is
          the hard part and the whole point: anyone can make a pretty space scene; the interesting
          constraint is making a faithful one.
        </P>

        <H2>18,500 satellites, real orbits</H2>
        <P>
          The satellite catalogue is the real CelesTrak SATCAT — {" "}
          <Code>id, name, owner, type, launch date, and the two TLE lines</Code> per object. Each is
          propagated with <Code>satellite.js</Code> (SGP4), the same orbital-mechanics model used for
          actual tracking. Positions recompute at 4&nbsp;Hz and interpolate between steps, so the
          swarm glides instead of stepping.
        </P>
        <P>
          Rendering 18,500 individual meshes would be millions of triangles — a dead browser. So the
          swarm is a single GPU points field (one draw call), and only the satellite you{" "}
          <em>select</em> gets a real 3D model. That&apos;s not a shortcut; it&apos;s the same
          architecture professional trackers use. Colour is by object type — payload, rocket body,
          debris — and every dot is launch-gated: scrub the timeline to 1950 and the sky is empty,
          because nothing had launched yet.
        </P>
        <P>
          Click any satellite and you get its real orbit path, its live sub-point (the lat/lon
          it&apos;s over right now), altitude, speed, apogee/perigee, period, and inclination —
          derived from the same SGP4 propagation, not looked up from a table.
        </P>

        <H2>True scale is honest, even when it&apos;s inconvenient</H2>
        <P>
          Low-orbit satellites sit only ~6–30% above Earth&apos;s surface. At true scale, that means
          they&apos;re invisible unless Earth fills the view — which is exactly why every serious
          satellite visualisation only ever shows Earth framed up close. The engine keeps the honest
          scale and gives you a one-click way to the view where they&apos;re visible, rather than
          faking their altitude to make them easier to see.
        </P>

        <H2>Real worlds, real elevation</H2>
        <P>
          Planets are built from real NASA / USGS maps. Mars carries actual MOLA elevation, so
          Olympus Mons genuinely rises and Valles Marineris genuinely cuts in. The Mars coverage view
          makes an honest point most space imagery hides: rovers have imaged something like{" "}
          <Code>0.0000016%</Code> of Mars at ground resolution — a few thin driving corridors. The
          rover on screen retraces Perseverance&apos;s <em>real</em> 480-waypoint, 19.84&nbsp;km
          traverse, pulled from NASA&apos;s published route.
        </P>

        <H2>From explore to compute</H2>
        <P>
          The Earth→Mars transfer tool is the part that reads as aerospace rather than art: a
          patched-conic Hohmann transfer computed from vis-viva — flight time, departure/arrival Δv,
          C3, phase angle, next launch window. It validates to the textbook numbers (258.9-day
          flight, 5.6&nbsp;km/s total Δv, 779.9-day synodic period, ~44° phase angle). The
          approximations are stated honestly; real mission design uses a full Lambert solver.
        </P>

        <H2>The data behind it</H2>
        <P>
          Everything is sourced and live: satellites from <Code>CelesTrak</Code>; space weather and
          aurora from <Code>NOAA SWPC</Code>; solar-flare events and near-Earth asteroids from{" "}
          <Code>NASA</Code>; launches from the <Code>Launch Library</Code>; and planet positions
          checked against <Code>JPL Horizons</Code>, the gold-standard ephemeris. No invented events,
          no synthetic collisions — the engine models real state, not &ldquo;what if.&rdquo;
        </P>

        <H2>Why build it this way</H2>
        <P>
          Most people have lost access to the real sky — light pollution, screens, distance. The
          engine is an attempt to give some of it back, faithfully: reverence over spectacle, real
          over invented. It&apos;s also the clearest thing I can point to about how I work — I
          research the problem, design the interaction, and prove it in real code, and I hold the
          result to whether it&apos;s <em>true</em>, not just whether it looks good.
        </P>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-10 pt-6 border-t border-border">
          Go explore it:{" "}
          <Link href="/lab/celestial" className="text-accent hover:underline">the live solar system</Link>. Search
          &ldquo;Cosmos 2546&rdquo; and watch a satellite from a real GPS-interference investigation
          trace its true Molniya orbit — because the data is real enough that it&apos;s just there.
        </p>

        <p className="font-sans text-[15px] md:text-base text-foreground/70 leading-relaxed mt-6">
          Questions about the Universe Engine? Email{" "}
          <a
            href="mailto:sinhaankur827@gmail.com?subject=Universe%20Engine"
            className="text-accent hover:underline"
          >
            sinhaankur827@gmail.com
          </a>
          .
        </p>
      </article>
    </main>
  )
}
