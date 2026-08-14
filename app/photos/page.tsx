import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { ArtGallerySlider } from "@/components/photos/art-gallery-slider"

export const metadata: Metadata = {
  ...canonicalPath("/photos"),
  title: "Photos",
  description: "A gallery of photographs — a slower, quieter corner of Ankur Sinha's site.",
}

// A cinematic, full-bleed photo gallery. Reached from the footer only (not the
// navbar). Keeps the template's immersive dark style; a subtle link returns home.
export default function PhotosPage() {
  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black">
      <ArtGallerySlider />
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute right-8 bottom-8 z-30 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs tracking-widest text-white/60 backdrop-blur-md transition-colors hover:text-white/90"
      >
        ← Home
      </Link>
    </main>
  )
}
