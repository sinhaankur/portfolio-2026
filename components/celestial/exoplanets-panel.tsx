"use client"

/**
 * ExoplanetsPanel — a browsable window into the REAL confirmed-exoplanet catalog
 * from the NASA Exoplanet Archive (exoplanetarchive.ipac.caltech.edu, CORS-open
 * TAP service). Shows the most recently discovered planets with their real
 * measured radius, mass, orbital period, host star, discovery method and year,
 * and distance — sortable/searchable. Every value is measured data; missing
 * fields are shown as "—", never guessed. Fails soft when offline.
 *
 * With thanks to NASA + the Exoplanet Archive for its open data.
 * https://github.com/sinhaankur/portfolio-2026
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Globe2, X, Search } from "lucide-react"
import { fetchExoplanets, type Exoplanet } from "@/lib/nasa-feeds"

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; planets: Exoplanet[] }

function num(v: number | null, digits = 2, suffix = ""): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v.toFixed(digits)}${suffix}`
}

export function ExoplanetsPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [query, setQuery] = useState("")

  useEffect(() => {
    let alive = true
    fetchExoplanets(300).then((planets) => {
      if (!alive) return
      if (!planets.length) { setState({ kind: "error" }); return }
      setState({ kind: "done", planets })
    })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    if (state.kind !== "done") return []
    const q = query.trim().toLowerCase()
    if (!q) return state.planets
    return state.planets.filter(
      (p) => p.name.toLowerCase().includes(q) || p.hostStar.toLowerCase().includes(q) || p.method.toLowerCase().includes(q),
    )
  }, [state, query])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="w-[min(26rem,calc(100vw-2rem))] max-h-[78vh] overflow-hidden flex flex-col rounded-xl border border-[#7fd0ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/90 backdrop-blur">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#7fd0ff]">
          <Globe2 className="h-3.5 w-3.5" /> Exoplanets · confirmed
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {state.kind === "done" && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search planet, star, or method…"
              className="w-full bg-transparent font-sans text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
          </div>
          <p className="mt-1.5 font-mono text-[9px] tracking-wider text-muted-foreground">
            {filtered.length} of {state.planets.length} · most recent first
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {state.kind === "loading" && (
          <p className="font-sans text-sm text-muted-foreground">Loading the confirmed-planet catalog…</p>
        )}
        {state.kind === "error" && (
          <p className="font-sans text-sm text-muted-foreground">
            Exoplanet Archive unavailable (offline or rate-limited).
          </p>
        )}
        {state.kind === "done" && (
          <ul className="space-y-2">
            {filtered.slice(0, 120).map((p) => (
              <li key={p.name} className="rounded-lg border border-border bg-background/50 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-[15px] leading-tight text-foreground">{p.name}</h3>
                  {p.discYear != null && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">{p.discYear}</span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
                  host {p.hostStar}{p.distanceLy != null ? ` · ${Math.round(p.distanceLy)} ly` : ""}
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 font-mono text-[10px] text-foreground/75">
                  <span title="radius vs Earth">R {num(p.radiusEarth, 2, "×")}</span>
                  <span title="mass vs Earth">M {num(p.massEarth, 2, "×")}</span>
                  <span title="orbital period (days)">P {num(p.periodDays, 1, "d")}</span>
                </div>
                <p className="mt-1 font-mono text-[9px] tracking-wider text-muted-foreground/80">{p.method}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border">
        <p className="font-mono text-[9px] text-muted-foreground/70">
          Source: NASA Exoplanet Archive (Caltech/IPAC) — with thanks for its open data.
        </p>
      </div>
    </motion.div>
  )
}
