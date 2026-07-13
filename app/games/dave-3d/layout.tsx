import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

// The page itself is a client component (full-bleed R3F canvas), so metadata
// lives here — without it the route inherits the HOMEPAGE canonical from the
// root layout and Google de-duplicates it into "/" (see app/layout.tsx).
export const metadata: Metadata = {
  ...canonicalPath("/games/dave-3d"),
  title: "Dave 3D — a faithful Dangerous Dave remake in the browser",
  description:
    "The classic Dangerous Dave, rebuilt side-on in 3D: the original levels recreated tile-for-tile on a hand-rolled R3F engine. Runs entirely in the browser.",
}

export default function Dave3DLayout({ children }: { children: React.ReactNode }) {
  return children
}
