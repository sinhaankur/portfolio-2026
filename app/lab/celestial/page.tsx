import type { Metadata } from "next"
import { canonicalPath, canonicalUrl } from "@/lib/seo"
import { CelestialExplorer } from "@/components/celestial/celestial-explorer"
import { SkyTonight } from "@/components/sky-tonight"

export const metadata: Metadata = {
  ...canonicalPath("/lab/celestial"),
  title: "Satellite tracker — 18,500+ satellites orbiting Earth, live orbital paths",
  description:
    "See every satellite orbiting Earth — 18,500+ tracked objects on real SGP4 orbits, each with its live orbital path, altitude and distance from you. Watch the ISS pass over your location, scrub the timeline back to 1957 to replay the space age, screen close-approach conjunctions, and view Earth-to-Mars transfer windows. Real data from NASA, NORAD & NOAA.",
  keywords: [
    "how many satellites are orbiting Earth",
    "number of satellites",
    "satellites orbiting Earth",
    "view satellites with Earth orbital path",
    "satellite tracker",
    "live satellite map",
    "real-time satellite tracking",
    "satellite orbit visualization",
    "Earth orbit map",
    "ISS pass predictions",
    "ISS tracker",
    "orbital debris tracker",
    "conjunction screening",
    "solar system simulator",
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
    title: "Satellite tracker — 18,500+ satellites orbiting Earth, live orbital paths",
    description:
      "See every satellite orbiting Earth on its real orbital path — 18,500+ tracked objects, ISS passes over you, distance from your location, conjunction screening, and Earth-to-Mars transfers. Real NASA / NORAD / NOAA data.",
    type: "website",
  },
}

// Structured data — tells search engines this is an interactive tool built on a
// real, sizeable dataset (the ~18,500-object catalogue), so queries like
// "how many satellites are orbiting Earth" / "view satellites with Earth orbital
// path" can surface it. Two @graph nodes: the WebApplication + the Dataset.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": canonicalUrl("/lab/celestial") + "#app",
      name: "Celestial — Satellite Tracker",
      url: canonicalUrl("/lab/celestial"),
      applicationCategory: "Educational",
      operatingSystem: "Web browser",
      browserRequirements: "Requires WebGL",
      description:
        "An in-browser, real-time explorer for the 18,500+ satellites and debris objects orbiting Earth, each propagated on its real SGP4 orbit and drawn with its live orbital path. Includes ISS pass prediction over your location, distance-from-you readout, close-approach conjunction screening, space weather, and Earth-to-Mars transfer windows.",
      featureList: [
        "Track 18,500+ satellites on real orbits",
        "Every satellite's live orbital path around Earth",
        "Distance from your location to any satellite",
        "ISS pass predictions over your location",
        "Close-approach conjunction screening",
        "Scrub the timeline from 1957 to today",
      ],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "Dataset",
      "@id": canonicalUrl("/lab/celestial") + "#dataset",
      name: "Earth-orbit satellite catalogue (SGP4)",
      description:
        "A snapshot of 18,500+ satellites and tracked debris objects in Earth orbit, propagated with SGP4 from public two-line element sets, refreshed from the CelesTrak catalogue. Used to render each object's real position and orbital path.",
      creator: { "@type": "Person", name: "Ankur Sinha" },
      isAccessibleForFree: true,
      keywords: [
        "satellites orbiting Earth",
        "number of satellites",
        "orbital debris",
        "SGP4",
        "two-line element set",
      ],
      variableMeasured: "Satellite position, altitude, orbital path",
    },
  ],
}

export default function CelestialPage() {
  return (
    <>
      {/* PERF — start the 1.1 MB (gzipped) satellite catalogue downloading the
          moment this page's HTML is parsed, IN PARALLEL with the R3F/engine JS
          bundle booting. Without this the catalogue fetch only fires after the
          engine mounts and calls loadFullCatalog(), serialising download AFTER
          JS execution. Prefetch overlaps the two → the swarm data is often
          already in cache by the time the engine asks for it. `as="fetch"` +
          crossOrigin so the browser reuses this exact response for the later
          fetch() (same request mode). */}
      <link rel="prefetch" href="/data/satellites.json" as="fetch" crossOrigin="anonymous" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <CelestialExplorer />
      {/* "What's happening in the sky" — real events (showers, oppositions,
          conjunctions) + opt-in browser reminders. Renders nothing on a quiet sky. */}
      <SkyTonight />
    </>
  )
}
