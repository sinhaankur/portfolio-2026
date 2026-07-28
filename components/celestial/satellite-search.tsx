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
import { Search, X, Crosshair, Locate, Download } from "lucide-react"
import { loadSatelliteCatalog, selectedSatRef, selectedArchetypeRef, selectedOrbitRef, observerRef, findNearestOverhead, satTypeFilterRef, type SatMeta, type SatOrbit, type NearestSat } from "@/components/universe-engine/satellite-field"
import { statusFromPerigee, lifetimeFromPerigee, lifetimeLabel } from "@/lib/reentry"
import { launchSiteFor } from "@/lib/launch-sites"
import { namedBodies } from "@/components/universe-engine/astronomy"

// The deep-space spacecraft (kind: "spacecraft") — objects that have left Earth
// orbit. Derived once from the astronomy catalogue so search stays in sync.
const SPACECRAFT: { name: string; designation: string }[] = namedBodies
  .filter((b) => b.kind === "spacecraft")
  .map((b) => ({ name: b.name, designation: b.designation }))

const OWNER_LABEL: Record<string, string> = {
  US: "🇺🇸 United States", PRC: "🇨🇳 China", CIS: "🇷🇺 Russia / CIS",
  UK: "🇬🇧 United Kingdom", ESA: "🇪🇺 ESA", JPN: "🇯🇵 Japan", IND: "🇮🇳 India",
  FR: "🇫🇷 France", GER: "🇩🇪 Germany", ITSO: "🌐 Intelsat", TBD: "—",
}

// One baked close-approach record (subset of conjunctions.json used here).
type ObjConjunction = {
  aId: number; aName: string; bId: number; bName: string
  tcaMs: number; missKm: number; relSpeedKms: number
}

