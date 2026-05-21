import type { Metadata } from "next"
import Link from "next/link"
import { UpcomingLanes } from "@/components/upcoming-lanes"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  title: "Upcoming · Ankur Sinha",
  description:
    "Work in flight, ideas cooking, threads being researched. A public roadmap of what's next from Ankur Sinha — Principal UX Designer, Human–AI Interaction.",
}

export default function UpcomingPage() {
  return (
    <>
      <CustomCursor />
      <main id="main" className="relative min-h-screen bg-background text-foreground">
        {/* Page Header */}
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10 pt-10 md:pt-16">
          <div className="flex items-center justify-between gap-4 mb-16 md:mb-24">
            <Link
              href="/"
              className="
                inline-flex items-center gap-2
                font-mono text-xs tracking-[0.25em] uppercase
                text-muted-foreground hover:text-foreground
                transition-colors duration-300
                focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-accent
                focus-visible:ring-offset-4 focus-visible:ring-offset-background
                rounded
              "
            >
              <span aria-hidden="true">←</span>
              Back to portfolio
            </Link>

            <div className="hidden md:flex items-center gap-3">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
                Live document — updated weekly
              </span>
            </div>
          </div>

          <div className="max-w-4xl">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground mb-6">
              06 — UPCOMING
            </p>
            <h1 className="font-sans text-5xl md:text-7xl lg:text-8xl font-light tracking-tight text-balance">
              What's <span className="italic">next</span>.
            </h1>
            <p className="mt-8 md:mt-12 max-w-2xl font-sans text-lg md:text-xl text-foreground/85 leading-relaxed">
              Most portfolios are graveyards of finished work. This page isn't.
              It's a public ledger of work in flight, half-built sketches, and
              threads I'm pulling on — kept honest by the dates next to each item.
            </p>
          </div>
        </header>

        {/* Three Lanes */}
        <UpcomingLanes />

        {/* Footer note */}
        <section className="px-6 md:px-12 pb-24 pt-16 border-t border-border">
          <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4">
              Editorial policy
            </p>
            <p className="font-sans text-base md:text-lg text-foreground/80 leading-relaxed">
              An item lives here for as long as it's accurate. When something
              ships, it moves to{" "}
              <Link
                href="/#works"
                className="text-foreground underline decoration-accent/50 underline-offset-4 hover:decoration-accent transition-colors"
              >
                Selected Works
              </Link>
              . When something dies, it gets a strikethrough and a one-line
              post-mortem. Nothing here is a promise — it's a reading of the
              room as of the date next to it.
            </p>
          </div>
          </div>
        </section>
      </main>
    </>
  )
}
