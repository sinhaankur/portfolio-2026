"use client"

/**
 * SatelliteSearch — search the ~15.7k real-satellite catalogue by name, pick one
 * to highlight + follow in the scene, and see its details on the right.
 *
 * Bridges to the R3F SatelliteField via the module-scoped `selectedSatRef`
 * (writes the chosen NORAD id; the field reads it to mark + follow). Catalogue is
 * shared via `loadSatelliteCatalog()` so there's no second fetch.
 *
 * Only useful once Earth is focused + Satellites are on; the parent gates it.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Crosshair } from "lucide-react"
import { loadSatelliteCatalog, selectedSatRef, selectedArchetypeRef, type SatMeta } from "@/components/universe-engine/satellite-field"

const OWNER_LABEL: Record<string, string> = {
  US: "🇺🇸 United States", PRC: "🇨🇳 China", CIS: "🇷🇺 Russia / CIS",
  UK: "🇬🇧 United Kingdom", ESA: "🇪🇺 ESA", JPN: "🇯🇵 Japan", IND: "🇮🇳 India",
  FR: "🇫🇷 France", GER: "🇩🇪 Germany", ITSO: "🌐 Intelsat", TBD: "—",
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
}

export function SatelliteSearch() {
  const [catalog, setCatalog] = useState<SatMeta[] | null>(null)
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<SatMeta | null>(null)
  // Archetype label ("Starlink flat-pack" etc.) — the R3F field decides it from
  // the satellite's orbit + name, so we poll the bridge ref while one is picked.
  const [archetype, setArchetype] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSatelliteCatalog().then(setCatalog)
  }, [])

  useEffect(() => {
    if (!selected) { setArchetype(null); return }
    const id = setInterval(() => setArchetype(selectedArchetypeRef.current), 200)
    return () => clearInterval(id)
  }, [selected])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!catalog || query.length < 2) return []
    const out: SatMeta[] = []
    for (const s of catalog) {
      if (s.name.toLowerCase().includes(query)) {
        out.push(s)
        if (out.length >= 40) break
      }
    }
    return out
  }, [catalog, q])

  function pick(s: SatMeta) {
    setSelected(s)
    setQ("")
    selectedSatRef.current = s.id
    // Frame Earth so the swarm (and the marker) is on-screen.
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
  }

  function clearSel() {
    setSelected(null)
    selectedSatRef.current = null
    selectedArchetypeRef.current = null
  }

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))]">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={catalog ? `Search ${catalog.length.toLocaleString()} satellites…` : "Loading catalogue…"}
          aria-label="Search satellites by name"
          className="w-full rounded-full border border-border bg-background/80 backdrop-blur-md pl-9 pr-4 py-2.5 font-mono text-xs tracking-wider text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-background/90 backdrop-blur-md divide-y divide-border/60 [scrollbar-width:thin]"
          >
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  data-cursor-hover
                  className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors"
                >
                  <span className="block font-sans text-sm text-foreground truncate">{s.name}</span>
                  <span className="block font-mono text-[10px] tracking-wider text-muted-foreground">
                    {OWNER_LABEL[s.owner] ?? s.owner} · {new Date(s.launchMs).getUTCFullYear()}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Selected satellite details */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-xl border border-accent/40 bg-background/90 backdrop-blur-md p-4 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Crosshair className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden />
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent truncate">Following</p>
              </div>
              <button type="button" onClick={clearSel} data-cursor-hover aria-label="Stop following"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <h3 className="font-display text-xl font-light tracking-[-0.01em] leading-snug mb-2">{selected.name}</h3>
            <dl className="space-y-1.5 font-sans text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Operator</dt>
                <dd className="text-foreground text-right">{OWNER_LABEL[selected.owner] ?? selected.owner}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Launched</dt>
                <dd className="text-foreground tabular-nums">{fmtDate(selected.launchMs)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">NORAD ID</dt>
                <dd className="text-foreground tabular-nums">{selected.id}</dd>
              </div>
              {archetype && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Craft type</dt>
                  <dd className="text-foreground text-right">{archetype}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Shown at</dt>
                <dd className="text-foreground text-right">true 1:1 scale</dd>
              </div>
            </dl>
            <p className="mt-3 font-sans text-[11px] text-muted-foreground leading-relaxed">
              Position + altitude from live SGP4 orbit data (current epoch). The
              craft is drawn at its real size against Earth — a satellite is tens of
              millions of times smaller than the planet, so <strong className="text-foreground/80">zoom right in</strong> to see it.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
