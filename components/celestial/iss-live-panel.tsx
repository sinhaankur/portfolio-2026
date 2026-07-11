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

export function IssLivePanel({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<IssState | null>(null)
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading")
  const trackerRef = useRef<{ stateAt: (d?: Date) => IssState | null } | null>(null)

  useEffect(() => {
    let alive = true
    let raf = 0
    let interval: ReturnType<typeof setInterval> | null = null

    ;(async () => {
      try {
        const tle = await fetchIssTle()
        const tracker = await createIssTracker(tle)
        if (!alive) return
        trackerRef.current = tracker
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
      cancelAnimationFrame(raf)
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
          Sub-satellite point computed locally from the ISS&apos;s live NORAD
          elements (CelesTrak) with SGP4 — the spot on Earth it&apos;s directly
          above. Orbital speed is |v|, not ground-track speed. Region is a coarse,
          offline approximation.
        </p>
      </div>
    </motion.div>
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
