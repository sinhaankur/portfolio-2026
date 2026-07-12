"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * PorkchopPlot — the Earth→Mars launch-window plot, mission-design style.
 *
 * A heat grid of departure date (x) × arrival date (y), each cell coloured by
 * C3 — the launch energy that transfer needs. The dark "valley" is the cheap
 * launch window; the ★ marks the minimum-C3 transfer. This is the view mission
 * designers actually read to pick a launch date. Solved with a real Lambert
 * solver (lib/porkchop.ts) — see the honest approximation note at the bottom.
 */

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Orbit, X } from "lucide-react"
import { earthMarsPorkchop, type PorkchopGrid } from "@/lib/porkchop"

const C3_CEILING = 50 // km²/s² — plot range; the valley is ~9–30

// Blue (low C3, cheap) → teal → amber → red (high C3, expensive). A perceptual-ish
// ramp so the valley reads dark/cool and costly transfers glow warm.
function c3Color(c3: number | null): string {
  if (c3 == null) return "transparent"
  const t = Math.min(1, Math.max(0, (c3 - 8) / (C3_CEILING - 8)))
  // piecewise: deep blue → teal → amber → red
  if (t < 0.33) { const u = t / 0.33; return `rgb(${Math.round(20 + u * 20)}, ${Math.round(80 + u * 120)}, ${Math.round(150 + u * 55)})` }
  if (t < 0.66) { const u = (t - 0.33) / 0.33; return `rgb(${Math.round(40 + u * 200)}, ${Math.round(200 - u * 20)}, ${Math.round(205 - u * 150)})` }
  const u = (t - 0.66) / 0.34
  return `rgb(${Math.round(240 + u * 15)}, ${Math.round(180 - u * 140)}, ${Math.round(55 - u * 40)})`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
}

export function PorkchopPlot({ onClose }: { onClose?: () => void }) {
  // Compute the grid once, anchored to today. It's ~800 Lambert solves — fast,
  // but useMemo keeps it off the render path.
  const grid: PorkchopGrid = useMemo(
    () => earthMarsPorkchop({ startDate: new Date(), c3Ceiling: C3_CEILING }),
    [],
  )
  const [hover, setHover] = useState<{ departDay: number; arriveDay: number; c3: number | null; tof: number } | null>(null)

  const nx = grid.departDays.length
  const ny = grid.arriveDays.length
  const cellOf = useMemo(() => {
    const map = new Map<string, (typeof grid.cells)[number]>()
    for (const c of grid.cells) map.set(`${c.departDay}:${c.arriveDay}`, c)
    return map
  }, [grid])

  // SVG geometry
  const W = 300
  const H = 220
  const padL = 4
  const padB = 4
  const cw = (W - padL) / nx
  const ch = (H - padB) / ny

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#7affd0]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7affd0]">
          <Orbit className="h-3.5 w-3.5" /> Earth → Mars · launch windows
        </p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="p-4">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Every cell is one transfer — departure date across, arrival date up —
          coloured by <span className="text-foreground/80">C3</span>, the launch
          energy it needs. The dark valley is the cheap window; ★ is the minimum.
        </p>

        {/* The porkchop grid */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full rounded-md border border-border bg-black/40"
          role="img"
          aria-label="Earth to Mars porkchop plot — C3 by departure and arrival date"
        >
          {grid.cells.map((c, i) => {
            const xi = grid.departDays.indexOf(c.departDay)
            const yi = grid.arriveDays.indexOf(c.arriveDay)
            const x = padL + xi * cw
            const y = H - padB - (yi + 1) * ch
            return (
              <rect
                key={i}
                x={x} y={y} width={cw + 0.5} height={ch + 0.5}
                fill={c3Color(c.c3)}
                onMouseEnter={() => setHover({ departDay: c.departDay, arriveDay: c.arriveDay, c3: c.c3, tof: c.tofDays })}
              />
            )
          })}
          {/* the minimum-C3 star */}
          {grid.best && (() => {
            const xi = grid.departDays.indexOf(grid.best.departDay)
            const yi = grid.arriveDays.indexOf(grid.best.arriveDay)
            const cx = padL + xi * cw + cw / 2
            const cy = H - padB - (yi + 1) * ch + ch / 2
            return <text x={cx} y={cy + 4} textAnchor="middle" className="fill-white" style={{ fontSize: 14 }}>★</text>
          })()}
        </svg>

        {/* axis labels */}
        <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
          <span>depart {fmtDate(new Date(grid.startDate.getTime() + grid.departDays[0] * 86400000))}</span>
          <span>→ {fmtDate(new Date(grid.startDate.getTime() + grid.departDays[nx - 1] * 86400000))}</span>
        </div>

        {/* hover / best readout */}
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          <Stat label="Min C3" value={grid.best ? grid.best.c3.toFixed(1) : "—"} sub="km²/s²" />
          <Stat label="Flight time" value={grid.best ? String(grid.best.tofDays) : "—"} sub="days" />
          <Stat label="Depart" value={grid.best ? fmtDate(grid.best.departDate) : "—"} />
          <Stat label="Arrive" value={grid.best ? fmtDate(grid.best.arriveDate) : "—"} />
        </dl>

        {hover && hover.c3 != null && (
          <p className="mt-2 font-mono text-[10px] text-[#7affd0]/80">
            hover: C3 {hover.c3.toFixed(1)} km²/s² · TOF {hover.tof} d
          </p>
        )}

        <p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
          Solved with a real Lambert solver (universal-variable). Model:
          circular, coplanar Earth + Mars at mean radii, heliocentric two-body —
          the standard first-order porkchop, accurate to the shape + window within
          days. Flight-quality design uses full JPL ephemeris + a 3-D solver; the
          mathematics is the same.
        </p>
      </div>
    </motion.div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background/80 px-3 py-2">
      <div className="font-mono text-[8px] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] tabular-nums text-foreground">
        {value}
        {sub && <span className="ml-1 text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  )
}
