import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/earth"),
  title: "Earth — the living planet, from real data",
  description:
    "Our planet, told through real, open data: fly the measured 3D surface (NASA ETOPO/GEBCO elevation with Blue Marble imagery), click anywhere to read the live weather there (Open-Meteo), watch it whole from orbit (Himawari, GOES, NASA GIBS), and check its space weather. Keyless, on-device, honest.",
  keywords: [
    "Earth 3D",
    "live Earth weather",
    "Earth from space",
    "NASA GIBS Earth",
    "Himawari live Earth",
    "GEBCO bathymetry",
    "ETOPO elevation",
    "Open-Meteo",
    "Earth data visualization",
    "planet Earth interactive",
  ],
}

// The Earth-data theme's home: each card deep-links into a real, live tool.
const PIECES: { tag: string; title: string; line: string; href: string }[] = [
  {
    tag: "3D surface · depth",
    title: "Fly the real surface",
    line:
      "The measured 3D Earth — NASA ETOPO / GEBCO elevation as true relief, with Blue Marble imagery that sharpens as you descend. Drain the oceans to see the seafloor. Click anywhere on the globe to read the live weather right there.",
    href: "/lab/terrain#earth",
  },
  {
    tag: "Surface weather · live",
    title: "The weather, anywhere",
    line:
      "Search any place on Earth (or use your location) for current conditions, a six-day forecast, and air quality — blended from national weather-service models via Open-Meteo. Keyless, loads on-device.",
    href: "/lab/celestial",
  },
  {
    tag: "From orbit · live",
    title: "Watch it whole",
    line:
      "The entire planet from geostationary and polar orbit: JAXA Himawari and NOAA GOES full-disk views, and NASA GIBS daily true-colour + land-surface-temperature mosaics — the whole Earth, refreshed through the day.",
    href: "/lab/celestial",
  },
  {
    tag: "Space weather · live",
    title: "The Sun on the Earth",
    line:
      "What the Sun is doing to our planet right now: geomagnetic Kp, the OVATION aurora oval, live GOES X-ray flux, and an honest aurora call for your latitude — all from NOAA SWPC.",
    href: "/lab/celestial",
  },
]

export default function EarthHubPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10 golden-split items-start">
          <div>
            <p className="font-mono uppercase text-muted-foreground" style={{ fontSize: "var(--text-phi--1)", letterSpacing: "0.3em", marginBottom: "var(--space-phi-3)" }}>
              The living planet
            </p>
            <h1 className="font-serif leading-[1.05] italic" style={{ fontSize: "var(--text-phi-5)", marginBottom: "var(--space-phi-3)" }}>
              Earth, from real data.
            </h1>
            <p className="text-foreground/75 leading-relaxed" style={{ fontSize: "var(--text-phi-1)" }}>
              The same instinct as the sky engines, turned to the ground beneath us:
              the <em>real</em> Earth — its measured shape, its weather, its face from
              orbit — assembled from open agency data and rendered on your device.
              Nothing invented; where a reading isn&apos;t known, it says so.
            </p>
          </div>
          <p className="text-muted-foreground leading-relaxed md:pt-[var(--space-phi-6)]">
            The goal is depth — to descend from orbit to the ground and have it stay
            real the whole way down. This is where that work lives, and grows.
            <span className="mt-[var(--space-phi-3)] block font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
              keyless · on-device · sourced
            </span>
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 pb-24" style={{ marginTop: "var(--space-phi-6)" }}>
          <div className="grid md:grid-cols-2" style={{ gap: "var(--space-phi-3)" }}>
            {PIECES.map((p) => (
              <Link
                key={p.title}
                href={p.href}
                data-cursor-hover
                className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-accent/60 transition-colors"
                style={{ padding: "var(--space-phi-4)" }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-phi-2)" }}>
                  <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{p.tag}</span>
                  <span className="font-mono text-[10px] text-muted-foreground group-hover:text-accent transition-colors">open →</span>
                </div>
                <h2 className="font-serif text-foreground group-hover:text-accent transition-colors" style={{ fontSize: "var(--text-phi-2)", marginBottom: "var(--space-phi-1)" }}>{p.title}</h2>
                <p className="text-foreground/70 leading-relaxed" style={{ fontSize: "var(--text-phi-0)" }}>{p.line}</p>
              </Link>
            ))}
          </div>

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border max-w-2xl" style={{ paddingTop: "var(--space-phi-4)", marginTop: "var(--space-phi-5)" }}>
            Every layer here is real and sourced — NASA (ETOPO, GIBS, GOES), GEBCO,
            JAXA/JMA Himawari, NOAA SWPC, Open-Meteo — and credited on the{" "}
            <Link href="/references" data-cursor-hover className="text-accent hover:underline">references</Link> page.
            It&apos;s the companion to the{" "}
            <Link href="/lab/celestial" data-cursor-hover className="text-accent hover:underline">Satellite Engine</Link> and the{" "}
            <Link href="/lab/terrain" data-cursor-hover className="text-accent hover:underline">planetary terrain</Link> explorer:
            make the invisible legible, from real data, for anyone. Seeing is believing.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
