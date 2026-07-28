"use client"

/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 *
 * ProximityPanel — state comparison. Pick two catalogued objects and see how
 * close they get over the next 24 h: closest-approach distance, when, relative
 * speed, and a separation-over-time sparkline. Public data; awareness, not
 * operational collision avoidance.
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, ArrowLeftRight } from "lucide-react"
import { screenTwoObjects, type ProximityResult } from "@/lib/conjunction"
import { loadFullCatalog, type SatRecord } from "@/components/universe-engine/satellite-field"

function Picker({ label, catalog, value, onChange }: {
  label: string
  catalog: SatRecord[] | null
  value: SatRecord | null
  onChange: (s: SatRecord | null) => void
}) {
  const [q, setQ] = useState("")
  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!catalog || query.length < 2) return []
    const out: SatRecord[] = []
    for (const s of catalog) { if (s.name.toLowerCase().includes(query)) { out.push(s); if (out.length >= 8) break } }
    return out
  }, [catalog, q])
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-background/60 px-2.5 py-1.5">
        <span className="min-w-0 truncate text-[12px] text-foreground">{value.name}</span>
        <button onClick={() => onChange(null)} className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground">change</button>
      </div>
    )
  }
  return (
    <div className="relative">
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder={label}
        className="w-full rounded-lg border border-border bg-background/70 px-2.5 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background/95 backdrop-blur-md divide-y divide-border/60 max-h-40 overflow-y-auto">
          {results.map((s) => (
            <li key={s.id}>
              <button onClick={() => { onChange(s); setQ("") }} className="w-full text-left px-2.5 py-1.5 text-[12px] text-foreground hover:bg-secondary/50 truncate">{s.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Separation sparkline. */
function Spark({ series, minKm }: { series: { tMs: number; km: number }[]; minKm: number }) {
  if (series.length < 2) return null
  const W = 240, H = 44
  const kms = series.map((s) => s.km)
  const lo = Math.min(...kms), hi = Math.max(...kms)
  const span = Math.max(hi - lo, 1)
  const pts = series.map((s, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - ((s.km - lo) / span) * (H - 6) - 3
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-11 mt-1" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#ff9d6b" strokeWidth="1.5" />
      <line x1="0" x2={W} y1={H - ((minKm - lo) / span) * (H - 6) - 3} y2={H - ((minKm - lo) / span) * (H - 6) - 3} stroke="#7fd4ff" strokeWidth="0.75" strokeDasharray="3 3" />
    </svg>
  )
}

export function ProximityPanel({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<SatRecord[] | null>(null)
  const [a, setA] = useState<SatRecord | null>(null)
  const [b, setB] = useState<SatRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ProximityResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { loadFullCatalog().then(setCatalog) }, [])

  async function compare() {
    if (!a || !b) return
    setBusy(true); setErr(null); setRes(null)
    try {
      const r = await screenTwoObjects(
        { id: a.id, name: a.name, l1: a.l1, l2: a.l2 },
        { id: b.id, name: b.name, l1: b.l1, l2: b.l2 },
        { startMs: Date.now(), hours: 24 },
      )
      setRes(r)
    } catch (e) { setErr(e instanceof Error ? e.message : "Comparison failed.") }
    finally { setBusy(false) }
  }

  const minKm = res ? Math.min(...res.series.map((s) => s.km), res.missKm) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="w-full max-w-sm rounded-2xl border border-border bg-background/90 backdrop-blur-md p-4 shadow-2xl"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[11px] tracking-[0.25em] uppercase text-foreground/80">Proximity</h2>
        <button onClick={onClose} aria-label="Close" className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-border text-foreground/70 hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug mb-2">How close do two objects get over the next 24 h?</p>

      <div className="space-y-2">
        <Picker label="First object…" catalog={catalog} value={a} onChange={setA} />
        <div className="flex justify-center text-muted-foreground"><ArrowLeftRight className="w-3.5 h-3.5" /></div>
        <Picker label="Second object…" catalog={catalog} value={b} onChange={setB} />
      </div>

      <button
        onClick={compare} disabled={!a || !b || busy}
        className="mt-3 w-full rounded-full bg-accent px-3 py-2 font-mono text-[10px] tracking-[0.2em] uppercase text-accent-foreground disabled:opacity-50 hover:opacity-90"
      >
        {busy ? "Comparing…" : "Compare"}
      </button>

      {err && <p className="mt-2 text-[11px] text-red-400/90">{err}</p>}

      {res && (
        <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[10.5px]">
            <span className="text-foreground/50">Closest</span>
            <span className={`text-right tabular-nums ${res.missKm < 5 ? "text-red-400" : res.missKm < 25 ? "text-amber-400" : "text-foreground/90"}`}>{res.missKm.toFixed(1)} km</span>
            <span className="text-foreground/50">When</span>
            <span className="text-right tabular-nums text-foreground/90">{new Date(res.tcaMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-foreground/50">Rel. speed</span>
            <span className="text-right tabular-nums text-foreground/90">{res.relSpeedKms.toFixed(2)} km/s</span>
          </div>
          <Spark series={res.series} minKm={minKm} />
          <p className="font-mono text-[8px] tracking-wider uppercase text-muted-foreground/60 text-center">separation over 24 h</p>
        </div>
      )}

      <p className="mt-3 pt-2 border-t border-border/60 text-[9px] leading-snug text-muted-foreground/70">
        Geometry-only on public TLEs — awareness &amp; education, not operational collision avoidance.
      </p>
    </motion.div>
  )
}
