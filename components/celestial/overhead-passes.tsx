"use client"

/**
 * OverheadPasses — "the ISS passes over YOU tonight" panel.
 *
 * Asks for the user's location (with a graceful skip), fetches the live ISS TLE,
 * and computes real visible passes with SGP4 + topocentric look-angles: when it
 * rises, peaks, and sets, which direction, how high, and whether it's actually
 * visible (sunlit sat + dark sky). This is the engine's "restore the sky"
 * mission made personal — real orbital mechanics pointed at the user's horizon.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Satellite, MapPin, X } from "lucide-react"
import { computePasses, fetchIssTle, azToCompass, type SatPass } from "@/lib/sat-passes"

type State =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "computing" }
  | { kind: "done"; passes: SatPass[]; place: string }
  | { kind: "denied" }
  | { kind: "error" }

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
function fmtDay(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tmr = new Date(now.getTime() + 86_400_000)
  const isTmr = d.toDateString() === tmr.toDateString()
  return isToday ? "Tonight" : isTmr ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short" })
}

export function OverheadPasses({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" })

  async function run(latDeg: number, lonDeg: number, place: string) {
    setState({ kind: "computing" })
    try {
      const tle = await fetchIssTle()
      const passes = await computePasses(tle, { latDeg, lonDeg }, { hours: 72, maxPasses: 4 })
      setState({ kind: "done", passes, place })
    } catch {
      setState({ kind: "error" })
    }
  }

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ kind: "error" })
      return
    }
    setState({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        run(latitude, longitude, `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°`)
      },
      () => setState({ kind: "denied" }),
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  // auto-prompt on mount
  useEffect(() => { locate() }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-accent/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-accent">
          <Satellite className="h-3.5 w-3.5" /> ISS over you
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {(state.kind === "locating" || state.kind === "computing") && (
          <p className="font-sans text-sm text-muted-foreground">
            {state.kind === "locating" ? "Finding your location…" : "Computing real passes…"}
          </p>
        )}

        {state.kind === "denied" && (
          <div className="space-y-2">
            <p className="font-sans text-sm text-foreground/80">
              Location off — I can&apos;t point the ISS at your sky without it.
            </p>
            <button type="button" onClick={locate} data-cursor-hover
              className="inline-flex items-center gap-2 rounded-full border border-accent/50 px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-accent hover:border-accent">
              <MapPin className="h-3 w-3" /> Try again
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <p className="font-sans text-sm text-muted-foreground">Couldn&apos;t compute passes right now.</p>
        )}

        {state.kind === "done" && (
          <div>
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {state.place} · next {state.passes.length} passes
            </p>
            {state.passes.length === 0 ? (
              <p className="font-sans text-sm text-muted-foreground">No passes above 10° in the next 3 days.</p>
            ) : (
              <ul className="space-y-2.5">
                {state.passes.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-sans text-sm text-foreground">
                        {fmtDay(p.start)} · <span className="tabular-nums">{fmtTime(p.start)}</span>
                      </span>
                      <span className={`font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm ${p.visible ? "bg-accent/20 text-accent" : "bg-secondary/60 text-muted-foreground"}`}>
                        {p.visible ? "★ visible" : "daylight"}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                      rises {azToCompass(p.startAzDeg)} → peaks {Math.round(p.peakElevationDeg)}° {azToCompass(p.peakAzDeg)} → sets {azToCompass(p.endAzDeg)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                      {Math.round(p.durationSec / 60)} min · {fmtTime(p.start)}–{fmtTime(p.end)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 font-sans text-[10px] text-muted-foreground/70 leading-relaxed">
              ★ visible = the station is sunlit while your sky is dark — go outside, look {state.passes.find((p) => p.visible) ? azToCompass(state.passes.find((p) => p.visible)!.startAzDeg) : "up"}, and you&apos;ll see it cross as a bright, steady moving star. Real SGP4 orbit + your horizon.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
