import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { ReadabilityNudge } from "@/components/readability-nudge"
import { Container } from "@/components/container"
import { UsabilityEngine } from "@/components/usability-engine"

export const metadata: Metadata = {
  title: "Usability — A practitioner's guide · Ankur Sinha",
  description:
    "An interactive usability engine — twelve heuristics for websites, applications, forms, and mobile surfaces, each with a story, a self-audit question, and a live good-vs-bad demo. Pick a surface to audit; the engine filters and recommends.",
}

export default function UsabilityPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />

      <main id="main" className="pt-24 pb-24">
        <Container width="default">
          {/* Page header */}
          <header className="mb-16 md:mb-24 max-w-4xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-6">
              Usability · The Usability Engine
            </p>
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
              Audit any surface against the things that actually break it.
            </h1>
            <p className="mt-8 font-sans text-lg md:text-xl text-foreground/85 max-w-3xl leading-relaxed">
              An interactive engine of usability heuristics. Each heuristic
              comes with a story, a live good-vs-bad demo where the difference
              is felt instead of read about, and a self-audit question for
              your own product. Pick a surface to filter the catalog and start.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] tracking-wider text-foreground/70">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-red-500" />
                Blocker · ships broken
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-amber-500" />
                Major · degrades trust
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Minor · sandpaper
              </span>
            </div>
          </header>

          {/* The engine itself */}
          <UsabilityEngine />

          {/* Foundation footer */}
          <section className="mt-24 md:mt-32 pt-12 border-t border-border">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-6">
              Foundation
            </p>
            <ul className="grid gap-6 md:grid-cols-3">
              <li>
                <p className="font-sans text-base md:text-lg text-foreground">
                  HFI Certified Usability Analyst
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  CUA · Human Factors International
                </p>
              </li>
              <li>
                <p className="font-sans text-base md:text-lg text-foreground">
                  B.Tech · Computer Science
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  BTLIT Bangalore · VTU · 2008–2013
                </p>
              </li>
              <li>
                <p className="font-sans text-base md:text-lg text-foreground">
                  12+ years shipping product
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Enterprise SaaS · AI surfaces · Native + Web
                </p>
              </li>
            </ul>
            <p className="mt-10 max-w-2xl font-sans text-sm md:text-base text-foreground/70 leading-relaxed">
              The engine keeps growing. Heuristics live in{" "}
              <span className="font-mono text-foreground">components/usability-engine/heuristics.ts</span>{" "}
              as data; each row is one entry. Interactive demos register
              under <span className="font-mono text-foreground">demos/</span> and
              link by key. The same authoring pattern the Universe Engine
              uses — add a row, the surface picks it up.
            </p>
          </section>
        </Container>
      </main>

      <Footer />
      <UpcomingBadge href="/upcoming" label="Upcoming" />
      <ReadabilityNudge />
    </>
  )
}
