import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { SpacecraftGallery } from "@/components/spacecraft/spacecraft-gallery"

export const metadata: Metadata = {
  ...canonicalPath("/reference/spacecraft"),
  title: "Spacecraft catalog — a live 3D reference of real space missions",
  description:
    "A browsable catalog of real human-made spacecraft — Voyager, Hubble, Cassini, the ISS, JWST, Parker Solar Probe, the Mars orbiters and more — each shown as a live rotating 3D model with its real agency, orbit, launch date, size, and mission history. A reference companion to the Satellite Engine.",
  keywords: [
    "spacecraft catalog",
    "space missions list",
    "Voyager spacecraft",
    "Cassini",
    "Hubble Space Telescope",
    "James Webb Space Telescope",
    "Parker Solar Probe",
    "Mars orbiters",
    "MESSENGER",
    "BepiColombo",
    "New Horizons",
    "3D spacecraft models",
    "space probe reference",
    "satellite history",
  ],
  openGraph: {
    ...canonicalPath("/reference/spacecraft").openGraph,
    title: "Spacecraft catalog — a live 3D reference of real space missions",
    description:
      "Browse real spacecraft as live rotating 3D models with their real orbits, launch dates, and mission history — Voyager, Cassini, Hubble, JWST, the Mars orbiters and more.",
    type: "website",
  },
}

export default function SpacecraftReferencePage() {
  return <SpacecraftGallery />
}
