"use client"

/**
 * NeoPanel — near-Earth asteroid close approaches, live from NASA NeoWs.
 * Real flybys: how close (in lunar distances), how big, how fast, and whether
 * NASA flags them potentially hazardous. Puts the "space is busy" fact in front
 * of you with real numbers.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Orbit, X, AlertTriangle } from "lucide-react"
import { fetchNeoApproaches, sizeBand, type NeoApproach } from "@/lib/neo"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; items: NeoApproach[] }

function fmtWhen(d: Date): string {
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const day = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
}

export function NeoPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let alive = true
    fetchNeoApproaches(7).then((items) => {
      if (!alive) return
      setState(items ? { kind: "done", items: items.slice(0, 12) } : { kind: "error" })
    })
    return () => { alive = false }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(23rem,calc(100vw-2rem))] max-h-[78vh] overflow-y-auto rounded-xl border border-[#ffd27a]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#ffd27a]">
          <Orbit className="h-3.5 w-3.5" /> Asteroids near Earth
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && <p className="font-sans text-sm text-muted-foreground">Reading NASA NeoWs…</p>}
        {state.kind === "error" && <p className="font-sans text-sm text-muted-foreground">NEO feed unavailable (rate-limited or offline).</p>}
        {state.kind === "done" && (
          <div>
            <p className="font-sans text-[11px] text-muted-foreground mb-3 leading-relaxed">
              {state.items.length} known objects pass within range over the next week — distances in
              lunar distances (1 LD = the Earth–Moon gap).
            </p>
            <ul className="space-y-2">
              {state.items.map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-sm text-foreground truncate">{n.name}</span>
                    {n.hazardous && (
                      <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[9px] tracking-widest uppercase text-red-300">
                        <AlertTriangle className="h-3 w-3" /> PHA
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {n.missLunar.toFixed(1)} LD · {n.velocityKms.toFixed(1)} km/s · {sizeBand(n.diameterMinM, n.diameterMaxM)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 tabular-nums">{fmtWhen(n.date)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[9px] tracking-wider text-muted-foreground/70">
              Live from NASA NeoWs · &quot;PHA&quot; = potentially hazardous (NASA classification)
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
