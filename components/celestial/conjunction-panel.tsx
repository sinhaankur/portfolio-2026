"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * ConjunctionPanel — close-approach screening over the live catalog.
 *
 * The SSA read commercial shops sell, open: the next 24 hours of close
 * approaches among the same 18,000+ tracked objects the explorer renders,
 * screened by lib/conjunction.ts (sieve → SGP4 grid → refined TCA) and baked
 * at data-refresh time. Every row is FLYABLE: picking one selects the object
 * in the swarm and scrubs the sim clock to 90 seconds before closest
 * approach at real-time rate — you watch the two dots actually converge.
 *
 * Honesty, stated in the panel itself: geometry-only screening on public
 * TLEs. TLEs carry no covariance, so no collision probability is shown —
 * this is situational awareness, not operational collision avoidance.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { X, Crosshair } from "lucide-react"
import { setSimMs, timeScaleRef, REALTIME_TIME_SCALE } from "@/components/universe-engine/astronomy"
import { selectedSatRef } from "@/components/universe-engine/satellite-field"

type BakedConjunction = {
  aId: number
  aName: string
  aType?: string
  aOwner?: string
  bId: number
  bName: string
  bType?: string
  bOwner?: string
  tcaMs: number
  missKm: number
  relSpeedKms: number
}

type BakedFile = {
  generatedMs: number
  snapshot: string
  windowHours: number
  reportKm: number
  screenedObjects: number
  totalFound: number
  conjunctions: BakedConjunction[]
}

function tcaLabel(tcaMs: number, nowMs: number): string {
  const d = new Date(tcaMs)
  const t = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
  const dtMin = Math.round((tcaMs - nowMs) / 60000)
  if (dtMin < -1) return `${t} · passed`
  if (dtMin < 60) return `${t} · in ${Math.max(0, dtMin)}m`
  return `${t} · in ${Math.floor(dtMin / 60)}h ${dtMin % 60}m`
}

/** Colour by miss distance — the operator triage read. */
function missTone(km: number): string {
  if (km < 0.5) return "text-[#ff7a6b]"
  if (km < 2) return "text-[#ffd166]"
  return "text-foreground/80"
}

function typeBadge(type?: string): string {
  if (type === "DEB") return "DEB"
  if (type === "R/B") return "R/B"
  return "PAY"
}

export function ConjunctionPanel({
  onClose,
  onJump,
}: {
  onClose?: () => void
  /** Called after a row is picked (e.g. so the parent can close sheets). */
  onJump?: () => void
}) {
  const [data, setData] = useState<BakedFile | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const nowMs = Date.now()

  useEffect(() => {
    let alive = true
    fetch("/data/conjunctions.json")
      .then((r) => r.json())
      .then((d: BakedFile) => { if (alive) setData(d) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const jump = (c: BakedConjunction, idx: number) => {
    // Watch the approach happen: land 90 s before TCA at real-time rate,
    // with the (payload-preferred) object selected so its orbit lights up.
    const highlightId = c.aType === "DEB" || c.aType === "R/B" ? c.bId : c.aId
    selectedSatRef.current = highlightId
    setSimMs(c.tcaMs - 90_000)
    timeScaleRef.current = REALTIME_TIME_SCALE
    setPicked(idx)
    onJump?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(26rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#ff9d6b]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ff9d6b]">
          <Crosshair className="h-3.5 w-3.5" /> Conjunction screening
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {failed && (
          <p className="text-[12px] text-muted-foreground">Screening data unavailable.</p>
        )}
        {!data && !failed && (
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Loading…</p>
        )}
        {data && (
          <>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              <span className="text-foreground/85 font-medium">{data.totalFound.toLocaleString()}</span>{" "}
              close approaches ≤ {data.reportKm} km predicted among{" "}
              {data.screenedObjects.toLocaleString()} tracked objects in the{" "}
              {data.windowHours} h after screening. Tap one — the clock jumps to
              90 s before closest approach so you can watch it happen.
            </p>

            <ul className="mt-3 flex flex-col gap-1">
              {data.conjunctions.slice(0, 25).map((c, idx) => (
                <li key={`${c.aId}-${c.bId}-${c.tcaMs}`}>
                  <button
                    type="button"
                    onClick={() => jump(c, idx)}
                    data-cursor-hover
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      picked === idx
                        ? "border-[#ff9d6b]/60 bg-[#ff9d6b]/10"
                        : "border-border/60 bg-background/40 hover:border-foreground/30"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-mono text-[13px] tabular-nums ${missTone(c.missKm)}`}>
                        {c.missKm.toFixed(2)} km
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {tcaLabel(c.tcaMs, nowMs)} · {c.relSpeedKms.toFixed(1)} km/s
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-foreground/80">
                      <span className="font-medium">{c.aName}</span>
                      <span className="ml-1 font-mono text-[8px] tracking-wider text-muted-foreground">{typeBadge(c.aType)}</span>
                      <span className="mx-1.5 text-muted-foreground">×</span>
                      <span className="font-medium">{c.bName}</span>
                      <span className="ml-1 font-mono text-[8px] tracking-wider text-muted-foreground">{typeBadge(c.bType)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 border-t border-border/60 pt-2.5 text-[10px] leading-relaxed text-muted-foreground">
              Geometry-only screening on public TLEs (CelesTrak,{" "}
              {data.snapshot}) via SGP4 — sieve → coarse grid → refined TCA.
              TLEs carry no covariance, so no collision probability is claimed.
              Situational awareness, not operational collision avoidance.
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}
