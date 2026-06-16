import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { BodyRender } from "@/components/celestial/body-render"

export const metadata: Metadata = {
  title: "Celestial — photoreal Mars & Moon, rendered in Blender · Ankur Sinha",
  description:
    "Photoreal Mars and Moon globes rendered in Blender from real NASA/USGS surface data, with the key facts and features. Open data, open assets.",
}

type Body = {
  name: string
  tagline: string
  img: string
  glb: string
  blurb: string
  facts: { label: string; value: string }[]
  features: { name: string; note: string }[]
  accent: string
}

const BODIES: Body[] = [
  {
    name: "Mars",
    tagline: "The Red Planet · 4th from the Sun",
    img: "/img/space/mars-globe.webp",
    glb: "/models/mars-globe.glb",
    accent: "#c1502e",
    blurb:
      "A cold desert world half Earth's size, wrapped in a thin CO₂ atmosphere. Its rust comes from iron oxide in the regolith. Mars holds the tallest volcano and the deepest canyon in the solar system — and, beneath the surface and poles, water ice.",
    facts: [
      { label: "Radius", value: "3,390 km" },
      { label: "Gravity", value: "3.72 m/s² (0.38 g)" },
      { label: "Day length", value: "24h 37m (1 sol)" },
      { label: "Year", value: "687 Earth days" },
      { label: "Moons", value: "Phobos · Deimos" },
      { label: "Mean temp", value: "−63 °C" },
    ],
    features: [
      { name: "Olympus Mons", note: "Largest volcano in the solar system — ~22 km tall, ~3× Everest." },
      { name: "Valles Marineris", note: "A canyon system over 4,000 km long — would span the continental US." },
      { name: "Jezero Crater", note: "An ancient river delta — where Perseverance has been roving since 2021." },
      { name: "Polar ice caps", note: "Water and frozen CO₂ that grow and shrink with the Martian seasons." },
    ],
  },
  {
    name: "Moon",
    tagline: "Earth's only natural satellite",
    img: "/img/space/moon-globe.webp",
    glb: "/models/moon-globe.glb",
    accent: "#9ca3af",
    blurb:
      "Born ~4.5 billion years ago, likely from a giant impact on the early Earth. It's tidally locked, so we always see the same face. Its dark plains are ancient lava flows (maria); the bright highlands are older, cratered crust. No atmosphere means every impact is preserved.",
    facts: [
      { label: "Radius", value: "1,737 km" },
      { label: "Gravity", value: "1.62 m/s² (0.17 g)" },
      { label: "Distance", value: "384,400 km" },
      { label: "Orbit", value: "27.3 days" },
      { label: "Day temp", value: "+127 °C" },
      { label: "Night temp", value: "−173 °C" },
    ],
    features: [
      { name: "Mare Tranquillitatis", note: "Sea of Tranquility — Apollo 11's 1969 landing site." },
      { name: "Tycho", note: "A young, bright crater with rays of ejecta splashed across the surface." },
      { name: "Highlands", note: "The pale, heavily-cratered ancient crust — the Moon's oldest terrain." },
      { name: "South Pole", note: "Permanently-shadowed craters holding water ice — the target for Artemis." },
    ],
  },
]

export default function CelestialPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 pb-24">
        <Container>
          {/* Back link */}
          <Link
            href="/#lab"
            data-cursor-hover
            className="group inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Back to The Lab
          </Link>

          {/* Header */}
          <header className="mb-16 md:mb-24 max-w-3xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-6">
              The Lab · Celestial
            </p>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02]">
              Worlds, rendered from <span className="italic">real data</span>.
            </h1>
            <p className="mt-6 font-serif italic text-xl md:text-2xl text-foreground/85">
              Mars and the Moon, modelled in Blender from public NASA/USGS surface
              maps — photoreal, and true to the data.
            </p>
            <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              These aren&apos;t stock art. Each globe is a Blender scene built from
              real surface imagery and elevation data, with relief baked into the
              geometry. Tap <span className="text-accent">View in 3D</span> on any
              world to rotate it yourself — the same model, streamed to your browser.
            </p>
          </header>

          {/* Bodies */}
          <div className="space-y-24 md:space-y-32">
            {BODIES.map((body) => (
              <section key={body.name} aria-labelledby={`${body.name}-heading`}>
                <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {/* Render — poster still that swaps to interactive 3D on tap */}
                  <BodyRender
                    poster={body.img}
                    glb={body.glb}
                    name={body.name}
                    accent={body.accent}
                  />

                  {/* Data */}
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-3">
                      {body.tagline}
                    </p>
                    <h2
                      id={`${body.name}-heading`}
                      className="font-display text-3xl md:text-5xl font-light tracking-[-0.01em] mb-5"
                    >
                      {body.name}
                    </h2>
                    <p className="font-sans text-base md:text-lg text-foreground/80 leading-relaxed mb-8">
                      {body.blurb}
                    </p>

                    {/* Facts grid */}
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden mb-8">
                      {body.facts.map((f) => (
                        <div key={f.label} className="bg-background p-3.5">
                          <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1">
                            {f.label}
                          </dt>
                          <dd className="font-sans text-sm text-foreground tabular-nums">{f.value}</dd>
                        </div>
                      ))}
                    </dl>

                    {/* Features */}
                    <ul className="space-y-3">
                      {body.features.map((feat) => (
                        <li key={feat.name} className="grid grid-cols-[auto_1fr] gap-3">
                          <span
                            aria-hidden
                            className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: body.accent }}
                          />
                          <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
                            <span className="text-foreground">{feat.name}.</span>{" "}
                            {feat.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Open data / credits */}
          <section className="mt-24 md:mt-32 rounded-lg border border-border bg-secondary/20 p-6 md:p-8 max-w-3xl">
            <p className="font-mono text-[10px] tracking-widest uppercase text-accent mb-3">
              Open data & credits
            </p>
            <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed mb-4">
              Surface maps are public-domain / CC planetary imagery derived from NASA
              and USGS Astrogeology missions (Viking, MGS/MOLA, LRO). The Blender
              scenes and rendered images live in this site&apos;s repository — free
              to inspect and reuse. Built so anyone curious about these worlds can
              see them honestly, not as decoration.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a
                href="https://images.nasa.gov/"
                target="_blank"
                rel="noreferrer noopener"
                data-cursor-hover
                className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase text-accent hover:text-foreground transition-colors"
              >
                NASA Image Library <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://astrogeology.usgs.gov/"
                target="_blank"
                rel="noreferrer noopener"
                data-cursor-hover
                className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase text-accent hover:text-foreground transition-colors"
              >
                USGS Astrogeology <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  )
}
