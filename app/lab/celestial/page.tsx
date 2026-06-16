import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { BODIES } from "@/lib/celestial-data"
import { CelestialOrrery } from "@/components/celestial/celestial-orrery"

export const metadata: Metadata = {
  title: "Celestial — the solar system, rendered in Blender · Ankur Sinha",
  description:
    "An interactive orbital tour of the solar system — the Sun, all eight planets, the Moon, and Pluto, rendered in Blender from real NASA/USGS data. Rotate each world in 3D in your browser. Open data, open assets.",
}

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
              The Sun and every planet, modelled in Blender from public NASA/USGS
              data — photoreal, interactive, and true to the data.
            </p>
            <p className="mt-6 font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              These aren&apos;t stock art. Each globe is a Blender scene built from
              real surface imagery and elevation data, with relief baked into the
              geometry. Pick a world along the orbit below, then tap{" "}
              <span className="text-accent">View in 3D</span> to rotate it yourself —
              the same model, streamed to your browser.
            </p>
          </header>

          {/* Bodies — orbital rail + focused detail */}
          <CelestialOrrery bodies={BODIES} />

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
