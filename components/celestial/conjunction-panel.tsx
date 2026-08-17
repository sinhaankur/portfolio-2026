"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * ConjunctionPanel — a LeoLabs-style close-approach OPERATIONS dashboard over
 * the live catalog.
 *
 * The SSA read commercial shops sell, open: the next 24 hours of close
 * approaches among the same 18,000+ tracked objects the explorer renders,
 * screened by lib/conjunction.ts (sieve → SGP4 grid → refined TCA) and baked
 * at data-refresh time. This is the operator's triage view:
 *   - a severity summary (critical < 0.5 km · warning < 2 km)
 *   - a SORTABLE table — by miss distance, time-to-TCA, or relative velocity
 *   - a text filter (object name / operator) + a "payload involved" toggle
 *   - every row FLYABLE: pick one → select the object + scrub the clock to 90 s
 *     before closest approach at real-time rate, and watch the two dots converge.
 *
 * Honesty, stated in the panel itself: geometry-only screening on public TLEs.
 * TLEs carry no covariance, so no collision probability is shown — this is
 * situational awareness, not operational collision avoidance.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, Crosshair, ArrowUpDown, Search } from "lucide-react"
import { setSimMs, timeScaleRef, REALTIME_TIME_SCALE } from "@/components/universe-engine/astronomy"
import { selectedSatRef, conjunctionFocusRef } from "@/components/universe-engine/satellite-refs"

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

type SortKey = "miss" | "tca" | "speed"

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

