import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SkillsBreakdown } from "@/components/skills-breakdown"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  ...canonicalPath("/skills"),
  title: "Skills",
  description:
    "No self-scored stars — every skill points at real work you can open: shipped case studies at Oracle, Deloitte, Snowtint, Rage, and live things from the Lab. Shown, not scored.",
}

export default function SkillsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main">
        <SkillsBreakdown />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
