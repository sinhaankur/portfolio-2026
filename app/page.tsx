import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { About } from "@/components/about"
import { CustomCursor } from "@/components/custom-cursor"
import { SmoothScroll } from "@/components/smooth-scroll"
import { SectionBlend } from "@/components/section-blend"
import { UpcomingBadge } from "@/components/upcoming-badge"
import { HomeBelowFold } from "@/components/home-below-fold"
import { LocaleRedirect } from "@/components/locale-redirect"

export default function Home() {
  return (
    <SmoothScroll>
      <CustomCursor />
      <Navbar />
      <main id="main">
        {/* Above the fold — eager so first paint is immediate. */}
        <Hero />
        <SectionBlend />
        <About />
        {/* Below the fold — code-split + render-deferred until near viewport. */}
        <HomeBelowFold />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
      {/* Automatic location-based language: Arabic/Japanese visitors are routed to
          /ar or /ja (browser language → geo-IP fallback). No manual switcher; the
          localized pages keep a small "English" link as the escape hatch. */}
      <LocaleRedirect />
    </SmoothScroll>
  )
}
