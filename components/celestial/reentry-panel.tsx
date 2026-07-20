"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * ReentryPanel — the orbital-decay / re-entry watchlist.
 *
 * LeoLabs' public signature is re-entry prediction — which tracked objects are
 * sinking out of orbit and roughly when. This is the open version: it scans the
 * whole 18k-object catalogue with lib/reentry.ts (perigee + B* drag term) and
 * lists the objects with the shortest estimated remaining lifetime. Every row is
 * flyable — pick one to select it in the swarm and frame Earth so you can see how
 * low it already orbits.
 *
 * Honesty, in the panel: this is a coarse ESTIMATE from a TLE snapshot, not a
 * validated forecast — real decay is driven by mass/area and future solar
 * activity the catalogue doesn't carry.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, Flame, Search, MapPin } from "lucide-react"
import { loadFullCatalog, selectedSatRef, observerRef, type SatRecord } from "@/components/universe-engine/satellite-field"
import { estimateDecay, lifetimeLabel, orbitReachesLatitude, tleInclination, type DecayEstimate } from "@/lib/reentry"

type Row = SatRecord & { decay: DecayEstimate; overYou?: boolean }

const STATUS_TONE: Record<DecayEstimate["status"], string> = {
  imminent: "text-[#ff7a6b]",
  decaying: "text-[#ffd166]",
  "leo-longterm": "text-[#9fe0ff]",
  stable: "text-foreground/70",
}
const STATUS_LABEL: Record<DecayEstimate["status"], string> = {
  imminent: "IMMINENT",
  decaying: "DECAYING",
  "leo-longterm": "LONG-TERM",
  stable: "STABLE",
}

function typeBadge(type?: string): string {
  if (type === "DEB") return "DEB"
  if (type === "R/B") return "R/B"
  return "PAY"
}

export function ReentryPanel({
  onClose,
  onJump,
}: {
  onClose?: () => void
  onJump?: () => void
}) {
  const [catalog, setCatalog] = useState<SatRecord[] | null>(null)
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<number | null>(null)
  // "Over me" — the human-facing filter: show only decaying objects whose orbit
  // passes over the user's latitude ("could this come down near me"). null until
  // they share location.
  const [userLat, setUserLat] = useState<number | null>(null)
  const [overMe, setOverMe] = useState(false)

  useEffect(() => {
    loadFullCatalog().then(setCatalog)
    // Reuse a location already granted elsewhere (the search card's slant range).
    const o = observerRef.current
    if (o) setUserLat((o.latitude * 180) / Math.PI)
  }, [])

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setOverMe(true)
        observerRef.current = {
          latitude: (pos.coords.latitude * Math.PI) / 180,
          longitude: (pos.coords.longitude * Math.PI) / 180,
          height: (pos.coords.altitude ?? 0) / 1000,
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  }

  // Scan the whole catalogue once, estimate decay, keep the soonest-to-reenter.
  // This is ~18k cheap parses — fine once on mount (useMemo keeps it off render).
  const { rows, imminentCount } = useMemo(() => {
    if (!catalog) return { rows: [] as Row[], imminentCount: 0 }
    const scored: Row[] = []
    let imminent = 0
    for (const s of catalog) {
      const decay = estimateDecay(s.l1, s.l2)
      if (!decay) continue
      if (decay.status === "imminent") imminent++
      // keep only things actually coming down within ~decades (drop the stable shell)
      if (decay.status === "stable" || decay.status === "leo-longterm") continue
      const overYou = userLat != null ? orbitReachesLatitude(tleInclination(s.l2), userLat) : undefined
      scored.push({ ...s, decay, overYou })
    }
    scored.sort((a, b) => a.decay.reentryMs - b.decay.reentryMs)
    return { rows: scored, imminentCount: imminent }
  }, [catalog, userLat])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let base = rows
    if (overMe && userLat != null) base = base.filter((r) => r.overYou)
    if (q) base = base.filter((r) => `${r.name} ${r.owner}`.toLowerCase().includes(q))
    return base.slice(0, 60)
  }, [rows, query, overMe, userLat])

  const jump = (r: Row) => {
    selectedSatRef.current = r.id
    setPicked(r.id)
    // Frame Earth so the low, decaying orbit is visible.
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
    onJump?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(27rem,calc(100vw-2rem))] max-h-[82vh] overflow-y-auto rounded-xl border border-[#ff7a6b]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ff7a6b]">
          <Flame className="h-3.5 w-3.5" /> Re-entry watch
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {!catalog && (
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Scanning catalogue…</p>
        )}
        {catalog && (
          <>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-[#ff7a6b] font-medium">{imminentCount.toLocaleString()}</span>{" "}
              objects estimated to re-enter within months (perigee &lt; 300 km).
              Sorted soonest first — tap one to select it and frame Earth so you can
              see how low it already orbits.
            </p>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by object or operator…"
                aria-label="Filter re-entry watchlist"
                className="w-full rounded-full border border-border bg-background/70 pl-8 pr-3 py-1.5 font-mono text-[10px] tracking-wider text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a6b]"
              />
            </div>

            {/* "Over me" — the human-facing filter: decaying objects whose orbit
                passes over YOUR latitude. Could one come down near you? */}
            <div className="mt-2">
              {userLat == null ? (
                <button
                  type="button"
                  onClick={requestLocation}
                  data-cursor-hover
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ff7a6b]/40 bg-[#ff7a6b]/[0.07] px-3 py-1.5 font-mono text-[9px] tracking-[0.15em] uppercase text-[#ff7a6b] hover:bg-[#ff7a6b]/15 transition-colors"
                >
                  <MapPin className="h-3 w-3" /> Could one pass over me?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOverMe((v) => !v)}
                  aria-pressed={overMe}
                  data-cursor-hover
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[9px] tracking-[0.15em] uppercase transition-colors ${
                    overMe
                      ? "border-[#ff7a6b]/60 bg-[#ff7a6b]/15 text-[#ff7a6b]"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  {overMe ? `Passing over you (${userLat.toFixed(0)}°)` : "Show only over-you"}
                </button>
              )}
            </div>

            <ul className="mt-3 flex flex-col gap-1">
              {filtered.length === 0 && (
                <li className="py-4 text-center font-mono text-[10px] tracking-wider text-muted-foreground">
                  Nothing matches.
                </li>
              )}
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => jump(r)}
                    data-cursor-hover
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      picked === r.id
                        ? "border-[#ff7a6b]/60 bg-[#ff7a6b]/10"
                        : "border-border/60 bg-background/40 hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] ${STATUS_TONE[r.decay.status]}`}>
                        {r.overYou && <MapPin className="h-2.5 w-2.5" aria-label="passes over your latitude" />}
                        {STATUS_LABEL[r.decay.status]}
                      </span>
                      <span className="font-mono text-[12px] tabular-nums text-foreground/90">
                        {lifetimeLabel(r.decay.lifetimeDays)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] leading-snug text-foreground/85 truncate">
                        {r.name}
                        <span className="ml-1 font-mono text-[8px] tracking-wider text-muted-foreground">{typeBadge(r.type)}</span>
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-muted-foreground shrink-0">
                        {Math.round(r.decay.perigeeKm)}×{Math.round(r.decay.apogeeKm)} km
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 border-t border-border/60 pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
              Estimated from each object&apos;s perigee altitude + B* drag term (public
              TLEs, CelesTrak). A coarse triage read, <span className="text-foreground/70">not a validated
              re-entry forecast</span> — real decay is driven by the object&apos;s mass/area and
              future solar activity, which a TLE snapshot can&apos;t know.
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}
