"use client"

/**
 * ImageryPanel — live astronomy imagery for the Universe Engine, from NASA's
 * Astronomy Picture of the Day (keyless, CORS-open, HTTPS). Today's picture with
 * its real explanation and credit, plus a strip of recent days you can tap
 * through. A live ISS "where it is right now" line rides along the header.
 *
 * Fidelity: real, dated NASA publications with their own credit lines, surfaced
 * as-is. Fails soft when rate-limited or offline.
 *
 * https://github.com/sinhaankur/portfolio-2026
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Image as ImageIcon, X, ExternalLink, Telescope } from "lucide-react"
import { fetchImagery, fetchIssPosition, type ApodItem, type IssFix } from "@/lib/imagery"
import { fetchHubbleLatest, type HubbleImage } from "@/lib/hubble"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; today: ApodItem | null; recent: ApodItem[] }

export function ImageryPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [selected, setSelected] = useState<ApodItem | null>(null)
  const [iss, setIss] = useState<IssFix | null>(null)
  const [hubble, setHubble] = useState<HubbleImage[] | null>(null)

  useEffect(() => {
    let alive = true
    fetchImagery().then((r) => {
      if (!alive) return
      if (!r) { setState({ kind: "error" }); return }
      setState({ kind: "done", today: r.today, recent: r.recent })
      setSelected(r.today ?? r.recent[0] ?? null)
    })
    return () => { alive = false }
  }, [])

  // Latest Hubble images (via the feed-proxy). Optional — omitted if the proxy
  // isn't reachable yet, so the panel is useful with or without it.
  useEffect(() => {
    let alive = true
    fetchHubbleLatest(6).then((r) => { if (alive && r && r.length) setHubble(r) })
    return () => { alive = false }
  }, [])

  // Live ISS fix, refreshed every 5s (feed calc is ~1 Hz; be polite).
  useEffect(() => {
    let alive = true
    const tick = () => fetchIssPosition().then((f) => { if (alive && f) setIss(f) })
    tick()
    const id = setInterval(tick, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const active = selected

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[78vh] overflow-y-auto rounded-xl border border-[#8ab6ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#8ab6ff]">
          <ImageIcon className="h-3.5 w-3.5" /> Sky imagery · live
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && (
          <p className="font-sans text-sm text-muted-foreground">Fetching today's sky…</p>
        )}
        {state.kind === "error" && (
          <p className="font-sans text-sm text-muted-foreground">
            Imagery feed unavailable (rate-limited or offline).
          </p>
        )}

        {state.kind === "done" && active && (
          <div className="space-y-3">
            {/* Featured image */}
            <div className="overflow-hidden rounded-lg border border-border bg-background/60">
              <img
                src={active.url}
                alt={active.title}
                loading="lazy"
                className="w-full object-cover max-h-64"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg leading-tight text-foreground">{active.title}</h3>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">{active.date}</span>
              </div>
              {active.copyright && (
                <p className="mt-0.5 font-mono text-[9px] tracking-wider text-muted-foreground">© {active.copyright}</p>
              )}
              <p className="mt-2 font-sans text-[13px] leading-relaxed text-foreground/80 line-clamp-6">
                {active.explanation}
              </p>
              <a
                href={active.hdurl ?? active.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-[#8ab6ff] hover:underline"
              >
                View full resolution <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Recent strip */}
            {state.recent.length > 0 && (
              <div>
                <p className="mb-1.5 font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Recent</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {state.recent.map((it) => (
                    <button
                      key={it.date}
                      type="button"
                      onClick={() => setSelected(it)}
                      aria-label={it.title}
                      className={`shrink-0 overflow-hidden rounded-md border ${active.date === it.date ? "border-[#8ab6ff]" : "border-border"} transition-colors`}
                    >
                      <img src={it.url} alt={it.title} loading="lazy" className="h-12 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Latest from Hubble (via feed-proxy) */}
            {hubble && hubble.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.2em] uppercase text-[#c8b6ff]">
                  <Telescope className="h-3 w-3" /> Latest from Hubble
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {hubble.map((h) => (
                    <a
                      key={h.id}
                      href={h.full}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={h.title}
                      className="shrink-0 overflow-hidden rounded-md border border-border hover:border-[#c8b6ff] transition-colors"
                    >
                      <img src={h.thumb} alt={h.title} loading="lazy" className="h-14 w-20 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Live ISS line */}
            {iss && (
              <div className="rounded-lg border border-border bg-background/60 p-2.5">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#5affc0] mb-1">ISS · right now</p>
                <p className="font-mono text-[11px] tabular-nums text-foreground/80">
                  {iss.lat.toFixed(2)}°, {iss.lon.toFixed(2)}° · {Math.round(iss.altKm)} km · {iss.velKms.toFixed(1)} km/s
                </p>
              </div>
            )}

            <p className="font-mono text-[9px] text-muted-foreground/70">
              Sources: NASA APOD{hubble ? " · HubbleSite" : ""} · ISS: wheretheiss.at
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
