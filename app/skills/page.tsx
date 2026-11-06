import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SkillsLayers } from "@/components/skills-layers"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  ...canonicalPath("/skills"),
  title: "How I think — the method behind the work",
  description:
    "Not a list of skills — the way I actually solve problems, in order: information architecture first, then UX, affordance, and building the real thing. Every step links the real work it produced. Shown, not scored.",
}

export default function SkillsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main">
        <SkillsLayers />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
