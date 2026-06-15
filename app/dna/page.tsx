import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { DnaGate } from "@/components/dna/dna-gate"

// Unlisted + password-gated. Keep it out of search indexes; it's shared by
// direct link only and never appears in nav or the sitemap.
export const metadata: Metadata = {
  title: "DNA · Private",
  robots: { index: false, follow: false },
}

export default function DnaPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-28 pb-24">
        <Container>
          <DnaGate />
        </Container>
      </main>
      <Footer />
    </>
  )
}
