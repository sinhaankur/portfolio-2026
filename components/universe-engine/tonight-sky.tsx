"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 *
 * TonightSky — the "what am I looking at tonight?" sky companion.
 *
 * The engine already draws the real sky; this answers the beginner's actual
 * question: *I'm standing outside right now — what's up there, and where do
 * I look?* Given the user's location (opt-in, never auto-requested), it runs
 * the same equatorial→horizontal transform an observatory's pointing computer
 * uses (lib/sky-position.ts, Meeus) to report which constellations are above
 * the horizon this instant, their altitude, compass bearing, and tonight's
 * rise/transit/set times. Real geometry, no invented data.
 *
 * Selecting a row highlights that asterism in the sky via the
 * `universe:highlight-constellation` event (the constellations layer listens).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { constellations } from "./astronomy"
import type { Constellation, ConstellationId } from "./types"
import {
  altitudeBand,
  centroidRaDec,
  compassPoint,
  equatorialToHorizontal,
  riseTransitSet,
  type EquatorialCoord,
  type Observer,
} from "@/lib/sky-position"

interface SkyRow {
  id: ConstellationId
  name: string
  designation: string
  fact: string
  coord: EquatorialCoord
  altitudeDeg: number
  azimuthDeg: number
  compass: string
  band: ReturnType<typeof altitudeBand>
}

/** Only the named, recognisable constellations make good "look up" targets —
 *  skip the faint IAU filler that carries no fact so the list stays legible. */
function targetConstellations(): Constellation[] {
  return constellations.filter(
    (c) => c.stars.length > 0 && c.fact && c.clickAction !== "reset-view",
  )
}

const BAND_LABEL: Record<ReturnType<typeof altitudeBand>, string> = {
  below: "below horizon",
  low: "low",
  mid: "mid-sky",
  high: "high",
  overhead: "near overhead",
}

