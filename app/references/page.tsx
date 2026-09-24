import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/references"),
  title: "References & Data Sources",
  description:
    "Every astronomy dataset, catalog, texture, and library behind the Universe Engine — with attribution and links. NASA, ESA, JPL, OpenNGC, HYG, IAU, and more.",
}

type Source = {
  name: string
  detail: string
  license: string
  href: string
}

const GROUPS: { heading: string; blurb: string; sources: Source[] }[] = [
  {
    heading: "Stars",
    blurb: "Real naked-eye stars projected to their true RA/Dec, coloured by B–V index and sized by apparent magnitude.",
    sources: [
      {
        name: "HYG Database v3.7",
        detail: "8,920 stars to magnitude 6.5 — positions, magnitudes, spectral colour. Compiled from Hipparcos, Yale Bright Star, and Gliese catalogs.",
        license: "Public domain (CC0)",
        href: "https://github.com/astronexus/HYG-Database",
      },
    ],
  },
  {
    heading: "Deep-sky objects",
    blurb: "Galaxies, nebulae, and clusters at their catalogued sky positions, including the Messier objects.",
    sources: [
      {
        name: "OpenNGC",
        detail: "NGC/IC catalog — 204 deep-sky objects used here: type, coordinates, magnitude, apparent size.",
        license: "MIT",
        href: "https://github.com/mattiaverga/OpenNGC",
      },
      {
        name: "Messier Catalogue",
        detail: "Curated editorial entries for the iconic Messier objects (M31 Andromeda, M42 Orion, M45 Pleiades, etc.).",
        license: "Public domain",
        href: "https://en.wikipedia.org/wiki/Messier_object",
      },
    ],
  },
  {
    heading: "Constellations",
    blurb: "All 88 IAU-recognised constellations with their line-figure geometry.",
    sources: [
      {
        name: "d3-celestial",
        detail: "Constellation line figures (constellations.lines.json); IAU 3-letter codes + names per the IAU Working Group on Star Names.",
        license: "BSD-3-Clause",
        href: "https://github.com/ofrohn/d3-celestial",
      },
    ],
  },
  {
    heading: "Exoplanets",
    blurb: "Confirmed exoplanet host stars in the cosmic neighbourhood (≤ 50 light-years).",
    sources: [
      {
        name: "NASA Exoplanet Archive",
        detail: "Planetary Systems Composite Parameters (pscomppars) — confirmed host stars + their planets.",
        license: "Public domain (NASA)",
        href: "https://exoplanetarchive.ipac.caltech.edu/",
      },
    ],
  },
  {
    heading: "Solar System orbits & bodies",
    blurb: "Planet, moon, and comet positions are computed from real mean orbital elements anchored to the J2000 epoch.",
    sources: [
      {
        name: "NASA / JPL Solar System Dynamics",
        detail: "Mean orbital elements, axial tilts, rotation periods, and physical data for the planets, moons, and comets.",
        license: "Public domain (NASA)",
        href: "https://ssd.jpl.nasa.gov/",
      },
      {
        name: "NASA Planetary Fact Sheets",
        detail: "Per-body physical parameters (mass, radius, gravity, temperature) surfaced in the info panels.",
        license: "Public domain (NASA)",
        href: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
      },
    ],
  },
  {
    heading: "Live feeds & real-time data",
    blurb:
      "Feeds that are real and current, pulled live in your browser. The site is a static export, so every live source here is keyless and CORS-open (or gracefully degrades) — no server, no key to leak. Sources that need a key or login are noted as next-steps, not shipped.",
    sources: [
      {
        name: "NASA APOD · NeoWs · DONKI",
        detail: "Astronomy Picture of the Day, near-Earth object feed, and the solar-flare event history behind the imagery + space-weather panels. Keyless via the shared DEMO_KEY (a personal key raises the rate limit).",
        license: "Public domain (NASA)",
        href: "https://api.nasa.gov/",
      },
      {
        name: "JAXA / JMA Himawari-9 (via NICT)",
        detail: "Live true-colour full-disk Earth from the Himawari-9 geostationary satellite, relayed by NICT's public real-time service. A latest.json names the newest frame so we show honest freshness (\"captured X min ago\"). Display-only (no pixel read-back); falls back to the fixed JMA still.",
        license: "JAXA/JMA imagery · NICT public feed",
        href: "https://himawari8.nict.go.jp/",
      },
      {
        name: "NOAA SWPC — Kp · OVATION · GOES X-ray · solar wind",
        detail: "Real-time geomagnetic conditions: planetary Kp, the OVATION modelled aurora oval, live GOES X-ray flux (the Sun's current output, read as a flare class), and solar-wind speed + IMF Bz. All keyless and CORS-open.",
        license: "Public domain (NOAA)",
        href: "https://services.swpc.noaa.gov/",
      },
      {
        name: "NOAA GOES-16/18 full-disk (NESDIS STAR)",
        detail: "GeoColor full-disk Earth over the Americas + Pacific, near-real-time, in the Watch Live panel.",
        license: "Public domain (NOAA)",
        href: "https://www.star.nesdis.noaa.gov/GOES/",
      },
      {
        name: "CelesTrak — TLE orbital elements",
        detail: "The two-line element sets propagated by SGP4 for every tracked satellite. Keyless and CORS-open.",
        license: "Public data (Dr. T.S. Kelso / CelesTrak)",
        href: "https://celestrak.org/",
      },
      {
        name: "wheretheiss.at — live ISS fix",
        detail: "An independent live ISS position, cross-checked against the engine's own SGP4 propagation. Keyless, CORS-open.",
        license: "Open API",
        href: "https://wheretheiss.at/",
      },
      {
        name: "ESA Gaia / Hipparcos — next-step",
        detail: "Gaia astrometry would deepen the engine's star truth (parallax distances, proper motion). Because the payload is large and the archive isn't reliably CORS-open, it's planned as a build-time bake rather than a live browser fetch — not yet shipped.",
        license: "CC BY 4.0 (ESA/Gaia DPAC)",
        href: "https://www.cosmos.esa.int/web/gaia/data-access",
      },
      {
        name: "Space-Track.org — next-step",
        detail: "The authoritative US catalogue of TLEs, richer than the keyless CelesTrak subset. It requires a login, so it can't ship keyless from a static site without a proxy — documented here as a next-step, not wired in.",
        license: "US Government · account required",
        href: "https://www.space-track.org/",
      },
    ],
  },
  {
    heading: "Surface textures",
    blurb: "Planet, moon, and Sun surface maps applied to the bodies on close approach.",
    sources: [
      {
        name: "Solar System Scope Textures",
        detail: "Equirectangular maps for the Sun, planets, the Moon, and Saturn's rings.",
        license: "CC BY 4.0",
        href: "https://www.solarsystemscope.com/textures/",
      },
      {
        name: "Björn Jónsson — planetary maps",
        detail: "The high-resolution Io map, assembled from real Galileo/Voyager imagery, used in the Super Clear view.",
        license: "Free use with attribution",
        href: "https://bjj.mmedia.is/",
      },
      {
        name: "NASA Visible Earth / Blue Marble",
        detail: "Reference imagery for Earth's day + night (city lights) appearance.",
        license: "Public domain (NASA)",
        href: "https://visibleearth.nasa.gov/",
      },
      {
        name: "ESO / Serge Brunier — The Milky Way panorama",
        detail: "The 360° photographic all-sky panorama behind the engine's solar-system vantage — real dust lanes, star clouds, and the Magellanic Clouds, mapped through the J2000 galactic-to-equatorial rotation.",
        license: "CC BY 4.0",
        href: "https://www.eso.org/public/images/eso0932a/",
      },
    ],
  },
  {
    heading: "Audio",
    blurb: "The opt-in galaxy soundtrack. Playback never auto-starts.",
    sources: [
      {
        name: "Ludovico Einaudi — “Experience” (reimagined)",
        detail: "Embedded via the SoundCloud Widget API, behind an explicit opt-in play control.",
        license: "© the artist · streamed via SoundCloud",
        href: "https://soundcloud.com/ludovicoeinaudi/experience-reimagined",
      },
    ],
  },
  {
    heading: "Engine & libraries",
    blurb: "The Universe Engine is built on the open-source web 3D stack.",
    sources: [
      {
        name: "Three.js",
        detail: "WebGL rendering foundation.",
        license: "MIT",
        href: "https://threejs.org/",
      },
      {
        name: "React Three Fiber + drei",
        detail: "React renderer for Three.js and its helper library.",
        license: "MIT",
        href: "https://docs.pmnd.rs/react-three-fiber",
      },
      {
        name: "Blender",
        detail: "Spacecraft, station, and small-body models authored in Blender and exported as glTF.",
        license: "GPL (tool) · models © Ankur Sinha",
        href: "https://www.blender.org/",
      },
    ],
  },
]

