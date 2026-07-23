import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { DnaGate } from "@/components/dna/dna-gate"
import { canonicalPath } from "@/lib/seo"

// Public + shareable. It's an upload-your-own, 100%-on-device tool — no personal
// data is ever served, so it's safe to make discoverable + shareable. Rich share
// metadata so a shared link previews well.
export const metadata: Metadata = {
  ...canonicalPath("/dna"),
  title: "Read your DNA — free, private, in your browser",
  description:
    "Upload a raw DNA file (MyHeritage, 23andMe, AncestryDNA) and see what it says: your traits, a personalized plan, ancestry origins, and the science — all on-device. Nothing is uploaded or stored. Every claim links to its published source.",
  openGraph: {
    title: "Read your DNA — free, private, in your browser",
    description:
      "See what your DNA says — traits, a personalized plan, ancestry, and the real science. 100% on-device; your file never leaves your browser.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Read your DNA — free & private",
    description: "Upload your raw DNA file and see what it says. On-device, nothing stored.",
  },
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
      <Footer hideContact />
    </>
  )
}
