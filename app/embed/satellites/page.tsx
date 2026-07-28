import type { Metadata } from "next"
import { EmbedTracker } from "@/components/celestial/embed-tracker"

export const metadata: Metadata = {
  title: "Live Satellite Tracker — embeddable",
  description:
    "An embeddable live tracker of 18,500+ satellites orbiting Earth on real SGP4 orbits. Public data (CelesTrak/NORAD, NASA, NOAA), for awareness & education.",
  // The embed is a utility view, not a content page — keep it out of the index
  // (the canonical experience is /lab/celestial), but let it be framed anywhere.
  robots: { index: false, follow: false },
}

export default function EmbedSatellitesPage() {
  return <EmbedTracker />
}