export default function ReferencesPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Universe Engine · References
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            The data behind the sky.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            The Universe Engine renders real positions, not decoration. Every
            star, deep-sky object, constellation, orbit, and texture traces back
            to a published dataset. The sources, their licenses, and links are
            below — credit where it's due.
          </p>

          {/* Thank-you to NASA — the engine's live feeds run on NASA's free,
              open APIs. Credit is a first principle here. */}
          <div className="mt-6 max-w-2xl rounded-xl border border-border bg-card/40 px-5 py-4">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
              With thanks
            </p>
            <p className="text-foreground/80 leading-relaxed text-sm">
              A sincere <span className="text-foreground">thank you to NASA</span>{" "}
              for its free, open data and public APIs — the live feeds in this
              engine (Astronomy Picture of the Day, near-Earth asteroids, space
              weather, Mars rover imagery, the Exoplanet Archive, and more) run on
              them. NASA data is generously made available to everyone, and this
              project would not be possible without it.
            </p>
            <p className="text-foreground/60 leading-relaxed text-sm mt-2">
              We&apos;re steadily adding more real sources over time — from ESA,
              JPL, NOAA, and other open archives — always cited, never invented.
            </p>
            <a
              href="https://discord.gg/ptbBeMKj7"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#5865F2]/50 bg-[#5865F2]/10 px-4 py-2 font-mono text-[11px] tracking-[0.08em] uppercase text-foreground hover:bg-[#5865F2]/20 transition-colors"
            >
              {/* Discord glyph */}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#5865F2" aria-hidden="true">
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.2.36-.43.845-.588 1.23a18.27 18.27 0 0 0-3.94 0A12.6 12.6 0 0 0 11.44 3a19.74 19.74 0 0 0-3.76 1.37C3.6 8.058 2.65 11.66 2.98 15.211a19.9 19.9 0 0 0 6.06 3.078c.49-.667.926-1.376 1.3-2.122a12.9 12.9 0 0 1-2.05-.984c.172-.126.34-.257.502-.392a14.2 14.2 0 0 0 12.02 0c.164.14.332.27.5.392-.654.386-1.34.716-2.05.985.374.745.81 1.454 1.3 2.12a19.86 19.86 0 0 0 6.06-3.077c.386-4.116-.66-7.685-2.905-10.842ZM9.68 13.037c-.955 0-1.74-.878-1.74-1.958 0-1.08.77-1.958 1.74-1.958.98 0 1.756.886 1.74 1.958 0 1.08-.77 1.958-1.74 1.958Zm4.64 0c-.955 0-1.74-.878-1.74-1.958 0-1.08.77-1.958 1.74-1.958.98 0 1.756.886 1.74 1.958 0 1.08-.76 1.958-1.74 1.958Z" />
              </svg>
              Join the Universe Engine community
            </a>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-14 md:mt-20 space-y-14 md:space-y-20 pb-24">
          {GROUPS.map((group) => (
            <section key={group.heading} className="grid gap-5 md:grid-cols-[auto_1fr] md:gap-10">
              <div className="md:w-56">
                <h2 className="font-serif text-2xl text-foreground mb-2">{group.heading}</h2>
                <p className="text-sm text-foreground/60 leading-relaxed">{group.blurb}</p>
              </div>
              <ul className="space-y-3">
                {group.sources.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-cursor-hover
                      className="group block rounded-xl border border-border bg-white/[0.02] p-4 md:p-5 transition-colors hover:border-accent/50 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="min-w-0 font-medium text-foreground group-hover:text-accent transition-colors">
                          {s.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                          {s.license}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground/70 leading-relaxed">{s.detail}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  )
}
