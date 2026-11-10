import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

// The /waves page is a client component (the full-screen WebGL ocean), so it
// can't export metadata itself. This server layout supplies the per-route
// canonical + title + description so Google doesn't treat /waves as a DUPLICATE
// of the homepage — without this it inherited the root layout's `canonical: "/"`
// and the homepage title, which Search Console flagged as
// "Duplicate without user-selected canonical" (2026-11). Mirrors /lab/big-bang.
export const metadata: Metadata = {
  ...canonicalPath("/waves"),
  title: "The Waves — a living sea under a real sky",
  description:
    "A quiet, living ocean rendered in the browser: a procedural real-time Gerstner sea under a real sun and moon, with wind, tides and a day-scrubber. Full-screen, like /sky. Part of the Lab.",
}

export default function WavesLayout({ children }: { children: React.ReactNode }) {
  return children
}
