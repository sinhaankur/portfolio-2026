"use client"

/**
 * BodyRender — shows a celestial body's still render as a poster, with a
 * "View in 3D" affordance that swaps in the interactive <GlobeViewer> on demand.
 *
 * The R3F viewer (Three.js) is heavy, so we don't mount it for every body on the
 * page at once — it loads only when the visitor chooses to interact, keeping the
 * page light by default. Mirrors the Universe Engine's lazy-on-intent pattern.
 */

import { useState } from "react"
import dynamic from "next/dynamic"
import { Rotate3d } from "lucide-react"

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

export function BodyRender({
  poster,
  glb,
  name,
  accent,
}: {
  poster: string
  glb: string
  name: string
  accent: string
}) {
  const [live, setLive] = useState(false)

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-3xl opacity-25"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />

      <div className="relative aspect-square w-full max-w-[520px] mx-auto">
        {live ? (
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <GlobeViewer src={glb} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLive(true)}
            data-cursor-hover
            aria-label={`View ${name} in interactive 3D`}
            className="group absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-lg"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt={`Photoreal ${name} globe rendered in Blender`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
            />
            <span
              className="
                absolute bottom-3 left-1/2 -translate-x-1/2
                inline-flex items-center gap-2
                rounded-full border border-foreground/25 bg-background/60 backdrop-blur-sm
                px-4 py-2 min-h-9
                font-mono text-[10px] tracking-[0.2em] uppercase
                text-foreground/85 group-hover:text-foreground group-hover:border-accent/60
                transition-colors
              "
            >
              <Rotate3d className="h-3.5 w-3.5 text-accent" aria-hidden />
              View in 3D
            </span>
          </button>
        )}
      </div>

      <p className="relative mt-3 text-center font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
        {live ? "Drag to rotate · scroll to zoom" : "Blender render · NASA/USGS surface map"}
      </p>
    </div>
  )
}
