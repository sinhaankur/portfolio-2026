"use client"

/**
 * DiscoveriesPanel — "what's being discovered" walkthrough for the Universe
 * Engine. Pulls real, recent imagery + captions from NASA's public Image and
 * Video Library (images-api.nasa.gov, keyless + CORS-open) across a few science
 * topics (new discoveries, exoplanets, black holes, galaxies, Webb/Hubble), so a
 * visitor can browse what NASA is actually finding — each item real, dated, and
 * credited. Matches the ImageryPanel style. Fails soft when offline / rate-limited.
 *
 * With thanks to NASA for its free, open data. https://github.com/sinhaankur/portfolio-2026
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, X, ExternalLink } from "lucide-react"
import { searchNasaMedia, type NasaMedia } from "@/lib/nasa-feeds"

// Topics the walkthrough can browse — each a real NASA-library search.
const TOPICS = [
  { id: "discovery", label: "New finds", query: "discovery" },
  { id: "webb", label: "Webb", query: "James Webb Space Telescope" },
  { id: "exoplanet", label: "Exoplanets", query: "exoplanet" },
  { id: "blackhole", label: "Black holes", query: "black hole" },
  { id: "galaxy", label: "Galaxies", query: "galaxy" },
  { id: "mars", label: "Mars", query: "Mars Perseverance" },
] as const

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; items: NasaMedia[] }

export function DiscoveriesPanel({ onClose }: { onClose: () => void }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"]>("discovery")
  const [state, setState] = useState<State>({ kind: "loading" })
  const [selected, setSelected] = useState<NasaMedia | null>(null)

  useEffect(() => {
    let alive = true
    setState({ kind: "loading" })
    const q = TOPICS.find((t) => t.id === topic)?.query ?? "discovery"
    searchNasaMedia(q, 24).then((items) => {
      if (!alive) return
      if (!items.length) { setState({ kind: "error" }); return }
      setState({ kind: "done", items })
      setSelected(items[0])
    })
    return () => { alive = false }
  }, [topic])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[78vh] overflow-y-auto rounded-xl border border-[#ffca8a]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ffca8a]">
          <Sparkles className="h-3.5 w-3.5" /> What&apos;s being discovered
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* topic chips */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTopic(t.id)}
            className={`font-mono text-[10px] tracking-wider uppercase rounded-full px-2.5 py-1 border transition-colors ${
              topic === t.id
                ? "border-[#ffca8a] bg-[#ffca8a]/15 text-[#ffca8a]"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {state.kind === "loading" && (
          <p className="font-sans text-sm text-muted-foreground">Searching NASA&apos;s library…</p>
        )}
        {state.kind === "error" && (
          <p className="font-sans text-sm text-muted-foreground">
            Feed unavailable (rate-limited or offline). Try another topic.
          </p>
        )}

        {state.kind === "done" && selected && (
          <div className="space-y-3">
            {/* featured */}
            <div className="overflow-hidden rounded-lg border border-border bg-background/60">
              {selected.thumb && (
                <img src={selected.thumb} alt={selected.title} loading="lazy" className="w-full object-cover max-h-64" />
              )}
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg leading-tight text-foreground">{selected.title}</h3>
                {selected.dateCreated && (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
                    {selected.dateCreated.slice(0, 10)}
                  </span>
                )}
              </div>
              {selected.center && (
                <p className="mt-0.5 font-mono text-[9px] tracking-wider text-muted-foreground">NASA · {selected.center}</p>
              )}
              {selected.description && (
                <p className="mt-2 font-sans text-[13px] leading-relaxed text-foreground/80 line-clamp-6">
                  {selected.description}
                </p>
              )}
              <a
                href={`https://images.nasa.gov/details/${selected.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-[#ffca8a] hover:underline"
              >
                View on NASA <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* thumbnail grid to browse */}
            <div className="grid grid-cols-4 gap-2">
              {state.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelected(it)}
                  aria-label={it.title}
                  className={`overflow-hidden rounded-md border ${selected.id === it.id ? "border-[#ffca8a]" : "border-border"} transition-colors`}
                >
                  {it.thumb && <img src={it.thumb} alt={it.title} loading="lazy" className="h-12 w-full object-cover" />}
                </button>
              ))}
            </div>

            <p className="font-mono text-[9px] text-muted-foreground/70">
              Source: NASA Image &amp; Video Library — with thanks to NASA for its open data.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
