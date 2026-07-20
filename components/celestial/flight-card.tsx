"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * FlightCard — click a plane in the deep-zoom view and read its real flight:
 * callsign, altitude, ground speed, heading, origin country. Data is the baked
 * OpenSky snapshot (see flight-field.tsx) — real aircraft, honestly labelled as
 * a deploy-time snapshot rather than a live feed.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plane, X } from "lucide-react"
import { selectedFlightRef, flightSnapshotRef, type Flight } from "@/components/universe-engine/flight-field"

function compass(hdg: number | null): string {
  if (hdg == null) return "—"
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(hdg / 45) % 8]
}

function snapshotAgo(iso: string | null): string {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

export function FlightCard() {
  const [flight, setFlight] = useState<Flight | null>(null)

  useEffect(() => {
    const onSel = (e: Event) => setFlight((e as CustomEvent<Flight>).detail)
    window.addEventListener("universe:flight-selected", onSel)
    return () => window.removeEventListener("universe:flight-selected", onSel)
  }, [])

  const close = () => { setFlight(null); selectedFlightRef.current = null }

  return (
    <AnimatePresence>
      {flight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[#ffcf6b]/40 bg-background/90 backdrop-blur-md p-4 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ffcf6b]">
              <Plane className="h-3.5 w-3.5" /> Flight
            </p>
            <button type="button" onClick={close} aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <h3 className="font-display text-xl font-light tracking-[-0.01em] mb-2">
            {flight.call || flight.icao.toUpperCase()}
          </h3>

          <dl className="space-y-1.5 font-sans text-xs">
            {flight.call && (
              <Row label="ICAO24" value={flight.icao.toUpperCase()} mono />
            )}
            <Row label="Origin country" value={flight.country ?? "—"} />
            <Row label="Altitude" value={`${flight.altM.toLocaleString()} m`} mono accent />
            <Row
              label="Ground speed"
              value={flight.velMs != null ? `${flight.velMs} m/s · ${Math.round(flight.velMs * 3.6)} km/h` : "—"}
              mono
            />
            <Row
              label="Heading"
              value={flight.hdg != null ? `${flight.hdg}° ${compass(flight.hdg)}` : "—"}
              mono
            />
            <Row
              label="Position"
              value={`${Math.abs(flight.lat).toFixed(2)}°${flight.lat >= 0 ? "N" : "S"}, ${Math.abs(flight.lon).toFixed(2)}°${flight.lon >= 0 ? "E" : "W"}`}
              mono
            />
          </dl>

          <p className="mt-3 border-t border-border/60 pt-2.5 font-sans text-[10px] leading-relaxed text-muted-foreground">
            Real ADS-B position from the OpenSky Network, baked at deploy time
            {flightSnapshotRef.current ? ` (${snapshotAgo(flightSnapshotRef.current)})` : ""} — a
            snapshot, not a live feed. It marks where the aircraft was, not where it is now.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono tabular-nums" : ""} ${accent ? "text-[#ffcf6b]" : "text-foreground"}`}>{value}</dd>
    </div>
  )
}
