import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Lab } from "@/components/lab"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  title: "Lab · Ankur Sinha",
  description:
    "Self-directed AI exploration — not client work. Unhosted, the Usability Engine, the Universe Engine Assistant, Celestial, and more: a UX designer learning the human–AI seam by building it as working code.",
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
