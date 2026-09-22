import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

// The page itself is a client component (full-bleed R3F canvas), so metadata
// lives here — without it the route inherits the HOMEPAGE canonical from the
// root layout and Google de-duplicates it into "/" (see app/layout.tsx).
export const metadata: Metadata = {
  ...canonicalPath("/games/ritam-3d"),
  title: "Ritam 3D — a side-on 3D caverns platformer in the browser",
  description:
    "Ritam 3D: an original side-scrolling 3D platformer. Run and jump the hero through themed caverns, grab the treasures, dodge fire and water, and reach the door. A hand-rolled R3F engine that runs entirely in the browser.",
}

export default function Ritam3DLayout({ children }: { children: React.ReactNode }) {
  return children
}
