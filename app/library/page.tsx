import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CapabilitiesLibrary } from "@/components/capabilities-library"
import { CustomCursor } from "@/components/custom-cursor"
import { UpcomingBadge } from "@/components/upcoming-badge"

export const metadata: Metadata = {
  ...canonicalPath("/library"),
  title: "The Library — Design, Web, Math, Full-Stack, DevOps, PM, Video, 3D",
  description:
    "A craft library of nine disciplines Ankur builds with — Design, Web Development, Mathematics, Full-Stack, DevOps, Product Management, Visual Design, Video Editing, and 3D Modeling — each backed by real work you can open and watch run.",
}

export default function LibraryPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="pt-24">
        <CapabilitiesLibrary />
        <Footer />
      </main>
      <UpcomingBadge href="/upcoming" label="Upcoming" />
    </>
  )
}
