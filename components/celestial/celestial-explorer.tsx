"use client"

/**
 * CelestialExplorer — a full-screen, immersive solar-system exploration page.
 * No site footer/chrome: the live Universe Engine fills the viewport (real
 * distances via its Scale toggle, planets, moons, satellites, warp/zoom), with
 * a compact title tile, a body rail along the bottom, and a slide-in detail
 * tile that shows the photoreal Blender globe + data for the picked world.
 */

import { useState, useEffect } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, X, Rotate3d } from "lucide-react"
import { CustomCursor } from "@/components/custom-cursor"
import { StaticStarfield } from "@/components/universe-engine/static-starfield"
import { BODIES } from "@/lib/celestial-data"

const UniverseEngine = dynamic(
  () => import("@/components/universe-engine").then((m) => m.UniverseEngine),
  { ssr: false, loading: () => <StaticStarfield /> },
)
const GlobeViewer = dynamic(
  () => import("./globe-viewer").then((m) => m.GlobeViewer),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
        Loading 3D…
      </div>
    ),
  },
)

// Bodies the Universe Engine can fly the camera to (its planet/sun focus
// channel keys on these exact names). Moon/asteroid/comet aren't planet-focusable.
const ENGINE_FOCUSABLE = new Set([
  "Sun", "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
])

export function CelestialExplorer() {
  const [openName, setOpenName] = useState<string | null>(null)
  const open = BODIES.find((b) => b.name === openName) ?? null

  // Pick a body: open its detail tile AND fly the engine camera to it (so
  // distant bodies like Pluto are actually findable at true scale, not just a
  // far speck). Reuses the engine's focus channel — same event the Destinations
  // menu fires.
  function pick(name: string) {
    const next = name === openName ? null : name
    setOpenName(next)
    if (next && ENGINE_FOCUSABLE.has(next)) {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: `planet:${next}` } }),
      )
    }
  }

  // Auto-warp to Earth once the engine has mounted. At true scale the system
  // opens into mostly-empty space with a tiny distant Sun — framing Earth gives
  // an immediate, legible "you are here" rather than a blank starfield. Reuses
  // the engine's existing focus channel (same event the Destinations menu fires).
  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }),
      )
    }, 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <CustomCursor />
      <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
        {/* Live solar system fills the screen. touch-none hands all touch
            gestures to the engine's OrbitControls (the page is fixed/non-scroll
            here) so drag-to-rotate + pinch-zoom are seamless on mobile. */}
        <div className="absolute inset-0 touch-none">
          <UniverseEngine interactive showHud showMusic={false} defaultTrueScale solarOnly />
        </div>

        {/* Back link */}
        <Link
          href="/#lab"
          data-cursor-hover
          className="absolute top-4 left-4 md:top-6 md:left-6 z-30 group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/75 hover:text-foreground bg-background/40 backdrop-blur-sm border border-border rounded-full px-3 py-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          The Lab
        </Link>

        {/* Title tile */}
        <div className="absolute top-16 left-4 md:top-20 md:left-6 z-20 max-w-[18rem] pointer-events-none">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-2">
            Celestial
          </p>
          <h1 className="font-display text-2xl md:text-4xl font-light tracking-[-0.02em] leading-[1.05]">
            Explore the <span className="italic">solar system</span>.
          </h1>
          <p className="mt-2 font-sans text-xs md:text-sm text-foreground/70 leading-relaxed">
            Shown at <span className="text-accent">true scale</span> — real
            distance ratios. Focus Earth and scrub the timeline back to{" "}
            <span className="text-accent">1957</span> to watch satellites launch
            into orbit as the space age unfolds.
          </p>
        </div>

        {/* Body rail.
            DESKTOP: vertical strip on the RIGHT edge, vertically centred — the
            engine's HUD lives along the bottom (timeline centre, reset/info
            left, music/legend right-bottom) and top-centre (explore badge), so
            the right-middle edge is the one clear band. The detail tile (z-30)
            slides over it from the right when a body is open.
            MOBILE: a horizontal strip pinned just ABOVE the engine's bottom HUD
            band, clear of the top-centre badge; hidden while a tile is open. */}
        <div
          className={`absolute z-20 pointer-events-none
            left-0 right-0 bottom-32 px-3
            md:left-auto md:right-2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:px-0
            ${open ? "hidden md:hidden" : ""}`}
        >
          <div className="pointer-events-auto w-fit max-w-full mx-auto md:mx-0 md:max-h-[64vh] overflow-x-auto md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex md:flex-col items-center gap-2.5 md:gap-3 min-w-max md:min-w-0 py-1 md:px-1">
              {BODIES.map((b) => {
                // Min 44px touch target (mobile-first); larger bodies a touch bigger.
                const px = Math.max(44, 40 + (b.relSize ?? 0.6) * 16)
                const on = b.name === openName
                return (
                  <li key={b.name} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => pick(b.name)}
                      data-cursor-hover
                      title={b.name}
                      aria-pressed={on}
                      aria-label={`Show ${b.name} details`}
                      className="group flex md:flex-row-reverse flex-col items-center gap-1 md:gap-2.5 focus-visible:outline-none"
                    >
                      <span
                        className="rounded-full overflow-hidden border-2 transition-all duration-300 group-hover:scale-110 shrink-0"
                        style={{
                          width: px, height: px,
                          borderColor: on ? "var(--accent)" : "rgba(255,255,255,0.15)",
                          boxShadow: on ? `0 0 18px -2px ${b.accent}` : "none",
                        }}
                      >
                        <img src={b.img} alt="" aria-hidden loading="lazy"
                             className="w-full h-full object-cover" style={{ background: b.accent }} />
                      </span>
                      <span className={`font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors ${on ? "text-accent" : "text-foreground/80 group-hover:text-foreground"}`}>
                        {b.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Detail tile — slides in from the right when a body is picked */}
        <AnimatePresence>
          {open && (
            <motion.aside
              key={open.name}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute z-40 top-4 right-4 bottom-32 md:top-6 md:right-6 md:bottom-32 w-[calc(100%-2rem)] sm:w-[24rem] md:w-[26rem] overflow-y-auto rounded-xl border border-border bg-background/90 backdrop-blur-md shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)]"
            >
              <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-background/80 backdrop-blur">
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-accent">{open.tagline}</p>
                <button type="button" onClick={() => setOpenName(null)} data-cursor-hover aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-secondary/20 mb-4">
                  <GlobeViewer src={open.glb} />
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase text-foreground/70 bg-background/50 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <Rotate3d className="h-3 w-3 text-accent" /> Drag · zoom
                  </span>
                </div>

                <h2 className="font-display text-3xl font-light tracking-[-0.01em] mb-3">{open.name}</h2>
                <p className="font-sans text-sm text-foreground/80 leading-relaxed mb-5">{open.blurb}</p>

                <dl className="grid grid-cols-2 gap-px bg-border border border-border rounded-md overflow-hidden mb-5">
                  {open.facts.map((f) => (
                    <div key={f.label} className="bg-background p-3">
                      <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-0.5">{f.label}</dt>
                      <dd className="font-sans text-sm text-foreground tabular-nums">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                <ul className="space-y-2.5">
                  {open.features.map((feat) => (
                    <li key={feat.name} className="grid grid-cols-[auto_1fr] gap-2.5">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: open.accent }} />
                      <p className="font-sans text-sm text-foreground/80 leading-relaxed">
                        <span className="text-foreground">{feat.name}.</span> {feat.note}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </>
  )
}
