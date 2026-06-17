import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Lab } from "@/components/lab"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  title: "Lab · Ankur Sinha",
  description:
    "Side projects shipped as working software — Unhosted, the Usability Engine, the Universe Engine Assistant, Celestial, and more. Each one is a design argument built as real code.",
}

export default function LabPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="pt-24">
        <Lab />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
