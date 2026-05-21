import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { SkillsBreakdown } from "@/components/skills-breakdown"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  title: "Skills · Ankur Sinha",
  description:
    "Principal-level UX profile — skills tied to real work at Oracle, Deloitte, Snowtint, Rage, and independent product experiments. Filter by category or company.",
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
