import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

// Legacy route — the game now lives at /lab/helion-drift (this page re-exports
// the same experience), so the canonical points there to avoid a duplicate.
export const metadata: Metadata = {
  ...canonicalPath("/lab/helion-drift"),
  title: "Helion Drift — a space defender game in the browser",
  description:
    "A playable space defender built on a hand-rolled R3F game engine: procedural enemy ships, Blender-modelled asteroids, and the Universe Engine's real solar system as the battlefield. Runs entirely in the browser.",
}

export default function StarCleaverLayout({ children }: { children: React.ReactNode }) {
  return children
}
