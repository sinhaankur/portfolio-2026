"use client"

/**
 * SpaceWeatherPanel — live geomagnetic conditions + aurora likelihood for the
 * user's location, from NOAA SWPC (real, no key). Ties to the aurora the engine
 * already renders on Earth: "the real Earth's aurora is doing X right now, and
 * here's whether you could see it tonight."
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, X, MapPin } from "lucide-react"
import { fetchSpaceWeather, kpLabel, auroraCall, type SpaceWeather } from "@/lib/space-weather"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; sw: SpaceWeather; userLat: number | null }

export function SpaceWeatherPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let alive = true
    // fetch weather + (optionally) the user's latitude in parallel
    const latP = new Promise<number | null>((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p.coords.latitude),
        () => resolve(null),
        { timeout: 8000, maximumAge: 600000 },
      )
    })
    Promise.all([fetchSpaceWeather(), latP]).then(([sw, userLat]) => {
      if (!alive) return
      if (!sw) { setState({ kind: "error" }); return }
      setState({ kind: "done", sw, userLat })
    })
    return () => { alive = false }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-[#7affd0]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7affd0]">
          <Sparkles className="h-3.5 w-3.5" /> Space weather · live
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && <p className="font-sans text-sm text-muted-foreground">Reading NOAA SWPC…</p>}
        {state.kind === "error" && <p className="font-sans text-sm text-muted-foreground">Couldn&apos;t reach NOAA right now.</p>}
        {state.kind === "done" && (() => {
          const { sw, userLat } = state
          const call = userLat != null ? auroraCall(userLat, sw.auroraMinLatDeg) : null
          const callColor = call === "likely" ? "text-[#7affd0]" : call === "possible" ? "text-[#ffd27a]" : "text-muted-foreground"
          return (
            <div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 font-sans text-sm">
                <div>
                  <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">Kp index</dt>
                  <dd className="text-foreground tabular-nums">{sw.kp} <span className="text-muted-foreground text-xs">· {kpLabel(sw.kp)}</span></dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">Solar wind</dt>
                  <dd className="text-foreground tabular-nums">{sw.windSpeedKms != null ? `${sw.windSpeedKms} km/s` : "—"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">IMF Bz</dt>
                  <dd className="text-foreground tabular-nums">
                    {sw.bz != null ? `${sw.bz} nT` : "—"}
                    {sw.bz != null && sw.bz < 0 && <span className="text-[#7affd0] text-xs"> · south (good)</span>}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">Aurora oval</dt>
                  <dd className="text-foreground tabular-nums">≥ {sw.auroraMinLatDeg}° lat</dd>
                </div>
              </dl>

              <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
                {call ? (
                  <p className="font-sans text-sm leading-relaxed">
                    <span className={`font-mono text-[10px] tracking-widest uppercase ${callColor}`}>
                      Aurora {call === "no" ? "not visible" : call} for you
                    </span>
                    <br />
                    <span className="text-foreground/80 text-[13px]">
                      {call === "likely"
                        ? "You're inside the auroral oval tonight — dark skies away from city light give you a real shot."
                        : call === "possible"
                        ? "You're near the oval's edge — a strong burst could push it to you. Worth a look north."
                        : `The oval reaches ${sw.auroraMinLatDeg}° tonight; you're too far south to see it this time.`}
                    </span>
                  </p>
                ) : (
                  <p className="font-sans text-[13px] text-foreground/80 leading-relaxed">
                    Aurora is visible above ~{sw.auroraMinLatDeg}° geomagnetic latitude right now. Enable location for a personal call.
                  </p>
                )}
              </div>

              <p className="mt-3 flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-muted-foreground/70">
                <MapPin className="h-3 w-3" /> Live from NOAA SWPC · Kp {new Date(sw.kpTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          )
        })()}
      </div>
    </motion.div>
  )
}
