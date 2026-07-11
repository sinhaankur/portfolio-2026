"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * PassPlanner — a ground-station pass planner for the ISS.
 *
 * The ground↔space link, made legible: pick a real tracking station and read
 * exactly when the ISS rises, peaks, and sets over that dish — AOS / MAX / LOS,
 * azimuth + elevation, and pass duration — the way a station schedules a
 * contact. Everything is real: live TLE from CelesTrak, propagated with SGP4,
 * turned into topocentric look-angles.
 *
 * Pure logic lives in lib/ground-station.ts + lib/sat-passes.ts; this is just
 * the operator-facing panel over it.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Radio, X, ArrowUp } from "lucide-react"
import { GROUND_STATIONS, stationById } from "@/lib/ground-station"
import { computePasses, azToCompass, fetchIssTle, type SatPass } from "@/lib/sat-passes"

/** hh:mm:ss in the viewer's local time — how an operator reads a schedule. */
function clock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}
function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${String(s).padStart(2, "0")}s`
}

export function PassPlanner({ onClose }: { onClose?: () => void }) {
  const [stationId, setStationId] = useState(GROUND_STATIONS[0].id)
  const station = useMemo(() => stationById(stationId), [stationId])
  const [tle, setTle] = useState<[string, string] | null>(null)
  const [passes, setPasses] = useState<SatPass[] | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch the ISS's live orbital elements once.
  useEffect(() => {
    let alive = true
    fetchIssTle().then((t) => { if (alive) setTle(t) })
    return () => { alive = false }
  }, [])

  // Recompute passes whenever the station (or TLE) changes.
  useEffect(() => {
    if (!tle) return
    let alive = true
    setLoading(true)
    computePasses(tle, station, { hours: 48, maxPasses: 5 })
      .then((p) => { if (alive) { setPasses(p); setLoading(false) } })
      .catch(() => { if (alive) { setPasses([]); setLoading(false) } })
    return () => { alive = false }
  }, [tle, station])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#7affd0]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7affd0]">
          <Radio className="h-3.5 w-3.5" /> ISS pass planner
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Station picker — the "from THIS dish" control. */}
        <label className="block">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Ground station</span>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-border bg-background/80 px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7affd0]"
          >
            {GROUND_STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.agency}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {station.note}{" "}
          <span className="whitespace-nowrap font-mono text-[11px] text-foreground/70">
            {Math.abs(station.latDeg).toFixed(2)}°{station.latDeg >= 0 ? "N" : "S"},{" "}
            {Math.abs(station.lonDeg).toFixed(2)}°{station.lonDeg >= 0 ? "E" : "W"}
          </span>
        </p>

        {/* Pass schedule — the operator's read: AOS / MAX / LOS. */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
              Next ISS passes · 48h
            </span>
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#7affd0]/70">
              live TLE · SGP4
            </span>
          </div>

          {loading && (
            <p className="mt-3 text-[13px] text-muted-foreground">Propagating orbit…</p>
          )}

          {!loading && passes && passes.length === 0 && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              No passes above 10° in the next 48 hours from this station.
            </p>
          )}

          {!loading && passes && passes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2.5">
              {passes.map((p, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-foreground/80">
                      {dayLabel(p.peak)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-foreground/70">
                      <ArrowUp className="h-3 w-3 text-[#7affd0]" />
                      max el {Math.round(p.peakElevationDeg)}°
                      {p.visible && (
                        <span
                          className="ml-1 rounded-sm bg-[#7affd0]/15 px-1 text-[9px] uppercase tracking-wide text-[#7affd0]"
                          title="Sunlit satellite + dark sky — visible to the naked eye"
                        >
                          visible
                        </span>
                      )}
                    </span>
                  </div>

                  {/* AOS / MAX / LOS row — acquisition, peak, loss of signal. */}
                  <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
                    <PassMoment tag="AOS" time={clock(p.start)} az={p.startAzDeg} />
                    <PassMoment tag="MAX" time={clock(p.peak)} az={p.peakAzDeg} el={p.peakElevationDeg} />
                    <PassMoment tag="LOS" time={clock(p.end)} az={p.endAzDeg} />
                  </div>

                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    contact window {mmss(p.durationSec)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
          AOS/LOS = the satellite crossing this station&apos;s horizon; MAX = highest
          point in the sky. Azimuths are compass bearings to point the antenna.
          Elements from CelesTrak, propagated with SGP4 — the same model NORAD publishes.
        </p>
      </div>
    </motion.div>
  )
}

/** One column of the AOS/MAX/LOS row — time + antenna pointing (az, optional el). */
function PassMoment({ tag, time, az, el }: { tag: string; time: string; az: number; el?: number }) {
  return (
    <div className="bg-background/80 px-2.5 py-2">
      <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-[#7affd0]/80">{tag}</div>
      <div className="mt-0.5 font-mono text-[12px] tabular-nums text-foreground">{time}</div>
      <div className="font-mono text-[10px] text-muted-foreground">
        az {Math.round(az)}° {azToCompass(az)}
        {el != null && <> · el {Math.round(el)}°</>}
      </div>
    </div>
  )
}
