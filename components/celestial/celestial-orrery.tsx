"use client"

/**
 * CelestialOrrery — presents the bodies as an orbital rail rather than a long
 * list. A glowing track threads through every body from the Sun outward; each
 * body is a tappable node sized by `relSize`. Selecting one brings it into a
 * focus panel with its interactive 3D viewer + data.
 *
 * Mobile-first: the rail scrolls horizontally on small screens; the focus panel
 * stacks below.
 */

import { useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { Rotate3d } from "lucide-react"
import type { CelestialBody } from "@/lib/celestial-data"

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

export function CelestialOrrery({ bodies }: { bodies: CelestialBody[] }) {
  const [activeName, setActiveName] = useState(bodies[0]?.name)
  const [live, setLive] = useState(false)
  const active = bodies.find((b) => b.name === activeName) ?? bodies[0]

  function select(name: string) {
    setActiveName(name)
    setLive(false) // reset to poster when switching bodies
  }

  return (
    <div>
      {/* ----- Orbital rail ----- */}
      <div className="relative -mx-6 md:mx-0 mb-12 md:mb-16">
        <div className="overflow-x-auto px-6 md:px-2 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="relative min-w-max md:min-w-0 md:w-full">
            {/* the track line */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent) 12%, var(--accent) 88%, transparent)",
                opacity: 0.4,
              }}
            />
            <ul className="relative flex items-center gap-5 md:gap-2 md:justify-between py-6">
              {bodies.map((b) => {
                const on = b.name === active?.name
                const px = 18 + (b.relSize ?? 0.8) * 30 // node diameter
                return (
                  <li key={b.name} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => select(b.name)}
                      data-cursor-hover
                      aria-pressed={on}
                      title={b.name}
                      className="group flex flex-col items-center gap-2 focus-visible:outline-none"
                    >
                      <span
                        className="relative grid place-items-center rounded-full transition-transform duration-300 group-hover:scale-110"
                        style={{ width: px, height: px }}
                      >
                        {on && (
                          <motion.span
                            layoutId="orrery-halo"
                            className="absolute -inset-2 rounded-full"
                            style={{ boxShadow: `0 0 0 1px var(--accent), 0 0 22px -2px ${b.accent}` }}
                          />
                        )}
                        <img
                          src={b.img}
                          alt={b.name}
                          loading="lazy"
                          className="w-full h-full rounded-full object-cover"
                          style={{ background: b.accent }}
                        />
                      </span>
                      <span
                        className={`font-mono text-[9px] md:text-[10px] tracking-widest uppercase transition-colors ${
                          on ? "text-accent" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {b.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* ----- Focused detail ----- */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.section
            key={active.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            aria-labelledby={`${active.name}-heading`}
            className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
          >
            {/* Render / 3D */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-3xl opacity-25"
                style={{ background: `radial-gradient(circle, ${active.accent}, transparent 70%)` }}
              />
              <div className="relative aspect-square w-full max-w-[520px] mx-auto">
                {live ? (
                  <div className="absolute inset-0 rounded-lg overflow-hidden">
                    <GlobeViewer src={active.glb} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLive(true)}
                    data-cursor-hover
                    aria-label={`View ${active.name} in interactive 3D`}
                    className="group absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                  >
                    <img
                      src={active.img}
                      alt={`Photoreal ${active.name} rendered in Blender`}
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border border-foreground/25 bg-background/60 backdrop-blur-sm px-4 py-2 min-h-9 font-mono text-[10px] tracking-[0.2em] uppercase text-foreground/85 group-hover:text-foreground group-hover:border-accent/60 transition-colors">
                      <Rotate3d className="h-3.5 w-3.5 text-accent" aria-hidden />
                      View in 3D
                    </span>
                  </button>
                )}
              </div>
              <p className="relative mt-3 text-center font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                {live ? "Drag to rotate · scroll to zoom" : "Blender render · NASA/USGS data"}
              </p>
            </div>

            {/* Data */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-3">
                {active.tagline}
              </p>
              <h2
                id={`${active.name}-heading`}
                className="font-display text-3xl md:text-5xl font-light tracking-[-0.01em] mb-5"
              >
                {active.name}
              </h2>
              <p className="font-sans text-base md:text-lg text-foreground/80 leading-relaxed mb-8">
                {active.blurb}
              </p>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden mb-8">
                {active.facts.map((f) => (
                  <div key={f.label} className="bg-background p-3.5">
                    <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1">
                      {f.label}
                    </dt>
                    <dd className="font-sans text-sm text-foreground tabular-nums">{f.value}</dd>
                  </div>
                ))}
              </dl>

              <ul className="space-y-3">
                {active.features.map((feat) => (
                  <li key={feat.name} className="grid grid-cols-[auto_1fr] gap-3">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: active.accent }}
                    />
                    <p className="font-sans text-sm md:text-base text-foreground/80 leading-relaxed">
                      <span className="text-foreground">{feat.name}.</span> {feat.note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
