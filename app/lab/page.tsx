import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Lab } from "@/components/lab"
import { ScrollCinema } from "@/components/scroll-cinema"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { LabWaveBackground } from "@/components/lab-wave-background"

export const metadata: Metadata = {
  ...canonicalPath("/lab"),
  title: "Lab",
  description:
    "Self-directed AI exploration — not client work. Unhosted, the Usability Engine, the Universe Engine Assistant, Celestial, and more: a UX designer learning the human–AI seam by building it as working code.",
}

export default function LabPage() {
  return (
    <>
      <CustomCursor />
      <LabWaveBackground />
      <Navbar />
      <main id="main" className="relative z-10 pt-24">
        {/* Cinematic overture — two claims from the Lab's own copy, pinned +
            scroll-scrubbed (same primitive as the home act break). Short on
            purpose: this is a destination page, so two scenes, then the work.
            startVisible: the cinema opens the page, so the first line must be
            on stage at scroll 0 — without it, landing here is a blank viewport. */}
        <ScrollCinema
          startVisible
          lines={[
            "How I'm learning AI — by building it.",
            "The design argument, shipped as working software.",
          ]}
        />
        <Lab />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