// Decay status → colour + label (matches the Re-entry watch panel's read).
const DECAY_TONE: Record<string, string> = {
  imminent: "text-[#ff7a6b]", decaying: "text-[#ffd166]",
  "leo-longterm": "text-[#9fe0ff]", stable: "text-foreground/70",
}
const DECAY_LABEL: Record<string, string> = {
  imminent: "Re-entry imminent", decaying: "Decaying",
  "leo-longterm": "Long-term LEO", stable: "Stable orbit",
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
  // Observer location for the "distance from you" slant range. "idle" until the
  // user asks; "prompt" while the browser dialog is open; "on" once granted;
  // "denied"/"off" if they decline or it's unavailable. Sets the module-level
  // observerRef the R3F field reads each tick.
  const [geoState, setGeoState] = useState<"idle" | "prompt" | "on" | "off">("idle")
  // Nearest-overhead scan result (the object physically closest to you right now).
  const [nearest, setNearest] = useState<NearestSat | null>(null)
  const [scanning, setScanning] = useState(false)
  // Baked conjunction list — to surface THIS object's upcoming close approaches
  // in its risk card (the same data the Conjunction watch panel uses).
  const [conjunctions, setConjunctions] = useState<ObjConjunction[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSatelliteCatalog().then(setCatalog)
    fetch("/data/conjunctions.json")
      .then((r) => r.json())
      .then((d: { conjunctions?: ObjConjunction[] }) => setConjunctions(d.conjunctions ?? []))
      .catch(() => setConjunctions([]))
  }, [])

  // If the site already has location permission (e.g. the "ISS over you" panel
  // used it), light up the slant range automatically — no second prompt.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return
    navigator.permissions.query({ name: "geolocation" }).then((p) => {
      if (p.state === "granted") requestLocation()
    }).catch(() => { /* permissions API unavailable — user can tap the button */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("off"); return }
    setGeoState("prompt")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords
        // satellite.js observerGd wants radians + height in km (ground ≈ 0 is fine
        // for a slant range of hundreds of km).
        observerRef.current = {
          latitude: (latitude * Math.PI) / 180,
          longitude: (longitude * Math.PI) / 180,
          height: (altitude ?? 0) / 1000,
        }
        setGeoState("on")
      },
      () => setGeoState("off"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  }

  // Scan the full catalogue for the object physically closest to you right now.
  // If location isn't shared yet, ask for it first, then the button reads "scan".
  function scanNearest() {
    if (!observerRef.current) { requestLocation(); return }
    setScanning(true)
    // Defer so the "scanning…" label paints before the synchronous SGP4 sweep.
    setTimeout(() => {
      const hit = findNearestOverhead()
      setNearest(hit)
      setScanning(false)
    }, 20)
  }

  // Once location arrives, run the first scan automatically so the panel isn't empty.
  useEffect(() => {
    if (geoState === "on" && !nearest && !scanning) scanNearest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoState])

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

  // This object's upcoming close approaches, pulled from the baked screen.
  const objApproaches = useMemo(() => {
    if (!selected || !conjunctions) return []
    const now = Date.now()
    return conjunctions
      .filter((c) => (c.aId === selected.id || c.bId === selected.id) && c.tcaMs > now - 60_000)
      .map((c) => ({
        other: c.aId === selected.id ? c.bName : c.aName,
        missKm: c.missKm, tcaMs: c.tcaMs, relSpeedKms: c.relSpeedKms,
      }))
      .sort((a, b) => a.missKm - b.missKm)
      .slice(0, 3)
  }, [selected, conjunctions])

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

  // Deep-space spacecraft that have LEFT Earth orbit (Voyagers, Pioneers, New
  // Horizons + the active cruisers). These aren't in the SGP4 catalogue — they
  // live in namedBodies — so search them separately and fly via named:<name>.
  const craftResults = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    return SPACECRAFT.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8)
  }, [q])

  function pick(s: SatMeta) {
    setSelected(s)
    setQ("")
    selectedSatRef.current = s.id
    // Frame Earth so the swarm (and the marker) is on-screen.
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
  }

  // Fly to a deep-space craft — the named-body sky-focus channel (fly + follow).
  function pickCraft(c: { name: string }) {
    setSelected(null)
    setQ("")
    selectedSatRef.current = null
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: `named:${c.name}` } }))
  }

  // Export the selected object's predicted ephemeris (SGP4 → CSV / CCSDS OEM).
  // Needs the TLE, which lives in the full catalogue (SatRecord), so look it up
  // by id. Public data; awareness/education, not operational use.
  const [exporting, setExporting] = useState(false)
  async function exportEphemeris(fmt: "csv" | "oem") {
    if (!selected) return
    setExporting(true)
    try {
      const [{ loadFullCatalog }, eph] = await Promise.all([
        import("@/components/universe-engine/satellite-field"),
        import("@/lib/ephemeris"),
      ])
      const full = await loadFullCatalog()
      const rec = full.find((s) => s.id === selected.id)
      if (!rec) return
      const pts = await eph.computeEphemeris(rec.l1, rec.l2, { startMs: Date.now(), hours: 6, stepS: 60 })
      const base = `${selected.name.replace(/[^\w-]+/g, "_")}_${selected.id}`
      if (fmt === "csv") eph.downloadText(`${base}.csv`, eph.toCSV(selected.name, pts))
      else eph.downloadText(`${base}.oem`, eph.toOEM(selected.name, String(selected.id), pts))
    } finally {
      setExporting(false)
    }
  }

  // Pick a type filter — drive BOTH the results list AND the 3D swarm so the choice
  // is VISIBLE: "Active" isolates the working payloads in the scene (debris hidden),
  // "Debris" isolates the junk, "All" restores everything. Frames Earth so you see it.
  function pickFilter(k: "all" | "active" | "debris") {
    setFilter(k)
    satTypeFilterRef.current = k === "all" ? -1 : k === "active" ? 0 : 1
    window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
  }

  function clearSel() {
    setSelected(null)
    selectedSatRef.current = null
    selectedArchetypeRef.current = null
  }

  // Select + fly to the nearest-overhead result. Resolve the full catalogue entry
  // (for the operator/launch/type detail) from its NORAD id.
  function pickNearest(n: NearestSat) {
    const meta = catalog?.find((s) => s.id === n.id)
    if (meta) pick(meta)
  }

  return (
    <div className="w-full md:w-[min(20rem,calc(100vw-2rem))]">
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

      {/* Active / debris filter — isolate the real junk cloud (LeoLabs-style).
          flex-wrap so the chips never run off a narrow phone. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([
          { k: "all", label: "All" },
          { k: "active", label: `Active · ${counts.active.toLocaleString()}` },
          { k: "debris", label: `Debris · ${counts.debris.toLocaleString()}` },
        ] as const).map((opt) => (
          <button
            key={opt.k}
            type="button"
            onClick={() => pickFilter(opt.k)}
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

      {/* What's overhead right now — nearest object to the user's own location. */}
      <div className="mt-2">
        <button
          type="button"
          onClick={scanNearest}
          disabled={scanning}
          data-cursor-hover
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-accent/40 bg-accent/[0.07] px-3 py-1.5 font-mono text-[9px] tracking-[0.15em] uppercase text-accent hover:bg-accent/15 disabled:opacity-60 transition-colors"
        >
          <Locate className="h-3 w-3" aria-hidden />
          {scanning ? "scanning sky…" : geoState === "on" ? "what's overhead now" : "find what's overhead"}
        </button>

        <AnimatePresence>
          {nearest && (
            <motion.button
              type="button"
              onClick={() => pickNearest(nearest)}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-cursor-hover
              className="mt-1.5 block w-full rounded-lg border border-accent/30 bg-background/80 backdrop-blur-md px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-sm text-foreground truncate">{nearest.name}</span>
                <span className="font-mono text-[11px] tabular-nums text-accent shrink-0">{fmtKm(nearest.slantRangeKm)}</span>
              </span>
              <span className="mt-0.5 block font-mono text-[9px] tracking-wider text-muted-foreground">
                closest to you · {nearest.elevationDeg.toFixed(0)}° above horizon · {fmtKm(nearest.altitudeKm)} up
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Deep-space spacecraft results — the ships that have LEFT Earth (Voyager,
          Pioneer, New Horizons…). Shown above the Earth-orbit catalogue so typing
          "voyager" surfaces it. Flies via the named-body channel. */}
      <AnimatePresence>
        {craftResults.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 rounded-lg border border-accent/40 bg-background/90 backdrop-blur-md divide-y divide-border/60 overflow-hidden"
          >
            <li className="px-3 pt-1.5 pb-1 font-mono text-[9px] tracking-[0.2em] uppercase text-accent/80">Deep-space craft</li>
            {craftResults.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => pickCraft(c)}
                  data-cursor-hover
                  className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors"
                >
                  <span className="block font-sans text-sm text-foreground truncate">{c.name}</span>
                  <span className="block font-mono text-[10px] tracking-wider text-muted-foreground truncate">{c.designation}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

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
              {(() => {
                const site = launchSiteFor(selected.site)
                return site ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Launch site</dt>
                    <dd className="text-foreground text-right">{site.name}<span className="text-muted-foreground"> · {site.country}</span></dd>
                  </div>
                ) : null
              })()}
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
                    <dt className="text-muted-foreground">Distance from you</dt>
                    <dd className="text-right tabular-nums">
                      {geoState === "on" && orbit.slantRangeKm != null ? (
                        <span className="text-accent">
                          {fmtKm(orbit.slantRangeKm)}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {orbit.elevationDeg != null && orbit.elevationDeg >= 0
                              ? `· ${orbit.elevationDeg.toFixed(0)}° up`
                              : "· below horizon"}
                          </span>
                        </span>
                      ) : geoState === "prompt" ? (
                        <span className="text-muted-foreground">locating…</span>
                      ) : geoState === "off" ? (
                        <span className="text-muted-foreground">location unavailable</span>
                      ) : (
                        <button
                          type="button"
                          onClick={requestLocation}
                          className="text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80 transition-colors"
                        >
                          use my location
                        </button>
                      )}
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
                <dt className="text-muted-foreground">Model shown at</dt>
                <dd className="text-foreground text-right">recognizable scale</dd>
              </div>
            </dl>

            {/* Decay & risk — the "what's going to happen to this object" read,
                from its perigee (drag) + any screened close approaches. Public
                space-tech research, made legible: seeing is believing. */}
            {orbit && (() => {
              const status = statusFromPerigee(orbit.perigeeKm)
              const life = lifetimeFromPerigee(orbit.perigeeKm)
              return (
                <div className="mt-3 rounded-lg border border-border/70 bg-background/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground">Decay outlook</span>
                    <span className={`font-mono text-[10px] tracking-wider ${DECAY_TONE[status]}`}>{DECAY_LABEL[status]}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-foreground/75">Est. orbital lifetime</span>
                    <span className="font-mono text-[12px] tabular-nums text-foreground/90">{lifetimeLabel(life)}</span>
                  </div>
                  {/* perigee-height bar — lower perigee = deeper into drag = the
                      visual "how close to falling" read. 150-800 km mapped to 0-100%. */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60" aria-hidden>
                    <div
                      className={`h-full rounded-full ${status === "imminent" ? "bg-[#ff7a6b]" : status === "decaying" ? "bg-[#ffd166]" : "bg-[#9fe0ff]"}`}
                      style={{ width: `${Math.max(4, Math.min(100, ((orbit.perigeeKm - 150) / (800 - 150)) * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[8px] tracking-wider text-muted-foreground">
                    perigee {Math.round(orbit.perigeeKm)} km — lower sinks faster
                  </p>

                  {objApproaches.length > 0 && (
                    <div className="mt-3 border-t border-border/60 pt-2">
                      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#ff9d6b]">Close approaches (24h)</span>
                      <ul className="mt-1.5 space-y-1">
                        {objApproaches.map((a, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="text-foreground/80 truncate">{a.other}</span>
                            <span className="font-mono tabular-nums shrink-0">
                              <span className={a.missKm < 0.5 ? "text-[#ff7a6b]" : a.missKm < 2 ? "text-[#ffd166]" : "text-foreground/70"}>
                                {a.missKm.toFixed(2)} km
                              </span>
                              <span className="ml-1 text-[9px] text-muted-foreground">{a.relSpeedKms.toFixed(1)} km/s</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}

            {isDebris(selected) && debrisOrigin(selected.name) && (
              <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/[0.06] px-3 py-2 font-sans text-[11px] text-foreground/80 leading-relaxed">
                ⚠ {debrisOrigin(selected.name)}
              </p>
            )}
            <p className="mt-3 font-sans text-[11px] text-muted-foreground leading-relaxed">
              Altitude + speed update live from SGP4 propagation of the current-epoch
              orbit; apogee, period and inclination are the orbit's fixed elements. {isDebris(selected)
                ? "This fragment is tracked but uncontrolled — part of the orbital-debris hazard."
                : "The position + altitude are real to scale; the 3D model is enlarged so you can see it — at true 1:1 a satellite is a sub-pixel speck against Earth (the ISS is ~1/117,000th of Earth's width)."}
            </p>

            {/* Ephemeris export — download the next 6 h of predicted state vectors
                (SGP4) as CSV or CCSDS OEM, the formats operators use. Public data;
                awareness/education, not operational use. */}
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">Export ephemeris · next 6 h</p>
              <div className="flex gap-2">
                <button
                  type="button" disabled={exporting}
                  onClick={() => exportEphemeris("csv")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 font-mono text-[9px] tracking-wider uppercase text-foreground/80 hover:border-accent/60 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
                <button
                  type="button" disabled={exporting}
                  onClick={() => exportEphemeris("oem")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-2 font-mono text-[9px] tracking-wider uppercase text-foreground/80 hover:border-accent/60 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Download className="w-3 h-3" /> CCSDS OEM
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
