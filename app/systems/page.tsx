import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { SystemsStatus } from "@/components/systems-status"

// Public "how the site runs itself" page — the autonomous systems (data-freshness
// worker, the free-GPU sky-copilot) with LIVE status. Craft transparency: it
// shows what keeps working on its own, and honestly flags anything down or stale.
export const metadata: Metadata = {
  title: "Systems — how the site keeps itself working",
  description:
    "The autonomous parts of sinhaankur.com: a daily data-freshness worker that keeps the Satellite Engine's real orbital data current (no AI, free), and sky-copilot — our own LLM brain on free GPU compute. Live status. The rule: degrade, never break.",
  alternates: { canonical: "https://www.sinhaankur.com/systems" },
}

export default function SystemsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28 pb-24 px-6 md:px-12">
        <div className="mx-auto w-full max-w-4xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground mb-4 lowercase">
            systems · what runs on its own
          </p>
          <h1 className="font-display text-3xl md:text-5xl font-light tracking-[-0.015em] leading-[1.08]">
            How the site keeps itself working.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base md:text-lg text-foreground/70 leading-relaxed">
            Some of this site runs with nobody in the loop — keeping the simulation&apos;s data real,
            and answering questions on free compute. Here&apos;s each piece, in plain terms, with its
            real status right now.
          </p>
          <div className="mt-14">
            <SystemsStatus />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
