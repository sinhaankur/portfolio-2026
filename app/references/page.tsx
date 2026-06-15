import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  title: "References & Data Sources · Ankur Sinha",
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
        name: "NASA Visible Earth / Blue Marble",
        detail: "Reference imagery for Earth's day + night (city lights) appearance.",
        license: "Public domain (NASA)",
        href: "https://visibleearth.nasa.gov/",
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
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-medium text-foreground group-hover:text-accent transition-colors">
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