/** Short local time like "9:48 PM", or "—" when the body doesn't rise/set. */
function fmtTime(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function TonightSky() {
  const [open, setOpen] = useState(false)
  const [observer, setObserver] = useState<Observer | null>(null)
  const [locState, setLocState] = useState<"idle" | "asking" | "denied" | "unavailable">("idle")
  const [expandedId, setExpandedId] = useState<ConstellationId | null>(null)
  // Tick drives the live recompute so altitudes update as the sky turns.
  const [tick, setTick] = useState(0)

  const targets = useMemo(() => targetConstellations(), [])
  // Constellation centroids are fixed (J2000) — compute once, reuse each tick.
  const centroids = useMemo(
    () => targets.map((c) => ({ c, coord: centroidRaDec(c.stars) })),
    [targets],
  )

  // Recompute the sky ~every 20s while open + located (it drifts ~0.25°/min).
  useEffect(() => {
    if (!open || !observer) return
    const id = setInterval(() => setTick((t) => t + 1), 20_000)
    return () => clearInterval(id)
  }, [open, observer])

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocState("unavailable")
      return
    }
    setLocState("asking")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObserver({ latDeg: pos.coords.latitude, lonDeg: pos.coords.longitude })
        setLocState("idle")
      },
      () => setLocState("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  // Build + sort the live list: above-horizon first, by descending altitude.
  const rows = useMemo<SkyRow[]>(() => {
    if (!observer) return []
    const now = new Date()
    const out: SkyRow[] = centroids.map(({ c, coord }) => {
      const h = equatorialToHorizontal(coord, observer, now)
      return {
        id: c.id,
        name: c.name,
        designation: c.designation,
        fact: c.fact,
        coord,
        altitudeDeg: h.altitudeDeg,
        azimuthDeg: h.azimuthDeg,
        compass: compassPoint(h.azimuthDeg),
        band: altitudeBand(h.altitudeDeg),
      }
    })
    out.sort((a, b) => b.altitudeDeg - a.altitudeDeg)
    return out
    // `tick` is the recompute trigger: the 20s interval bumps it so the live
    // Date() read above re-runs and altitudes track the turning sky.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observer, centroids, tick])

  const upNow = rows.filter((r) => r.altitudeDeg > 0)

  const highlight = useCallback((id: ConstellationId | null) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("universe:highlight-constellation", { detail: { id } }),
    )
  }, [])

  // Clear any highlight when the panel closes so the sky doesn't stay lit.
  const prevOpen = useRef(open)
  useEffect(() => {
    if (prevOpen.current && !open) highlight(null)
    prevOpen.current = open
  }, [open, highlight])

  const toggleRow = (r: SkyRow) => {
    const next = expandedId === r.id ? null : r.id
    setExpandedId(next)
    highlight(next)
  }

  return (
    <div className="pointer-events-auto">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="
            inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border
            border-foreground/25 bg-background/50 text-foreground/75
            hover:text-foreground hover:border-accent/60
            backdrop-blur-sm transition-colors duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          <span aria-hidden className="text-[11px] leading-none">✧</span>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Tonight</span>
        </button>
      ) : (
        <div
          className="
            w-[min(88vw,20rem)] max-h-[62vh] overflow-hidden flex flex-col
            rounded-2xl border border-foreground/20 bg-background/80 backdrop-blur-md
            shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]
          "
          role="group"
          aria-label="Tonight's sky"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-foreground/12">
            <div>
              <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-accent">Tonight's sky</p>
              <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-foreground/45">
                {observer
                  ? `${upNow.length} up now · ${observer.latDeg.toFixed(1)}°, ${observer.lonDeg.toFixed(1)}°`
                  : "above your horizon, right now"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close tonight's sky"
              className="grid h-7 w-7 place-items-center rounded-full text-foreground/55 hover:text-foreground hover:bg-foreground/10 transition-colors shrink-0"
            >
              <span aria-hidden className="text-sm leading-none">×</span>
            </button>
          </div>

          {/* Body */}
          {!observer ? (
            <div className="px-4 py-5 flex flex-col gap-3">
              <p className="font-sans text-[12px] leading-relaxed text-foreground/70">
                Share your location and I&apos;ll compute exactly which constellations
                are above your horizon this second — altitude, compass bearing, and
                tonight&apos;s rise &amp; set times. The same math a telescope mount runs.
              </p>
              <button
                type="button"
                onClick={requestLocation}
                disabled={locState === "asking"}
                className="
                  self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-full border
                  border-accent/60 bg-accent/10 text-accent
                  hover:bg-accent/15 transition-colors
                  disabled:opacity-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                "
              >
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase">
                  {locState === "asking" ? "Locating…" : "Use my location"}
                </span>
              </button>
              {locState === "denied" && (
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/45">
                  Location denied — enable it in your browser to see your sky.
                </p>
              )}
              {locState === "unavailable" && (
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/45">
                  Geolocation isn&apos;t available in this browser.
                </p>
              )}
              <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-foreground/35 leading-relaxed">
                Location stays on your device — used only to compute the transform, never sent anywhere.
              </p>
            </div>
          ) : (
            <ul className="overflow-y-auto px-1.5 py-1.5 [scrollbar-width:thin]">
              {rows.map((r) => {
                const isUp = r.altitudeDeg > 0
                const expanded = expandedId === r.id
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggleRow(r)}
                      aria-expanded={expanded}
                      className={`
                        w-full text-left px-2.5 py-2 rounded-lg transition-colors
                        ${expanded ? "bg-foreground/10" : "hover:bg-foreground/[0.06]"}
                        ${isUp ? "" : "opacity-45"}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                      `}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-[13px] text-foreground/90 truncate">
                          {r.name}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-foreground/60 shrink-0">
                          {isUp ? `${Math.round(r.altitudeDeg)}° ${r.compass}` : "below"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] tracking-[0.14em] uppercase text-foreground/40">
                        {isUp ? BAND_LABEL[r.band] : "not up right now"}
                      </div>

                      {expanded && (
                        <RowDetail row={r} observer={observer} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** The expanded row: real rise/transit/set + the constellation fact. */
function RowDetail({ row, observer }: { row: SkyRow; observer: Observer }) {
  const rts = useMemo(
    () => riseTransitSet(row.coord, observer, new Date()),
    [row.coord, observer],
  )
  return (
    <div className="mt-2 pt-2 border-t border-foreground/10">
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 font-mono text-[9px]">
        {rts.circumstance === "circumpolar" ? (
          <div className="col-span-3 text-accent/80 tracking-[0.14em] uppercase">
            Circumpolar — up all night
          </div>
        ) : rts.circumstance === "never" ? (
          <div className="col-span-3 text-foreground/45 tracking-[0.14em] uppercase">
            Never rises from your latitude
          </div>
        ) : (
          <>
            <TimeCell label="Rises" value={fmtTime(rts.rise)} />
            <TimeCell label="Highest" value={fmtTime(rts.transit)} />
            <TimeCell label="Sets" value={fmtTime(rts.set)} />
          </>
        )}
        <div className="col-span-3 mt-0.5">
          <span className="text-foreground/40 tracking-[0.14em] uppercase">Peaks at </span>
          <span className="text-foreground/75 tabular-nums">{Math.round(rts.transitAltitudeDeg)}° up</span>
        </div>
      </dl>
      <p className="mt-2 font-sans text-[11px] leading-snug text-foreground/60">{row.fact}</p>
      <p className="mt-1.5 font-mono text-[8px] tracking-[0.14em] uppercase text-accent/70">
        Tap again to un-highlight
      </p>
    </div>
  )
}

function TimeCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-foreground/40 tracking-[0.14em] uppercase">{label}</div>
      <div className="text-foreground/85 tabular-nums text-[10px]">{value}</div>
    </div>
  )
}
