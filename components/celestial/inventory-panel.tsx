"use client"

/**
 * InventoryPanel — the real orbital-population census. Categorizes all ~18,500
 * tracked objects by orbit regime (LEO/MEO/GEO/HEO) and type (payload / rocket
 * body / debris), computed live from the actual TLE elements — plus an honest
 * size-vs-Earth comparison. Every number is real, not estimated.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Layers, X } from "lucide-react"
import { buildInventory, earthRatio, KNOWN_SIZES, type Inventory } from "@/lib/sat-inventory"

type State = { kind: "loading" } | { kind: "error" } | { kind: "done"; inv: Inventory }

const REGIME_COLOR: Record<string, string> = {
  LEO: "#9fe0ff", MEO: "#ffd27a", GEO: "#ff9a6b", HEO: "#c58cff",
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
    </div>
  )
}

export function InventoryPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let alive = true
    fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setState({ kind: "done", inv: buildInventory(d.sats) }) })
      .catch(() => { if (alive) setState({ kind: "error" }) })
    return () => { alive = false }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#9fe0ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#9fe0ff]">
          <Layers className="h-3.5 w-3.5" /> Orbital census
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && <p className="font-sans text-sm text-muted-foreground">Counting the catalogue…</p>}
        {state.kind === "error" && <p className="font-sans text-sm text-muted-foreground">Couldn&apos;t load the catalogue.</p>}
        {state.kind === "done" && (() => {
          const { rows, totals } = state.inv
          const maxTotal = Math.max(...rows.map((r) => r.total))
          return (
            <div>
              <p className="font-sans text-[11px] text-muted-foreground mb-3 leading-relaxed">
                <span className="text-foreground tabular-nums">{totals.total.toLocaleString()}</span> tracked objects,
                by orbit regime — computed live from each object&apos;s real orbital elements.
              </p>

              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.regime}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] tracking-wider" style={{ color: REGIME_COLOR[r.regime] }}>
                        {r.regime} <span className="text-muted-foreground/70">· {r.altRange}</span>
                      </span>
                      <span className="font-mono text-xs text-foreground tabular-nums">{r.total.toLocaleString()}</span>
                    </div>
                    <Bar value={r.total} max={maxTotal} color={REGIME_COLOR[r.regime]} />
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground/70 tabular-nums">
                      {r.payload.toLocaleString()} payload · {r.rocket.toLocaleString()} rocket · {r.debris.toLocaleString()} debris
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
                <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-1">The debris problem</p>
                <p className="font-sans text-[12px] text-foreground/80 leading-relaxed">
                  <span className="text-[#ff9a6b] tabular-nums">{totals.debris.toLocaleString()}</span> tracked debris
                  fragments — almost all in low orbit, where they threaten working satellites at ~7.8 km/s.
                </p>
              </div>

              <div className="mt-4">
                <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-2">How big are they, really?</p>
                <ul className="space-y-1.5">
                  {KNOWN_SIZES.map((k) => (
                    <li key={k.name} className="flex items-baseline justify-between gap-3">
                      <span className="font-sans text-[12px] text-foreground">{k.name} <span className="text-muted-foreground text-[10px]">· {k.sizeM} m</span></span>
                      <span className="font-mono text-[9px] text-muted-foreground/70 tabular-nums text-right">{earthRatio(k.sizeM)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-sans text-[10px] text-muted-foreground/70 leading-relaxed">
                  Even the ISS is ~117,000× smaller than Earth&apos;s width — which is why, at true scale, each satellite is a single point of light.
                </p>
              </div>

              <p className="mt-3 font-mono text-[9px] tracking-wider text-muted-foreground/70">
                Data: CelesTrak SATCAT + TLEs · regimes computed from real orbital elements
              </p>
            </div>
          )
        })()}
      </div>
    </motion.div>
  )
}
