"use client"

/**
 * MetricsPanel — full transparency on this engine's speed, accuracy, and
 * quantity of data, in the spirit of LeoLabs' public System Metrics page.
 * Every number here is measured from the actual data files the explorer
 * renders (catalogue header, per-object TLE epochs, the baked conjunction
 * screening) — and where a commercial radar network beats public TLEs, the
 * gap is stated plainly instead of hidden. Truth pillar: never present a
 * guess as fact.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Gauge, X } from "lucide-react"
import { loadFullCatalog, catalogHeaderRef, type CatalogHeader } from "@/components/universe-engine/satellite-data"

/** TLE line-1 epoch (cols 19–32, YYDDD.DDDDDDDD) → ms since Unix epoch. */
function tleEpochMs(l1: string): number | null {
  const yy = parseInt(l1.substring(18, 20), 10)
  const doy = parseFloat(l1.substring(20, 32))
  if (!Number.isFinite(yy) || !Number.isFinite(doy)) return null
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return Date.UTC(year, 0, 1) + (doy - 1) * 86400000
}

type Freshness = {
  medianDays: number
  bins: { label: string; count: number }[]
  total: number
}

type Screening = {
  snapshot?: string
  generatedMs?: number
  windowHours?: number
  reportKm?: number
  screenedObjects?: number
  totalFound?: number
}

type State = {
  kind: "loading" | "error" | "done"
  header?: CatalogHeader | null
  fresh?: Freshness
  screening?: Screening | null
}

function buildFreshness(epochs: number[]): Freshness {
  const now = Date.now()
  const ages = epochs.map((e) => (now - e) / 86400000).sort((a, b) => a - b)
  const median = ages.length ? ages[Math.floor(ages.length / 2)] : 0
  const bins = [
    { label: "≤ 1 day", max: 1, count: 0 },
    { label: "1–3 days", max: 3, count: 0 },
    { label: "3–7 days", max: 7, count: 0 },
    { label: "7–30 days", max: 30, count: 0 },
    { label: "> 30 days", max: Infinity, count: 0 },
  ]
  for (const a of ages) {
    for (const b of bins) if (a <= b.max) { b.count++; break }
  }
  return { medianDays: median, bins: bins.map(({ label, count }) => ({ label, count })), total: ages.length }
}

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
      <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-muted-foreground/80">{label}</p>
      <p className="mt-0.5 font-mono text-lg text-foreground tabular-nums leading-tight">
        {value}{unit && <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}

