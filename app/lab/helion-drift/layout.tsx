import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/helion-drift"),
  title: "Helion Drift — fly the real Solar System",
  description:
    "A space flight game in the browser: every planet where it really is today, stations to refuel at, worlds to survey, an asteroid belt to mine and hostile bases to break. Built on the Universe Engine's real orbital data.",
  // Rebuilt 2026-11 (open-system flight, fuel, stations, bases, asteroid fields).
  // Still unlisted while it's play-tested: no inbound links, not in the sitemap,
  // noindex. Un-hide = remove this, add the sitemap entry + Gamelist/Lab links.
  robots: { index: false, follow: true },
}

export default function HelionDriftLayout({ children }: { children: React.ReactNode }) {
  return children
}