const isPayload = (t?: string) => t !== "DEB" && t !== "R/B"

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
  const [picked, setPicked] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("miss")
  const [query, setQuery] = useState("")
  const [payloadOnly, setPayloadOnly] = useState(false)
  const nowMs = Date.now()

  useEffect(() => {
    let alive = true
    fetch("/data/conjunctions.json")
      .then((r) => r.json())
      .then((d: BakedFile) => { if (alive) setData(d) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  // Severity counts over the FULL served set (the triage summary).
  const severity = useMemo(() => {
    if (!data) return { critical: 0, warning: 0 }
    let critical = 0, warning = 0
    for (const c of data.conjunctions) {
      if (c.missKm < 0.5) critical++
      else if (c.missKm < 2) warning++
    }
    return { critical, warning }
  }, [data])

  // Filter + sort — the operator's working set.
  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    let out = data.conjunctions.filter((c) => {
      if (payloadOnly && !isPayload(c.aType) && !isPayload(c.bType)) return false
      if (q) {
        const hay = `${c.aName} ${c.bName} ${c.aOwner ?? ""} ${c.bOwner ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    out = out.slice().sort((x, y) => {
      if (sortKey === "miss") return x.missKm - y.missKm
      if (sortKey === "tca") return x.tcaMs - y.tcaMs
      return y.relSpeedKms - x.relSpeedKms // speed: fastest first
    })
    return out.slice(0, 60)
  }, [data, query, payloadOnly, sortKey])

  const jump = (c: BakedConjunction) => {
    // Watch the approach happen: land 90 s before TCA at real-time rate,
    // with the (payload-preferred) object selected so its orbit lights up.
    const highlightId = isPayload(c.aType) ? c.aId : c.bId
    selectedSatRef.current = highlightId
    // Drive the 3D ENCOUNTER overlay — the scene marks BOTH objects and draws the
    // line between them, so the user sees the pair converge (not just one dot).
    conjunctionFocusRef.current = {
      aId: c.aId, bId: c.bId, tcaMs: c.tcaMs, missKm: c.missKm, relSpeedKms: c.relSpeedKms,
    }
    setSimMs(c.tcaMs - 90_000)
    timeScaleRef.current = REALTIME_TIME_SCALE
    setPicked(`${c.aId}-${c.bId}-${c.tcaMs}`)
    onJump?.()
  }

  // Live SEPARATION readout — the scene publishes the pair's true 3D distance each
  // frame while an encounter is focused; we show it counting down toward the miss
  // distance so the user reads "how close, right now". Cleared when nothing's live.
  const [liveSep, setLiveSep] = useState<number | null>(null)
  useEffect(() => {
    const onLive = (e: Event) => {
      const d = (e as CustomEvent<{ sepKm: number }>).detail
      if (d && Number.isFinite(d.sepKm)) setLiveSep(d.sepKm)
    }
    window.addEventListener("celestial:conjunction-live", onLive)
    return () => window.removeEventListener("celestial:conjunction-live", onLive)
  }, [])

  // Lift the 3D encounter overlay when this panel unmounts (closed) so a stale
  // pair doesn't keep drawing after the user leaves the conjunction view.
  useEffect(() => {
    return () => { conjunctionFocusRef.current = null }
  }, [])

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSortKey(k)}
      data-cursor-hover
      aria-pressed={sortKey === k}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] uppercase transition-colors ${
        sortKey === k
          ? "border-[#ff9d6b]/60 bg-[#ff9d6b]/15 text-[#ff9d6b]"
          : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <ArrowUpDown className="h-2.5 w-2.5" /> {label}
    </button>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(28rem,calc(100vw-2rem))] max-h-[82vh] overflow-y-auto rounded-xl border border-[#ff9d6b]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ff9d6b]">
          <Crosshair className="h-3.5 w-3.5" /> Conjunction watch
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
            {/* Severity summary — the triage read at a glance. */}
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <Stat label="Critical" sub="< 0.5 km" value={severity.critical} tone="text-[#ff7a6b]" />
              <Stat label="Warning" sub="< 2 km" value={severity.warning} tone="text-[#ffd166]" />
              <Stat label="Screened" sub="objects" value={data.screenedObjects} tone="text-foreground/80" compact />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-foreground/85 font-medium">{data.totalFound.toLocaleString()}</span>{" "}
              close approaches ≤ {data.reportKm} km predicted in the next {data.windowHours} h.
              Sort + filter the closest {Math.min(150, data.conjunctions.length)}; tap a row to
              fly to it 90 s before closest approach and watch it converge.
            </p>

            {/* LIVE ENCOUNTER readout — appears once a row is flown to. The scene
                marks both objects (amber + cyan rings) and the separation ticks
                down toward the predicted miss distance as they converge. */}
            {picked && liveSep != null && (
              <div className="mt-3 rounded-lg border border-[#ff5a6b]/40 bg-[#ff5a6b]/5 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#ff5a6b]">
                    Live separation
                  </span>
                  <span className="font-mono text-[9px] tracking-wider text-muted-foreground">
                    3D distance · now
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-[22px] tabular-nums text-foreground">
                    {liveSep < 10 ? liveSep.toFixed(2) : liveSep.toFixed(1)}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">km apart</span>
                </div>
                <p className="mt-1 font-mono text-[9px] tracking-wider text-muted-foreground">
                  <span className="text-[#ffb066]">◯ A</span>
                  <span className="mx-1">·</span>
                  <span className="text-[#5affc0]">◯ B</span>
                  <span className="mx-1.5">→</span>
                  closest approach ≈ predicted miss distance
                </p>
              </div>
            )}

            {/* Controls: search + sort + payload toggle. */}
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by object or operator…"
                  aria-label="Filter conjunctions"
                  className="w-full rounded-full border border-border bg-background/70 pl-8 pr-3 py-1.5 font-mono text-[10px] tracking-wider text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9d6b]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-muted-foreground mr-0.5">Sort</span>
                <SortBtn k="miss" label="Miss" />
                <SortBtn k="tca" label="Soonest" />
                <SortBtn k="speed" label="Speed" />
                <button
                  type="button"
                  onClick={() => setPayloadOnly((v) => !v)}
                  aria-pressed={payloadOnly}
                  data-cursor-hover
                  className={`ml-auto rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] uppercase transition-colors ${
                    payloadOnly
                      ? "border-[#5affc0]/60 bg-[#5affc0]/15 text-[#5affc0]"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Payload involved
                </button>
              </div>
            </div>

            {/* The risk table. */}
            <ul className="mt-3 flex flex-col gap-1">
              {rows.length === 0 && (
                <li className="py-4 text-center font-mono text-[10px] tracking-wider text-muted-foreground">
                  No approaches match.
                </li>
              )}
              {rows.map((c) => {
                const key = `${c.aId}-${c.bId}-${c.tcaMs}`
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => jump(c)}
                      data-cursor-hover
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        picked === key
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
                )
              })}
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

function Stat({
  label, sub, value, tone, compact,
}: { label: string; sub: string; value: number; tone: string; compact?: boolean }) {
  return (
    <div className="bg-background/80 px-3 py-2">
      <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono tabular-nums ${tone} ${compact ? "text-[13px]" : "text-[18px]"}`}>
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[8px] tracking-wider text-muted-foreground">{sub}</div>
    </div>
  )
}
