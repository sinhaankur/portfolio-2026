import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { CelestialExplorer } from "@/components/celestial/celestial-explorer"

export const metadata: Metadata = {
  ...canonicalPath("/lab/celestial"),
  title: "Celestial — explore the solar system",
  description:
    "A full-screen, interactive solar system — real distances, planets, moons, and satellites, with photoreal Blender globes rendered from NASA/USGS data. Explore each world in detail.",
}

export default function CelestialPage() {
  return <CelestialExplorer />
}
