import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SkillsBreakdown } from "@/components/skills-breakdown"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  title: "Skills · Ankur Sinha",
  description:
    "A UX designer's skill set — tied to real work at Oracle, Deloitte, Snowtint, Rage, plus independent AI experiments. Filter by category or company.",
}

export default function SkillsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="pt-24">
        <SkillsBreakdown />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
