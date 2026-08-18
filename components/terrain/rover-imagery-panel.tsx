"use client"

/**
 * RoverImageryPanel — the DOM overlay that opens when a live-rover pin is
 * selected. Pulls the rover's most-recent real images from NASA and shows them
 * as a small gallery. Keyless-safe, degrades to a "no live imagery" note on any
 * fetch failure (never blocks the terrain view).
 */

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { fetchLatestRoverPhotos, type RoverPhoto } from "@/lib/terrain/rover-imagery"
import type { RoverSite } from "@/lib/terrain/bodies"

interface Props {
  site: RoverSite
  onClose: () => void
}

export function RoverImageryPanel({ site, onClose }: Props) {
  const [state, setState] = useState<"loading" | "done" | "error" | "none">("loading")
  const [photos, setPhotos] = useState<RoverPhoto[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!site.roverSlug) { setState("none"); return }
    let alive = true
    setState("loading")
    fetchLatestRoverPhotos(site.roverSlug, 12).then((ps) => {
      if (!alive) return
      if (ps.length === 0) { setState("error"); return }
      setPhotos(ps)
      setActive(0)
      setState("done")
    })
    return () => { alive = false }
  }, [site.roverSlug])

  const current = photos[active]

  return (
    <div className="pointer-events-auto fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-white/12 bg-black/85 p-3 backdrop-blur md:left-6 md:right-auto md:w-80">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white">{site.name}</div>
          <div className="text-[11px] text-white/55">
            {site.lat.toFixed(2)}°, {site.lon.toFixed(2)}° · landed {site.year}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
        >
          <X size={16} />
        </button>
      </div>

      <p className="mb-2 text-[11px] leading-snug text-white/70">{site.note}</p>

      {state === "loading" && (
        <div className="flex h-40 items-center justify-center text-[11px] text-white/50">
          Loading live imagery from NASA…
        </div>
      )}
      {state === "none" && (
        <div className="rounded-md bg-white/5 px-3 py-4 text-[11px] text-white/55">
          Historic site — no live rover feed. Marker shows the real landing coordinates.
        </div>
      )}
      {state === "error" && (
        <div className="rounded-md bg-white/5 px-3 py-4 text-[11px] text-white/55">
          NASA imagery feed unavailable right now. The site marker still reflects the real landing point.
        </div>
      )}
      {state === "done" && current && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-white/10">
            <img
              src={current.imgSrc}
              alt={`${current.rover} ${current.cameraFull}`}
              className="max-h-56 w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="text-[10px] font-mono text-white/55">
            {current.rover} · {current.cameraFull} · sol {current.sol} · {current.earthDate}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1}`}
                className={`shrink-0 overflow-hidden rounded border transition-colors ${
                  i === active ? "border-[#7ee0a5]" : "border-white/10"
                }`}
              >
                <img src={p.imgSrc} alt="" loading="lazy" className="h-10 w-14 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
