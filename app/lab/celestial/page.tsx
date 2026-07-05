import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { CelestialExplorer } from "@/components/celestial/celestial-explorer"

export const metadata: Metadata = {
  ...canonicalPath("/lab/celestial"),
  title: "Celestial — real-time solar system & satellite tracker",
  description:
    "A live, real-time solar system explorer: track 18,500+ satellites on real SGP4 orbits, see ISS passes over your location, the Mars sites rovers have actually imaged, live space weather & aurora forecast, upcoming rocket launches, and Earth-to-Mars transfer windows. Real data from NASA, NORAD & NOAA.",
  keywords: [
    "satellite tracker",
    "real-time satellite map",
    "ISS pass predictions",
    "solar system simulator",
    "orbit visualization",
    "SGP4",
    "space weather",
    "aurora forecast",
    "Mars rover map",
    "rocket launch schedule",
    "Earth to Mars transfer window",
    "near-Earth asteroids",
    "WebGL space visualization",
  ],
  openGraph: {
    ...canonicalPath("/lab/celestial").openGraph,
    title: "Celestial — real-time solar system & satellite tracker",
    description:
      "Track 18,500+ satellites on real orbits, ISS passes over you, live space weather, launches, Mars imaging coverage, and Earth-to-Mars transfers. Real NASA / NORAD / NOAA data.",
    type: "website",
  },
}

export default function CelestialPage() {
  return <CelestialExplorer />
}
