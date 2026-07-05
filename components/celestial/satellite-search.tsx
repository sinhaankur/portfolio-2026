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
import { loadSatelliteCatalog, selectedSatRef, selectedArchetypeRef, selectedOrbitRef, type SatMeta, type SatOrbit } from "@/components/universe-engine/satellite-field"

const OWNER_LABEL: Record<string, string> = {
  US: "🇺🇸 United States", PRC: "🇨🇳 China", CIS: "🇷🇺 Russia / CIS",
  UK: "🇬🇧 United Kingdom", ESA: "🇪🇺 ESA", JPN: "🇯🇵 Japan", IND: "🇮🇳 India",
  FR: "🇫🇷 France", GER: "🇩🇪 Germany", ITSO: "🌐 Intelsat", TBD: "—",
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
}

const fmtKm = (km: number) => `${Math.round(km).toLocaleString()} km`
// apogee ≈ perigee (near-circular) → show one altitude; else the range.
function fmtAltRange(apogeeKm: number, perigeeKm: number) {
  if (Math.abs(apogeeKm - perigeeKm) < Math.max(15, apogeeKm * 0.01)) {
    return `${fmtKm((apogeeKm + perigeeKm) / 2)} (circular)`
  }
  return `${fmtKm(perigeeKm)} – ${fmtKm(apogeeKm)}`
}

/** The real fragmentation event behind a debris fragment (matched on its name).
 *  Lets a selected fragment explain WHERE it came from — truthful provenance. */
function debrisOrigin(name: string): string | null {
  const n = name.toUpperCase()
  if (n.startsWith("FENGYUN 1C")) return "Fengyun-1C — China's 2007 anti-satellite missile test destroyed this defunct weather satellite, creating the largest debris cloud in history (~3,500 tracked fragments)."
  if (n.startsWith("IRIDIUM 33")) return "Iridium-33 — destroyed in the first major satellite collision (10 Feb 2009) when the dead Russian Cosmos-2251 struck this active comms satellite at ~11.7 km/s."
  if (n.startsWith("COSMOS 2251")) return "Cosmos-2251 — a defunct Russian comms satellite that collided with the active Iridium-33 on 10 Feb 2009, the first hypervelocity satellite-satellite collision."
  if (n.startsWith("COSMOS 1408")) return "Cosmos-1408 — a defunct Soviet satellite destroyed by Russia's 2021 anti-satellite test, forcing the ISS crew to shelter as the fragments passed."
  return null
}

export function SatelliteSearch() {
  const [catalog, setCatalog] = useState<SatMeta[] | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "debris">("all")
  const [selected, setSelected] = useState<SatMeta | null>(null)
  // Archetype label ("Starlink flat-pack" etc.) + live orbital readout — the R3F
  // field derives both from SGP4, so we poll the bridge refs while one is picked.
  const [archetype, setArchetype] = useState<string | null>(null)
  const [orbit, setOrbit] = useState<SatOrbit | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSatelliteCatalog().then(setCatalog)
  }, [])

  useEffect(() => {
    if (!selected) { setArchetype(null); setOrbit(null); return }
    const id = setInterval(() => {
      setArchetype(selectedArchetypeRef.current)
      // clone so React sees a new object each tick (altitude/speed change live)
      const o = selectedOrbitRef.current
      setOrbit(o ? { ...o } : null)
    }, 200)
    return () => clearInterval(id)
  }, [selected])

  const isDebris = (s: SatMeta) => s.type === "DEB" || s.type === "R/B"
  const counts = useMemo(() => {
    if (!catalog) return { active: 0, debris: 0 }
    let d = 0
    for (const s of catalog) if (isDebris(s)) d++
    return { active: catalog.length - d, debris: d }
  }, [catalog])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!catalog || query.length < 2) return []
    const out: SatMeta[] = []
    for (const s of catalog) {
      if (filter === "active" && isDebris(s)) continue
      if (filter === "debris" && !isDebris(s)) continue
      if (s.name.toLowerCase().includes(query)) {
        out.push(s)
        if (out.length >= 40) break
      }
    }
    return out
  }, [catalog, q, filter])

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

      {/* Active / debris filter — isolate the real junk cloud (LeoLabs-style). */}
      <div className="mt-2 flex gap-1.5">
        {([
          { k: "all", label: "All" },
          { k: "active", label: `Active · ${counts.active.toLocaleString()}` },
          { k: "debris", label: `Debris · ${counts.debris.toLocaleString()}` },
        ] as const).map((opt) => (
          <button
            key={opt.k}
            type="button"
            onClick={() => setFilter(opt.k)}
            data-cursor-hover
            className={`rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-wider uppercase transition-colors ${
              filter === opt.k
                ? opt.k === "debris"
                  ? "border-red-400/60 bg-red-400/15 text-red-300"
                  : "border-accent/60 bg-accent/15 text-accent"
                : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
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
                <Crosshair className={`h-3.5 w-3.5 shrink-0 ${isDebris(selected) ? "text-red-300" : "text-accent"}`} aria-hidden />
                <p className={`font-mono text-[10px] tracking-[0.2em] uppercase truncate ${isDebris(selected) ? "text-red-300" : "text-accent"}`}>
                  {selected.type === "DEB" ? "Debris · following" : selected.type === "R/B" ? "Rocket body · following" : "Following"}
                </p>
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
              {orbit && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Orbit</dt>
                    <dd className="text-foreground text-right">{orbit.regime}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Altitude</dt>
                    <dd className="text-foreground text-right tabular-nums">
                      {fmtAltRange(orbit.apogeeKm, orbit.perigeeKm)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Now at</dt>
                    <dd className="text-accent text-right tabular-nums">
                      {fmtKm(orbit.altitudeKm)} · {orbit.speedKms.toFixed(2)} km/s
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Currently over</dt>
                    <dd className="text-foreground text-right tabular-nums">
                      {Math.abs(orbit.subLatDeg).toFixed(1)}°{orbit.subLatDeg >= 0 ? "N" : "S"}, {Math.abs(orbit.subLonDeg).toFixed(1)}°{orbit.subLonDeg >= 0 ? "E" : "W"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Period</dt>
                    <dd className="text-foreground text-right tabular-nums">
                      {orbit.periodMin >= 1440
                        ? `${(orbit.periodMin / 1440).toFixed(2)} days`
                        : `${orbit.periodMin.toFixed(1)} min`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Inclination</dt>
                    <dd className="text-foreground text-right tabular-nums">{orbit.inclinationDeg.toFixed(1)}°</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Shown at</dt>
                <dd className="text-foreground text-right">true 1:1 scale</dd>
              </div>
            </dl>
            {isDebris(selected) && debrisOrigin(selected.name) && (
              <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/[0.06] px-3 py-2 font-sans text-[11px] text-foreground/80 leading-relaxed">
                ⚠ {debrisOrigin(selected.name)}
              </p>
            )}
            <p className="mt-3 font-sans text-[11px] text-muted-foreground leading-relaxed">
              Altitude + speed update live from SGP4 propagation of the current-epoch
              orbit; apogee, period and inclination are the orbit's fixed elements. {isDebris(selected)
                ? "This fragment is tracked but uncontrolled — part of the orbital-debris hazard."
                : "The craft is drawn at its real size against Earth — a satellite is tens of millions of times smaller than the planet, so zoom right in to see it."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
