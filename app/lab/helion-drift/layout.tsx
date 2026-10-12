import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/helion-drift"),
  title: "Helion Drift — a space defender game in the browser",
  description:
    "A playable space defender built on a hand-rolled R3F game engine: procedural enemy ships, Blender-modelled asteroids, and the Universe Engine's real solar system as the battlefield. Runs entirely in the browser.",
  // Hidden from the site while the rendering is being improved (2026-10-12):
  // no inbound links, dropped from the sitemap, and noindex so search engines
  // drop it. The route still loads via a direct URL. Un-hide = remove this and
  // restore the sitemap entry + the /library and /tv links.
  robots: { index: false, follow: true },
}

export default function HelionDriftLayout({ children }: { children: React.ReactNode }) {
  return children
}