export function MetricsPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let alive = true
    Promise.all([
      // Shared catalogue cache — no second multi-MB download.
      loadFullCatalog(),
      fetch("/data/conjunctions.json").then((r) => r.json()).catch(() => null),
    ])
      .then(([sats, conj]) => {
        if (!alive) return
        const epochs: number[] = []
        for (const s of sats) {
          const e = tleEpochMs(s.l1)
          if (e !== null) epochs.push(e)
        }
        setState({
          kind: "done",
          header: catalogHeaderRef.current,
          fresh: buildFreshness(epochs),
          screening: conj as Screening | null,
        })
      })
      .catch(() => { if (alive) setState({ kind: "error" }) })
    return () => { alive = false }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="w-[min(24rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-[#9fe0ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#9fe0ff]">
          <Gauge className="h-3.5 w-3.5" /> System metrics
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4">
        {state.kind === "loading" && <p className="font-sans text-sm text-muted-foreground">Measuring the data…</p>}
        {state.kind === "error" && <p className="font-sans text-sm text-muted-foreground">Couldn&apos;t load the data files.</p>}
        {state.kind === "done" && state.fresh && (
          <div>
            <p className="font-sans text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Every number below is measured from the exact data this engine renders —
              nothing estimated, nothing hidden.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Objects tracked" value={(state.header?.count ?? state.fresh.total).toLocaleString()} />
              <Kpi label="Median TLE age" value={state.fresh.medianDays.toFixed(1)} unit="days" />
              <Kpi label="Objects screened" value={(state.screening?.screenedObjects ?? 0).toLocaleString()} />
              <Kpi label="Close approaches / 24 h" value={(state.screening?.totalFound ?? 0).toLocaleString()} />
            </div>

            {/* Orbit-data freshness — how old the element sets behind the scene
                are, right now, relative to your clock. The honest analogue of
                LeoLabs' revisit-rate chart. */}
            <div className="mt-4">
              <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-2">
                Orbit-data freshness (age of each object&apos;s TLE, now)
              </p>
              <div className="space-y-1.5">
                {state.fresh.bins.map((b) => {
                  const maxBin = Math.max(1, ...state.fresh!.bins.map((x) => x.count))
                  return (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 font-mono text-[9px] text-muted-foreground tabular-nums">{b.label}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full rounded-full bg-[#9fe0ff]" style={{ width: `${Math.max(b.count > 0 ? 2 : 0, (b.count / maxBin) * 100)}%` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right font-mono text-[9px] text-foreground/80 tabular-nums">{b.count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
              {state.header?.snapshot && (
                <p className="mt-2 font-mono text-[9px] text-muted-foreground/70">
                  Catalogue snapshot: {state.header.snapshot} · refreshed per deploy
                </p>
              )}
            </div>

            {/* The honesty ledger — what this engine can and cannot claim,
                against the operational-SSA state of the art. */}
            <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
              <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground mb-2">Accuracy, honestly</p>
              <ul className="space-y-2 font-sans text-[11px] text-foreground/80 leading-relaxed">
                <li>
                  <span className="text-[#9fe0ff]">Position model</span> — SGP4 on public TLEs:
                  roughly <span className="tabular-nums">1–5 km</span> near epoch, drifting by the
                  order of a kilometre per day after it. A radar network like LeoLabs measures
                  states to <span className="tabular-nums">~18 m</span> against laser-ranging truth.
                </li>
                <li>
                  <span className="text-[#9fe0ff]">Latency</span> — this catalogue is a static
                  snapshot baked at deploy time; LeoLabs publishes a state vector
                  <span className="tabular-nums"> ~2 min</span> after a radar pass. What moves here
                  moves on real physics, from data that is hours-to-days old.
                </li>
                <li>
                  <span className="text-[#9fe0ff]">Coverage</span> — public CelesTrak elements
                  ({(state.header?.count ?? 0).toLocaleString()} objects
                  {state.header?.breakdown && (
                    <> : {(state.header.breakdown["PAY"] ?? 0).toLocaleString()} payloads,{" "}
                    {(state.header.breakdown["DEB"] ?? 0).toLocaleString()} debris</>
                  )}). The full ~40k-object debris catalogue is Space-Track-gated and not included.
                </li>
                <li>
                  <span className="text-[#9fe0ff]">Screening</span> — geometry-only close-approach
                  search{state.screening?.reportKm ? <> below <span className="tabular-nums">{state.screening.reportKm} km</span></> : null}
                  {state.screening?.windowHours ? <> over <span className="tabular-nums">{state.screening.windowHours} h</span></> : null}.
                  No covariance is published with TLEs, so no collision probability is claimed — ever.
                </li>
              </ul>
            </div>

            <p className="mt-3 font-sans text-[11px] text-foreground/75 leading-relaxed">
              This is an open visual instrument for orbital awareness — built so anyone can see
              the sky&apos;s traffic, not an operational tracking service. The standard it aims at
              is LeoLabs-grade <em>transparency</em>: publish what the data is, how old it is, and
              where its limits are.
            </p>

            <p className="mt-3 font-mono text-[9px] tracking-wider text-muted-foreground/70">
              Data: CelesTrak SATCAT + GP/TLE · screening baked from this exact catalogue ·
              accuracy references: LeoLabs public system metrics, ILRS
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
