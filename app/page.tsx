import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { About } from "@/components/about"
import { Works } from "@/components/works"
import { Lab } from "@/components/lab"
import { Usability } from "@/components/usability"
import { TechMarquee } from "@/components/tech-marquee"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { SmoothScroll } from "@/components/smooth-scroll"
import { SectionBlend } from "@/components/section-blend"
import { UpcomingBadge } from "@/components/upcoming-badge"

export default function Home() {
  return (
    <SmoothScroll>
      <CustomCursor />
      <Navbar />
      <main id="main">
        <Hero />
        <SectionBlend />
        <About />
        <Works />
        <Lab />
        <Usability />
        <TechMarquee />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </SmoothScroll>
  )
}
