import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { TerrainExplorer } from "@/components/terrain/terrain-explorer"

export const metadata: Metadata = {
  ...canonicalPath("/lab/terrain"),
  title: "Planetary terrain — real 3D surface of Mars, the Moon & more",
  description:
    "Fly over the real surface of the planets. A displaced-sphere terrain engine built from measured elevation data — NASA MOLA for Mars (Olympus Mons, Valles Marineris), LOLA for the Moon, GEBCO for a drained-ocean Earth — with landing-site pins that open live NASA rover imagery. Real topography, honestly labelled.",
  keywords: [
    "Mars terrain 3D",
    "Mars surface map",
    "MOLA elevation",
    "Olympus Mons 3D",
    "Valles Marineris",
    "Moon terrain",
    "LOLA lunar topography",
    "Earth without water",
    "ocean floor topography",
    "GEBCO bathymetry",
    "planetary elevation model",
    "Mars rover map",
    "Perseverance Jezero Crater",
    "Curiosity Gale Crater",
    "NASA rover imagery",
    "WebGL planet surface",
    "digital elevation model",
  ],
  openGraph: {
    ...canonicalPath("/lab/terrain").openGraph,
    title: "Planetary terrain — real 3D surface of Mars, the Moon & more",
    description:
      "Fly over the measured surface of the planets: NASA MOLA/LOLA/GEBCO elevation as a real displaced 3D globe, with landing-site pins that open live NASA rover imagery.",
    type: "website",
  },
}

export default function TerrainPage() {
  return <TerrainExplorer />
}
