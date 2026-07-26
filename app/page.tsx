import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { About } from "@/components/about"
import { ScrollCinema } from "@/components/scroll-cinema"
import { PRINCIPLE_TITLES } from "@/lib/principles"
import { CustomCursor } from "@/components/custom-cursor"
import { SmoothScroll } from "@/components/smooth-scroll"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { HomeBelowFold } from "@/components/home-below-fold"
import { LocaleRedirect } from "@/components/locale-redirect"

export default function Home() {
  return (
    <SmoothScroll>
      <CustomCursor />
      <Navbar />
      <main id="main">
        {/* Above the fold — eager so first paint is immediate. The hero mounts a
            FIXED galaxy backdrop that persists behind the act break below, so the
            opening scrolls as one continuous cinematic descent through space. */}
        <Hero />
        {/* Cinematic act break — the four principle claims pass at full-viewport
            scale, scrubbed by scroll (pinned scrollytelling), OVER the live
            galaxy. The sky dissolves to background partway through (driven in
            hero.tsx) so the readable manifesto below lands on calm ground. No
            SectionBlend here anymore: the persistent sky IS the transition. */}
        <ScrollCinema lines={[...PRINCIPLE_TITLES]} />
        {/* From here down the content sits on an OPAQUE surface (z-10 +
            bg-background) so the faded sky never bleeds through the text. By the
            time About is reached skyOpacity is already 0, so there's no seam. */}
        <div className="relative z-10 bg-background">
          <About />
          {/* Below the fold — code-split + render-deferred until near viewport. */}
          <HomeBelowFold />
        </div>
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
      {/* Automatic location-based language: Arabic/Japanese visitors are routed to
          /ar or /ja (browser language → geo-IP fallback). No manual switcher; the
          localized pages keep a small "English" link as the escape hatch. */}
      <LocaleRedirect />
    </SmoothScroll>
  )
}
