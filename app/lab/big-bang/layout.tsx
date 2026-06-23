import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

// The page itself is a client component (R3F canvas), so it can't export
// metadata. This server layout supplies the per-route canonical + title so the
// page isn't de-duplicated into the homepage canonical (and gets its own snippet).
export const metadata: Metadata = {
  ...canonicalPath("/lab/big-bang"),
  title: "Big Bang — a scrubbable cosmic timeline",
  description:
    "A real-time, scientifically-accurate timeline of the universe — from the Planck epoch to the formation of our Solar System — rendered in the browser. Part of the Lab.",
}

export default function BigBangLayout({ children }: { children: React.ReactNode }) {
  return children
}
