"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * IssLivePanel — where the ISS is RIGHT NOW, ticking once a second.
 *
 * The live half of the "ground and up" story: the pass planner says when the
 * ISS will be over a station; this says where it is this second — its
 * sub-satellite point (lat/lon), altitude, orbital speed, and a coarse "over
 * what" region. Computed locally from the live TLE via SGP4 (see lib/iss-live.ts),
 * so it needs no per-tick network and stays honest about its provenance.
 */

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Satellite, X } from "lucide-react"
import { fetchIssTle } from "@/lib/sat-passes"
import { createIssTracker, coarseRegion, type IssState } from "@/lib/iss-live"

function fmtLat(d: number): string {
  return `${Math.abs(d).toFixed(2)}° ${d >= 0 ? "N" : "S"}`
}
function fmtLon(d: number): string {
  return `${Math.abs(d).toFixed(2)}° ${d >= 0 ? "E" : "W"}`
}

type Tracker = {
  stateAt: (d?: Date) => IssState | null
  groundTrack: (c?: Date, m?: number, s?: number) => { latDeg: number; lonDeg: number }[]
}

export function IssLivePanel({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<IssState | null>(null)
  const [track, setTrack] = useState<{ latDeg: number; lonDeg: number }[]>([])
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading")
  const trackerRef = useRef<Tracker | null>(null)

  useEffect(() => {
    let alive = true
    let interval: ReturnType<typeof setInterval> | null = null

    ;(async () => {
      try {
        const tle = await fetchIssTle()
        const tracker = (await createIssTracker(tle)) as Tracker
        if (!alive) return
        trackerRef.current = tracker
        // Ground track is a whole-orbit shape — compute it once (recomputed if the
        // panel is reopened). The live dot moves along it each second below.
        setTrack(tracker.groundTrack(new Date()))
        const tick = () => {
          const s = tracker.stateAt(new Date())
          if (s) { setState(s); setStatus("live") }
          else setStatus("error")
        }
        tick()
        // 1 Hz is plenty — SGP4 is cheap and the ISS moves ~7.7 km in that second.
        interval = setInterval(tick, 1000)
      } catch {
        if (alive) setStatus("error")
      }
    })()

    return () => {
      alive = false
      if (interval) clearInterval(interval)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#7affd0]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7affd0]">
          <Satellite className="h-3.5 w-3.5" /> ISS · live position
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {status === "loading" && (
          <p className="text-[13px] text-muted-foreground">Locking on to the station…</p>
        )}
        {status === "error" && (
          <p className="text-[13px] text-muted-foreground">
            Couldn&apos;t reach the ISS elements right now. Try again shortly.
          </p>
        )}
        {status === "live" && state && (
          <>
            {/* The "over what" line — the human-readable headline. */}
            <p className="text-[13px] leading-relaxed text-foreground/85">
              Right now the ISS is over{" "}
              <span className="font-medium text-foreground">
                {coarseRegion(state.latDeg, state.lonDeg)}
              </span>
              .
            </p>

            {/* Ground track — the orbit sweep, with the live dot on it. */}
            {track.length > 1 && <GroundTrackMap track={track} live={state} />}

            {/* The numbers, updating each second. */}
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
              <Stat label="Latitude" value={fmtLat(state.latDeg)} />
              <Stat label="Longitude" value={fmtLon(state.lonDeg)} />
              <Stat label="Altitude" value={state.altKm.toFixed(1)} sub="km" />
              <Stat label="Speed" value={state.speedKms.toFixed(2)} sub="km/s" />
            </dl>

            <div className="mt-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7affd0] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7affd0]" />
              </span>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#7affd0]/80">
                live · updates every second
              </span>
            </div>
          </>
        )}

        <p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
          Sub-satellite point + ground track computed locally from the ISS&apos;s
          live NORAD elements (CelesTrak) with SGP4 — the spot on Earth it&apos;s
          directly above, and the ~92-minute orbit sweep either side of now.
          Orbital speed is |v|, not ground-track speed. Region is a coarse,
          offline approximation.
        </p>
      </div>
    </motion.div>
  )
}

/**
 * GroundTrackMap — the orbit sweep on an equirectangular world map.
 *
 * The classic mission-control view: longitude → x, latitude → y (plate carrée),
 * so the sinuous ground track reads at a glance. The track is split into
 * segments wherever it crosses the ±180° antimeridian, so the wrap doesn't draw
 * a false horizontal streak across the map. A faint lat/lon graticule + equator
 * give it scale; the live dot pulses at the current sub-point.
 */
const MAP_W = 320
const MAP_H = 160
function project(latDeg: number, lonDeg: number): [number, number] {
  const x = ((lonDeg + 180) / 360) * MAP_W
  const y = ((90 - latDeg) / 180) * MAP_H
  return [x, y]
}
function GroundTrackMap({
  track,
  live,
}: {
  track: { latDeg: number; lonDeg: number }[]
  live: { latDeg: number; lonDeg: number } | null
}) {
  // Split the polyline where longitude jumps by >180° (an antimeridian wrap).
  const segments: string[] = []
  let cur: string[] = []
  let prevLon: number | null = null
  for (const p of track) {
    if (prevLon != null && Math.abs(p.lonDeg - prevLon) > 180) {
      if (cur.length > 1) segments.push(cur.join(" "))
      cur = []
    }
    const [x, y] = project(p.latDeg, p.lonDeg)
    cur.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    prevLon = p.lonDeg
  }
  if (cur.length > 1) segments.push(cur.join(" "))

  const dot = live ? project(live.latDeg, live.lonDeg) : null

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="mt-3 w-full rounded-md border border-border bg-black/30"
      role="img"
      aria-label="ISS ground track on a world map"
    >
      {/* graticule */}
      {[-60, -30, 0, 30, 60].map((lat) => {
        const y = ((90 - lat) / 180) * MAP_H
        return (
          <line key={`lat${lat}`} x1={0} y1={y} x2={MAP_W} y2={y}
            stroke="currentColor" strokeWidth={lat === 0 ? 0.8 : 0.4}
            className={lat === 0 ? "text-[#7affd0]/40" : "text-foreground/12"} />
        )
      })}
      {[-120, -60, 0, 60, 120].map((lon) => {
        const x = ((lon + 180) / 360) * MAP_W
        return (
          <line key={`lon${lon}`} x1={x} y1={0} x2={x} y2={MAP_H}
            stroke="currentColor" strokeWidth={0.4} className="text-foreground/12" />
        )
      })}
      {/* ground track segments */}
      {segments.map((pts, i) => (
        <polyline key={i} points={pts} fill="none"
          stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round"
          className="text-[#7affd0]/80" />
      ))}
      {/* live sub-point */}
      {dot && (
        <>
          <circle cx={dot[0]} cy={dot[1]} r={5} className="fill-[#7affd0]/25">
            <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx={dot[0]} cy={dot[1]} r={2.6} className="fill-[#7affd0]" />
        </>
      )}
    </svg>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background/80 px-3 py-2">
      <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] tabular-nums text-foreground">
        {value}
        {sub && <span className="ml-1 text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}
