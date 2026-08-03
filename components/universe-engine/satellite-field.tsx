"use client"

/**
 * SatelliteField — the real ~15,700-satellite catalogue as one GPU points field
 * orbiting Earth, positioned by true SGP4 propagation (satellite.js) and gated
 * to appear on each satellite's real launch date as the timeline scrubs.
 *
 * Data: /data/satellites.json (built by scripts/fetch-satellites.mjs from
 * CelesTrak SATCAT + TLE) — { id, name, owner, launchMs, l1, l2 }.
 *
 * Performance: 15.7k satellites is one draw call (a single <points>). The cost
 * is SGP4 propagation; we recompute positions on a throttle (~4 Hz) rather than
 * every frame, and gate visibility in the vertex shader (zero per-point JS for
 * the launch timeline). Mounted inside Earth's group so it inherits Earth's
 * world transform; sizes are in Earth-radii (earthVisualRadius prop).
 *
 * Selection / isolate: when one satellite is picked (search or click), the swarm
 * hides (shader uIsolate), a real LEOPARD CubeSat GLB rides that satellite's live
 * SGP4 position (oriented along travel), its full orbital path draws as a line,
 * and the camera follows. Only one detailed mesh ever exists, and the full
 * catalogue sweep is skipped while isolated — cheap enough for mobile.
 *
 * Honest limitation: TLEs are current-epoch, so positions are accurate for
 * ~now; scrubbing deep into the past still shows satellites appearing on their
 * real launch dates but on their present orbits (surfaced in the UI copy).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useGLTF, Line, Html } from "@react-three/drei"
import * as THREE from "three"
import { simTimeRef, requestFollow, focusDepthRef, daysSinceJ2000, earthRotationAngle, timeScaleRef, REALTIME_TIME_SCALE } from "./astronomy"
import { perfTierRef } from "@/lib/device-tier"
import { launchSiteFor } from "@/lib/launch-sites"

/**
 * Satellite archetypes — a small library of real-design Blender models picked by
 * the selected satellite's name / operator / orbit, so "every satellite has its
 * own design" without 15.7k individual meshes. The swarm stays a points field;
 * only the focused craft gets geometry, and which model it gets depends on what
 * it actually is.
 *
 *  realSpanM   real-world deployed span (m) — drives TRUE 1:1 scale vs Earth
 *  nativeSpan  the GLB's native width in model units (measured at export)
 *  k           scale coefficient: trueScale = k * earthVisualRadius
 */
type ArchetypeId = "cubesat" | "starlink" | "starlink2" | "gps" | "comsat" | "debris" | "rocketbody" | "telescope" | "hubble" | "station" | "weather" | "smallsat" | "iss" | "oneweb" | "kuiper" | "iridium" | "eobus"
type Archetype = { url: string; label: string; realSpanM: number; nativeSpan: number; k: number }
function mkArch(url: string, label: string, realSpanM: number, nativeSpan: number): Archetype {
  return { url, label, realSpanM, nativeSpan, k: realSpanM / 1000 / 6371 / nativeSpan }
}
const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  cubesat:    mkArch("/models/satellite-leopard.glb",  "CubeSat",            1.7, 15.84),
  starlink:   mkArch("/models/satellite-starlink.glb", "Starlink v1 flat-pack", 30, 26.97),
  // v2 Mini — the current generation (~7k on orbit): twin 12 m wings where
  // v1.5 had one. Split from v1 by launch date (v2 Mini flights began
  // 2023-02) — the catalog name alone can't tell the generations apart.
  starlink2:  mkArch("/models/satellite-starlink2.glb", "Starlink v2 Mini", 30, 23.9),
  gps:        mkArch("/models/satellite-gps.glb",      "GPS III-class nav craft", 17, 15.98),
  comsat:     mkArch("/models/satellite-dish.glb",     "Dish comsat",        35, 12.22),
  debris:     mkArch("/models/satellite-debris.glb",   "Debris fragment",     1.5, 1.09),
  rocketbody: mkArch("/models/satellite-rocketbody.glb","Spent upper stage (Falcon 9-class)", 13.8, 13.6),
  telescope:  mkArch("/models/satellite-telescope.glb","Space telescope",     13, 7.5),
  // Hubble gets its own faithful model (silver foil body, forward aperture door,
  // two long solar-array wings, high-gain antenna dishes) — build_hubble_glb.py.
  // Real span ~13.2 m (body) but the wings dominate the silhouette (~2.88 native).
  hubble:     mkArch("/models/craft-hubble.glb",       "Hubble Space Telescope", 13.2, 2.88),
  station:    mkArch("/models/satellite-station.glb",  "Space station",      109, 6.75),
  weather:    mkArch("/models/satellite-weather.glb",  "Weather / GEO sat",   24, 4.5),
  smallsat:   mkArch("/models/satellite-smallsat.glb", "Smallsat",             2.0, 4.3),
  // Flagship of the one-satellite-at-a-time program: faithful ISS (8 wings in
  // 4 pairs, full module stack, radiator banks) — build_iss_detailed.py.
  iss:        mkArch("/models/iss.glb",                "International Space Station", 109, 11.27),
  // Constellation craft — the top actors in the conjunction screening list,
  // built to published proportions (build_constellation_sats.py). Kuiper's
  // real design isn't public: modelled as the known envelope, and the label
  // says so — never present a guess as the real craft.
  oneweb:     mkArch("/models/satellite-oneweb.glb",   "OneWeb bus",          5.6, 2.39),
  eobus:      mkArch("/models/satellite-eobus.glb",    "Earth-observation bus (Sentinel-class)", 12, 7.45),
  kuiper:     mkArch("/models/satellite-kuiper.glb",   "Kuiper flat-bus (approx.)", 9.0, 4.48),
  iridium:    mkArch("/models/satellite-iridium.glb",  "Iridium NEXT",        9.4, 9.07),
}
// SAT-3: a curated set of NOTABLE, recognizable craft that always ride their
// real orbits as actual 3D hardware (not just dots) — so the scene shows the
// famous machines where they really are. Real NORAD ids from the catalogue.
type NotableCraft = { id: number; label: string; arch: ArchetypeId }
const NOTABLE_CRAFT: NotableCraft[] = [
  { id: 25544, label: "ISS",      arch: "iss" },
  { id: 20580, label: "Hubble",   arch: "hubble" },
  { id: 48274, label: "Tiangong", arch: "station" },
]
// The always-on notable riders (ISS/Hubble/Tiangong) are shown at a legible
// boosted scale (labeled markers you can spot from orbit-overview distance).
// The SELECTED craft is different: it renders TRUE 1:1 — see the marker
// group below — because the chase-follow frames it at a span-proportional
// distance, so a 109 m station and a 1.5 m debris shard each fill a sane
// fraction of the screen at arrival while their PROPORTIONS stay honest.
const NOTABLE_VISIBLE_SPAN = 0.03 // scene units — boosted marker span
// Selected-craft scale: real metres × this. Proportions between craft are
// REAL; the shared boost is a float32-precision necessity (see the selection
// block), not a per-craft fudge.
const SELECTED_SCALE_BOOST = 1200
// FLOAT32 PRECISION FLOOR — the fix for "small selected craft (Iridium, OneWeb,
// debris) render as nothing". Earth sits at world-coord ~66 (SUN_OFFSET_SCENE+3);
// float32's representable step there is ~7.9e-6 scene units. A craft's rendered
// span = realSpanM/1000/6371 × earthVisualRadius(0.05) × BOOST, so a 9.4 m Iridium
// lands at ~8.9e-5 units — only ~11 precision steps — and its near-plane at ~4
// steps, so the z-buffer collapses it into invisibility. The ISS (109 m, ~1e-3 ≈
// 130 steps) survives; every small craft doesn't. Clamping the rendered span to a
// floor comfortably above the wall makes EVERY craft visible. Proportions stay
// honest among craft already above the floor (GPS↑); only sub-~40 m craft get
// lifted to a shared minimum — the right trade: visible-and-slightly-uniform beats
// true-ratio-and-invisible. (The exact-proportion path is the local-render-frame
// refactor, logged for the Satellite Engine's deep-zoom detail tiers.)
const MIN_VISIBLE_SPAN = 1.0e-3 // ≈ ISS render span ≈ 130 float32 steps @ world66
/** Lift a craft's true rendered span above the precision floor so it's always
 *  visible against Earth — but with a SOFT floor that PRESERVES relative order:
 *  a hard max() would flatten every sub-ISS craft to one identical size (a 1.5 m
 *  shard would look as big as a 30 m Starlink). Instead we map trueSpan through
 *  span = sqrt(true² + MIN²): well above MIN it's ≈ trueSpan (real proportion
 *  preserved), well below it asymptotes to MIN (visible), and in between it grows
 *  monotonically — so a bigger craft is still drawn bigger. Better-than-LeoLabs
 *  read: everything is findable AND the size still carries honest information.
 *  Returns { span, lift } — lift ≥ 1 is the model-scale multiplier. */
function clampSpan(trueSpan: number): { span: number; lift: number } {
  const span = Math.sqrt(trueSpan * trueSpan + MIN_VISIBLE_SPAN * MIN_VISIBLE_SPAN)
  return { span, lift: span / trueSpan }
}

// Archetype GLBs (~2.7 MB) are preloaded from SatelliteField's mount effect —
// NOT at module init. This module is statically imported by scene.tsx, so a
// module-scope preload would fire for every home visitor; the field itself
// only mounts once Earth is focused with satellites toggled on, and selecting
// a satellite (the moment a GLB is actually shown) comes clicks later.

/** Pick an archetype from the satellite's type, name, operator, and orbit
 *  altitude. Debris + rocket bodies get their own shapes (not a clean sat). */
export function classifyArchetype(name: string, owner: string, altKm: number, type?: string, launchMs?: number): ArchetypeId {
  if (type === "DEB") return "debris"
  if (type === "R/B") return "rocketbody"
  const n = name.toUpperCase()
  // The ISS gets its own faithful model; other crewed stations share the bus.
  // Word-anchored — a bare includes("ISS") handed SWISSCUBE the station model.
  if (n.startsWith("ISS ") || n === "ISS" || n.includes("ZARYA")) return "iss"
  if (n.includes("TIANGONG") || n.includes("CSS (") || n.includes("MIR") || n.includes("TIANHE"))
    return "station"
  // The real Hubble is catalogued as HST. "HUBBLE N" and LEMUR-2-HUBBLE-* are
  // Hubble Network's 3U BLE cubesats — smallsats, not the telescope.
  if (n === "HST" || n.includes("HUBBLE SPACE")) return "hubble"
  if (n.includes("HUBBLE")) return "smallsat"
  // Space telescopes / observatories
  if (n.includes("KEPLER") || n.includes("TESS") ||
      n.includes("SPITZER") || n.includes("CHANDRA") || n.includes("JWST") || n.includes("WEBB") ||
      n.includes("GAIA") || n.includes("XMM") || n.includes("TELESCOPE"))
    return "telescope"
  if (n.includes("STARLINK"))
    return launchMs !== undefined && launchMs >= Date.UTC(2023, 1, 1) ? "starlink2" : "starlink"
  if (n.includes("ONEWEB")) return "oneweb"
  if (n.includes("KUIPER")) return "kuiper"
  if (n.includes("IRIDIUM")) return "iridium"
  if (n.includes("GPS") || n.includes("GLONASS") || n.includes("GALILEO") ||
      n.includes("NAVSTAR") || n.includes("BEIDOU") || n.includes("IRNSS") || n.includes("QZS"))
    return "gps"
  // Weather / Earth-observation buses (often GEO or sun-sync)
  if (n.includes("GOES") || n.includes("METEOSAT") || n.includes("HIMAWARI") ||
      n.includes("NOAA") || n.includes("METOP") || n.includes("FENGYUN") || n.includes("INSAT"))
    return "weather"
  // Dedicated earth-observation buses (sun-sync imagers/radar)
  if (n.includes("SENTINEL") || n.includes("LANDSAT") || n.includes("TERRA") ||
      n.includes("AQUA") || n.includes("SPOT") || n.includes("PLEIADES") ||
      n.includes("WORLDVIEW") || n.includes("GEOEYE") || n.includes("CARTOSAT") ||
      n.includes("RESOURCESAT") || n.includes("RADARSAT") || n.includes("KOMPSAT") ||
      n.includes("GAOFEN"))
    return "eobus"
  // Small commercial constellations / cubesats
  if (n.includes("FLOCK") || n.includes("DOVE") || n.includes("SUPERDOVE") ||
      n.includes("LEMUR") || n.includes("SPIRE") || n.includes("ICEYE") || n.includes("CUBESAT"))
    return "smallsat"
  // navigation lives at MEO (~19,000–23,000 km); comms/weather at GEO (~35,786 km)
  if (altKm > 30000) return "comsat"
  if (altKm > 15000) return "gps"
  return "cubesat"
}

/**
 * Selection bridge — the explorer's search box (DOM) writes the chosen NORAD id
 * here; SatelliteField (R3F) reads it to highlight + follow + ring the satellite.
 * Module-scoped ref mirrors the engine's flyToRef/followRef loose-coupling.
 */
export const selectedSatRef: { current: number | null } = { current: null }

/** The chosen archetype label for the selected satellite (e.g. "Starlink
 *  flat-pack"), so the DOM search card can name what kind of craft it is. */
export const selectedArchetypeRef: { current: string | null } = { current: null }

/** The chosen archetype ID (e.g. "hubble", "starlink2") — lets the DOM card look
 *  up the craft's curated anatomy + build spec (CRAFT_ANATOMY, exported below). */
export const selectedArchetypeIdRef: { current: string | null } = { current: null }

/** Live orbital readout for the selected satellite — derived from its SGP4
 *  satrec (inclination, apogee/perigee) + live propagation (altitude, speed).
 *  The DOM search card polls this to show real numbers, not just a label.
 *   altitudeKm  current height above Earth's surface
 *   speedKms    current orbital speed
 *   apogeeKm/perigeeKm  farthest/closest altitude of the orbit
 *   periodMin   time for one revolution
 *   inclinationDeg  tilt of the orbital plane vs the equator
 *   regime      human label for the orbit band (LEO/MEO/GEO/HEO) */
export type SatOrbit = {
  altitudeKm: number
  speedKms: number
  apogeeKm: number
  perigeeKm: number
  periodMin: number
  inclinationDeg: number
  regime: string
  // Live sub-satellite point — the spot on Earth it's directly over right now.
  subLatDeg: number
  subLonDeg: number
  // Live distance from the user's own location (slant range, straight line) and
  // how high above their horizon the object sits. null until they grant location
  // — altitudeKm (height above ground) is always known; this is "far from ME".
  slantRangeKm: number | null
  elevationDeg: number | null
  // Live TIME / lighting state — the "when + is it lit" layer, updated per frame:
  //   sunlit          catching the sun right now vs in Earth's shadow (eclipse).
  //   orbitsPerDay    revolutions per day (86400 / period-seconds).
  //   groundSpeedKms  speed of the sub-satellite point over the ground — the
  //                   shadow's pace, always < orbital speed (Earth's radius vs
  //                   orbital radius), the intuitive "how fast it crosses the sky".
  sunlit: boolean
  orbitsPerDay: number
  groundSpeedKms: number
}
export const selectedOrbitRef: { current: SatOrbit | null } = { current: null }

/** The user's own location, in RADIANS (satellite.js observerGd form), set by the
 *  search card once geolocation is granted. While null, the slant-range readout
 *  stays "—". Height is metres → km-agnostic (satellite.js takes km); ground level
 *  is a fine approximation for a distance that runs to hundreds/thousands of km. */
export const observerRef: {
  current: { longitude: number; latitude: number; height: number } | null
} = { current: null }

/** Bridge refs the field publishes once the catalogue + satellite.js load, so the
 *  DOM card can scan the whole catalogue on demand (nearest-overhead) without
 *  re-fetching or re-parsing anything. satrecsRef is aligned index-for-index with
 *  satsRef. Both stay null until the field has mounted + loaded. */
export const satLibRef: { current: Sgp4 | null } = { current: null }
export const satrecsRef: { current: unknown[] } = { current: [] }
export const satsRef: { current: Sat[] } = { current: [] }

export type NearestSat = {
  id: number
  name: string
  slantRangeKm: number
  elevationDeg: number
  altitudeKm: number
}

/** The COSPAR international designator's LAUNCH part — TLE line 1, columns
 *  10–14 (0-based 9–13): "YYNNN" (year + launch number). Every object put up by
 *  the SAME launch shares it (piece A = payload, B/C… = rocket body + debris).
 *  This is the honest key for "what else came from this launch" — real shared
 *  catalog data, never inferred. Returns "" if the TLE has no designator. */
export function launchDesignator(l1?: string): string {
  if (!l1 || l1.length < 14) return ""
  return l1.slice(9, 14).trim()
}

export type LaunchMate = {
  id: number
  name: string
  type: "PAY" | "R/B" | "DEB" | string
  piece: string // the COSPAR piece letters (e.g. "A", "C", "BK")
  altitudeKm: number | null
}

/** Every OTHER tracked object from the same launch as `satId` — its spent
 *  rocket body and any catalogued fragments/debris — each with its current
 *  altitude. Honest: only what the catalogue actually carries (most normal
 *  launches list just the payload; the big fragmentation events list their
 *  whole cloud). Returns [] when there are no launch-mates in the data. */
export function launchMatesFor(satId: number, atMs: number = Date.now()): LaunchMate[] {
  const sats = satsRef.current
  const recs = satrecsRef.current
  const lib = satLibRef.current
  if (!sats || sats.length === 0) return []
  const self = sats.find((s) => s.id === satId)
  if (!self) return []
  const launch = launchDesignator(self.l1)
  if (!launch) return []
  const date = new Date(clampToSpaceAge(atMs))
  let gmst = 0
  try { gmst = lib ? lib.gstime(date) : 0 } catch { gmst = 0 }
  const out: LaunchMate[] = []
  for (let i = 0; i < sats.length; i++) {
    const s = sats[i]
    if (s.id === satId) continue
    if (launchDesignator(s.l1) !== launch) continue
    // altitude via SGP4 (best-effort; null if it won't propagate).
    let altitudeKm: number | null = null
    try {
      const r = lib && recs[i] ? (lib.propagate(recs[i] as never, date) as { position?: Vec3 }) : null
      const p = finitePos(r)
      if (p) altitudeKm = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - 6371
    } catch { /* leave null */ }
    out.push({
      id: s.id,
      name: s.name,
      type: s.type ?? "",
      piece: s.l1.length >= 17 ? s.l1.slice(14, 17).trim() : "", // COSPAR piece letters
      altitudeKm,
    })
  }
  // rocket bodies first, then debris, then other payloads; by altitude within.
  const rank = (t: string) => (t === "R/B" ? 0 : t === "DEB" ? 1 : 2)
  out.sort((a, b) => rank(a.type) - rank(b.type) || (b.altitudeKm ?? 0) - (a.altitudeKm ?? 0))
  return out
}

/** Scan the FULL catalogue for the object physically closest to the user right now
 *  (smallest slant range), among those actually above their horizon. One SGP4 pass
 *  over ~18.7k records (~a few hundred ms) — call on demand, not per frame. Returns
 *  null if location isn't shared or the catalogue hasn't loaded. The elevation gate
 *  (>0°) is the honest filter: an object below the horizon is on the far side of
 *  Earth — "nearest" should mean nearest thing you could actually look up at. */
export function findNearestOverhead(atMs: number = Date.now()): NearestSat | null {
  const lib = satLibRef.current
  const obs = observerRef.current
  const recs = satrecsRef.current
  const sats = satsRef.current
  if (!lib || !obs || recs.length === 0) return null
  const date = new Date(clampToSpaceAge(atMs))
  let gmst: number
  try { gmst = lib.gstime(date) } catch { return null }
  let best: NearestSat | null = null
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i]
    if (!rec) continue
    let r: { position?: Vec3 } | false = false
    try { r = lib.propagate(rec, date) } catch { r = false }
    const p = finitePos(r)
    if (!p) continue
    const ecf = lib.eciToEcf(p, gmst)
    const la = lib.ecfToLookAngles(obs, ecf)
    if (la.elevation <= 0) continue // below horizon — far side of Earth
    if (best && la.rangeSat >= best.slantRangeKm) continue
    const s = sats[i]
    best = {
      id: s?.id ?? -1,
      name: s?.name ?? "Unknown",
      slantRangeKm: la.rangeSat,
      elevationDeg: (la.elevation * 180) / Math.PI,
      altitudeKm: Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - EARTH_RADIUS_KM,
    }
  }
  return best
}

/** Name the orbit band from apogee/perigee — the quick "where does it live?"
 *  read most people recognise (ISS = LEO, GPS = MEO, comsats = GEO). */
function orbitRegime(apogeeKm: number, perigeeKm: number): string {
  const mean = (apogeeKm + perigeeKm) / 2
  const ecc = (apogeeKm - perigeeKm) / (apogeeKm + perigeeKm + 2 * EARTH_RADIUS_KM)
  if (ecc > 0.25) return "Highly elliptical (HEO)"
  if (mean < 2000) return "Low Earth orbit (LEO)"
  if (mean < 34000) return "Medium Earth orbit (MEO)"
  if (mean < 37000) return "Geostationary (GEO)"
  return "High orbit"
}

export type SatMeta = { id: number; name: string; owner: string; type?: "PAY" | "R/B" | "DEB"; launchMs: number; site?: string }

/** Constellation/group filter — view one layer at a time or everything at
 *  once. The HUD chips write this ref; the field reads it per-frame into a
 *  shader uniform. -1 = all groups. */
export const SAT_GROUPS = [
  "Starlink",
  "OneWeb",
  "Navigation",
  "Stations",
  "Debris",
  "Rocket bodies",
  "Other",
] as const
export const satGroupFilterRef: { current: number } = { current: -1 }

/** "Show all" override: when true, the overview LOD cull stands down entirely so
 *  the FULL ~18.6k catalogue is visible at once, even from far out (Ankur: "I wish
 *  we could see all the satellites at once"). Off by default — the cull keeps the
 *  far view from becoming a solid crust that hides Earth. Toggled from the HUD. */
export const showAllSatsRef: { current: boolean } = { current: false }

/** Real fragmentation-event families — the collisions + ASAT tests that created
 *  the biggest tracked debris clouds. name-prefix → a family id, so the swarm can
 *  isolate one cloud (e.g. all ~1,900 Fengyun-1C fragments) to make the scale of
 *  a single event VISIBLE. Order fixed = the id. */
export const DEBRIS_FAMILIES = [
  { id: 0, prefix: "FENGYUN 1C", label: "Fengyun-1C", event: "China ASAT test", year: 2007 },
  { id: 1, prefix: "COSMOS 2251", label: "Cosmos-2251", event: "Iridium collision", year: 2009 },
  { id: 2, prefix: "IRIDIUM 33", label: "Iridium-33", event: "Cosmos collision", year: 2009 },
  { id: 3, prefix: "COSMOS 1408", label: "Cosmos-1408", event: "Russia ASAT test", year: 2021 },
] as const
/** Family filter for the swarm: -1 = no family isolated, else a DEBRIS_FAMILIES id. */
export const debrisFamilyFilterRef: { current: number } = { current: -1 }

/** Object-type filter for the swarm, driven by the search card's ALL/ACTIVE/DEBRIS
 *  chips so the choice is VISIBLE in the 3D scene (not just the results list):
 *  -1 = all · 0 = active payloads only (debris hidden) · 1 = debris/rocket only. */
export const satTypeFilterRef: { current: number } = { current: -1 }

/** Classify a debris object into a fragmentation family id, or -1 if none. */
export function classifyDebrisFamily(name: string): number {
  const n = name.toUpperCase()
  for (const f of DEBRIS_FAMILIES) if (n.startsWith(f.prefix)) return f.id
  return -1
}

/** Orbit-REGIME filter (set by the census panel): -1 = all, else 0=LEO 1=MEO
 *  2=GEO 3=HEO. Parallel to the group filter; both AND together in the shader. */
export const satRegimeFilterRef: { current: number } = { current: -1 }

/** Classify a catalogue object into an orbit-regime id from its real TLE
 *  elements (0=LEO, 1=MEO, 2=GEO, 3=HEO). Same thresholds as lib/sat-inventory. */
export function classifyRegimeId(l2: string): number {
  const mm = parseFloat(l2.substring(52, 63))
  if (!(mm > 0)) return 0
  const ecc = parseFloat("0." + l2.substring(26, 33).trim())
  if (ecc > 0.25) return 3 // HEO
  const n = (mm * 2 * Math.PI) / 86400
  const a = Math.cbrt(398600.4418 / (n * n))
  const alt = a - 6371
  if (alt < 2000) return 0  // LEO
  if (alt < 34000) return 1 // MEO
  if (alt < 37000) return 2 // GEO
  return 1
}

/** Classify a catalogue object into a viewing group (name/type based). */
export function classifyGroup(name: string, type?: string): number {
  if (type === "DEB") return 4
  if (type === "R/B") return 5
  const n = name.toUpperCase()
  if (n.includes("STARLINK")) return 0
  if (n.includes("ONEWEB")) return 1
  if (/NAVSTAR|GPS |GLONASS|GALILEO|BEIDOU|BDS[- ]|IRNSS|QZS/.test(n)) return 2
  if (/ISS \(|ZARYA|TIANHE|CSS \(|TIANGONG/.test(n)) return 3
  return 6
}

// Full catalogue record — id/name/owner/type/launch + the raw TLE lines the
// SGP4 propagator needs. Kept as one shape so every consumer shares ONE fetch.
export type SatRecord = SatMeta & { l1: string; l2: string }

// Shared FULL-catalogue cache. The 4.3 MB satellites.json is fetched + parsed
// exactly ONCE here; the field (which needs TLEs), the search box (metadata
// only), and the conjunction screener all derive from this single promise
// instead of each re-downloading the file.
let _fullCatalogPromise: Promise<SatRecord[]> | null = null
export function loadFullCatalog(): Promise<SatRecord[]> {
  if (!_fullCatalogPromise) {
    _fullCatalogPromise = fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d) => d.sats as SatRecord[])
      .catch(() => [])
  }
  return _fullCatalogPromise
}

/** Metadata-only view of the catalogue (for the search box). Derived from the
 *  shared full-catalogue fetch — no second download. */
export function loadSatelliteCatalog(): Promise<SatMeta[]> {
  return loadFullCatalog().then((sats) =>
    sats.map((s) => ({ id: s.id, name: s.name, owner: s.owner, type: s.type, launchMs: s.launchMs, site: s.site })),
  )
}

// satellite.js is imported DYNAMICALLY (below), not at the top level — a static
// import drags it into the Turbopack build graph and hangs `next build`. Loading
// it lazily at runtime keeps the production build fast and the SGP4 code out of
// the initial chunk.
type Vec3 = { x: number; y: number; z: number }
type Sgp4 = {
  twoline2satrec: (l1: string, l2: string) => unknown
  propagate: (rec: unknown, date: Date) => { position?: Vec3; velocity?: Vec3 } | false
  gstime: (date: Date) => number
  eciToGeodetic: (eci: Vec3, gmst: number) => { latitude: number; longitude: number; height: number }
  degreesLat: (rad: number) => number
  degreesLong: (rad: number) => number
  // Observer-relative geometry — the "how far from me right now" slant range.
  degreesToRadians: (deg: number) => number
  eciToEcf: (eci: Vec3, gmst: number) => Vec3
  ecfToLookAngles: (
    observer: { longitude: number; latitude: number; height: number },
    ecf: Vec3,
  ) => { azimuth: number; elevation: number; rangeSat: number }
}
// SGP4 satrec fields we read for the orbital readout (satellite.js@5 names).
type SatRec = { inclo?: number; alta?: number; altp?: number; no?: number; ecco?: number }

const EARTH_RADIUS_KM = 6371

/**
 * SGP4 cost budget by device tier. Propagating ~18,600 satellites is a constant
 * main-thread tax; a fixed budget that's fine on a desktop drops a mid laptop or
 * phone below 60fps and reads as "lag". So scale BOTH the refresh cadence and the
 * per-frame batch to the tier:
 *   - recomputeMs — how often positions refresh (higher = fewer SGP4 calls/sec).
 *     The LERP keeps the swarm gliding between refreshes, so a slower cadence is
 *     nearly invisible but much cheaper.
 *   - sweepFrames — how many frames a full catalogue pass is spread across (more
 *     frames = less work per frame = no single-frame stall).
 * High/ultra get the crisp 4 Hz; low/mid trade a little freshness for smoothness.
 */
function satBudget(): { recomputeMs: number; sweepFrames: number } {
  switch (perfTierRef.current) {
    case "ultra": return { recomputeMs: 250, sweepFrames: 12 }
    case "high":  return { recomputeMs: 300, sweepFrames: 16 }
    case "low":   return { recomputeMs: 600, sweepFrames: 30 }
    case "mid":
    default:      return { recomputeMs: 450, sweepFrames: 22 }
  }
}

// Scratch vector for the per-frame overview-LOD measurement (no allocation).
const _fieldWorld = new THREE.Vector3()
// Chase-frame scratch (travel direction + radial-out for the follow camera).
const _sfQ = new THREE.Quaternion()
const _sfT = new THREE.Vector3()
const _sfUp = new THREE.Vector3()
const _sfE = new THREE.Vector3()
const UP_Y = new THREE.Vector3(0, 1, 0) // Earth's spin axis in scene space
const _haloTmpQ = new THREE.Quaternion() // scratch for billboarding the locator ring

// SHELL EXPANSION (Ankur: "spacing can be expanded... like actual spacing"): at
// true scale, LEO sits only 6–30% above the surface, so 18k objects pile into a
// thin crust and overlap. We keep Earth's surface fixed but EXAGGERATE altitude —
// each object's height above the surface is multiplied — so the shell spreads out
// and satellites get real breathing room, individually legible. Honest + reversible:
// the surface stays true, only the empty gap to orbit is stretched (a MODE, like the
// engine's compressRadius for the solar system). scaledR maps a geocentric radius
// (km) → an expanded geocentric radius (km) still anchored at the surface.
const SHELL_EXPAND = 4.0
function expandR(rKm: number): number {
  const alt = rKm - EARTH_RADIUS_KM
  return EARTH_RADIUS_KM + Math.max(0, alt) * SHELL_EXPAND
}
/** A propagated position is USABLE only if it exists and every component is
 *  finite. SGP4 (satellite.js) returns NaN/Inf — without throwing — when the
 *  timeline is scrubbed far from a TLE's epoch (centuries/millennia). A single
 *  NaN that reaches the geometry makes three.js's bounding-sphere → frustum-cull
 *  → raycast machinery spin, which is the far-past-date FREEZE. Gate every
 *  propagate() result through this. */
function finitePos(
  r: { position?: { x: number; y: number; z: number } } | false | null | undefined,
): { x: number; y: number; z: number } | null {
  const p = r && r.position
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null
  return p
}

/** Scale an ECI position (km) radially by the shell expansion, returning the new
 *  x/y/z (km). Direction preserved; only the radius is stretched above the surface. */
function expandEci(x: number, y: number, z: number): [number, number, number] {
  const r = Math.sqrt(x * x + y * y + z * z)
  if (r < 1e-6) return [x, y, z]
  const s = expandR(r) / r
  return [x * s, y * s, z * s]
}

// Never thin the swarm below this many visible LEO dots: in the sparse eras
// (scrub to 1965 — a few hundred objects total) or a small filtered group,
// the pixel-budget cull would misrepresent an almost-empty sky as emptier.
const MIN_VISIBLE_DOTS = 2400

// Syncom 2, 26 Jul 1963 — the first geosynchronous satellite. The GEO guide
// ring is an annotation of a real populated belt; before this date there was
// no belt to annotate.
const FIRST_GEO_MS = Date.UTC(1963, 6, 26)

// SGP4 is a near-epoch model: propagate a TLE centuries — let alone the timeline's
// full ±5000-year span — from its epoch and satellite.js grinds through diverging
// deep-space terms and returns NaN, which is what froze the page on a far-past
// scrub. Clamp the date fed to propagate() to the space age (Sputnik → +50y). The
// swarm's shader already launch-gates each object by its real launch date, so a
// clamped position outside its lifetime is invisible anyway — clamping only spares
// us the pathological math, it doesn't show satellites where they didn't exist.
const SPACE_AGE_START_MS = Date.UTC(1957, 9, 4) // Sputnik 1
const SPACE_AGE_END_MS = Date.UTC(2075, 0, 1)   // ~50y ahead — well past any TLE's usefulness
const clampToSpaceAge = (ms: number) =>
  ms < SPACE_AGE_START_MS ? SPACE_AGE_START_MS : ms > SPACE_AGE_END_MS ? SPACE_AGE_END_MS : ms

// Debris + rocket bodies read as a hazard colour (dull red/amber), distinct from
// the altitude-band palette — the LeoLabs-style "junk vs active" separation.
const DEBRIS_COLOR: [number, number, number] = [1.0, 0.42, 0.32]
const RB_COLOR: [number, number, number] = [1.0, 0.62, 0.4]

// OBJECT-TYPE palette — matches LeoLabs' legend exactly (Payload green, Rocket
// Body yellow, Debris red, Unknown grey-blue). Colouring by what the object IS
// (not its altitude) is their signature read + arguably more truthful: a green
// dot is a working payload, a red one is tracked junk. This is the DEFAULT.
// Brightened so the dots pop against Earth (they read as emissive points, like
// LeoLabs' luminous green/red cloud).
const TYPE_PAYLOAD: [number, number, number] = [0.45, 1.0, 0.55]   // bright green
const TYPE_ROCKET:  [number, number, number] = [1.0, 0.9, 0.35]    // bright yellow
const TYPE_DEBRIS:  [number, number, number] = [1.0, 0.42, 0.38]   // bright red
const TYPE_UNKNOWN: [number, number, number] = [0.7, 0.78, 0.95]   // bright grey-blue

/** Colour by object class (LeoLabs style). */
function typeColor(type?: SatType): [number, number, number] {
  if (type === "PAY") return TYPE_PAYLOAD
  if (type === "R/B") return TYPE_ROCKET
  if (type === "DEB") return TYPE_DEBRIS
  return TYPE_UNKNOWN
}

// Altitude-BAND palette — the real LeoLabs read: colour by orbital regime so the
// shell has visible structure (a bright LEO band, a polar layer, the MEO nav
// ring, the thin GEO belt) instead of a uniform operator-coloured haze. These
// match the on-screen Satellites legend exactly.
const BAND_LEO: [number, number, number]   = [0.62, 0.88, 1.0]   // #9fe0ff LEO
const BAND_POLAR: [number, number, number] = [0.75, 0.92, 0.80]  // #bfeacb polar / sun-sync
const BAND_MEO: [number, number, number]   = [1.0, 0.82, 0.48]   // #ffd27a MEO nav
const BAND_GEO: [number, number, number]   = [1.0, 0.60, 0.42]   // #ff9a6b GEO belt

/** Parse mean motion (rev/day) + inclination straight from TLE line 2, then
 *  derive the orbit's altitude → pick an altitude-band colour. No propagation:
 *  the elements are right there in the TLE, so this is cheap for all ~18k. */
function bandColor(l2: string, type?: SatType): [number, number, number] {
  if (type === "DEB") return DEBRIS_COLOR
  if (type === "R/B") return RB_COLOR
  const meanMotion = parseFloat(l2.substring(52, 63)) // rev/day
  const inclDeg = parseFloat(l2.substring(8, 16))
  if (!(meanMotion > 0)) return BAND_LEO
  const nRadS = (meanMotion * 2 * Math.PI) / 86400
  const MU = 398600.4418 // km^3/s^2
  const aKm = Math.cbrt(MU / (nRadS * nRadS))
  const altKm = aKm - EARTH_RADIUS_KM
  if (altKm > 32000) return BAND_GEO
  if (altKm > 8000) return BAND_MEO
  // LEO: split polar / sun-sync (high inclination) from the equatorial-ish shell
  if (inclDeg >= 80) return BAND_POLAR
  return BAND_LEO
}

type SatType = "PAY" | "R/B" | "DEB"
type Sat = { id: number; name: string; owner: string; type?: SatType; launchMs: number; l1: string; l2: string }

// Launch-gating uses days-since-J2000 (small → exact in a float32 shader uniform).
// Reuse the engine's canonical J2000 epoch + day helper (see astronomy.ts).
const msToJ2000Day = (ms: number) => daysSinceJ2000(ms)

// MODELED debris lifetime — a rough perigee-based re-entry forecast (drag falls
// off exponentially with altitude), used ONLY to visualize orbital decay as the
// timeline plays forward: junk sinks out of the sky over years-to-centuries.
// This is a labeled heuristic, NOT tracking data — real decay depends on
// mass/area and solar activity the catalogue doesn't carry.
function modeledLifetimeDays(perigeeKm: number): number {
  if (perigeeKm < 200) return 30
  if (perigeeKm < 300) return 240
  if (perigeeKm < 400) return 365 * 2.5
  if (perigeeKm < 500) return 365 * 9
  if (perigeeKm < 600) return 365 * 25
  if (perigeeKm < 800) return 365 * 90
  if (perigeeKm < 1000) return 365 * 400
  return 365 * 5000
}

/** TLE epoch (line 1 cols 19–32, YYDDD.DDDD…) → days since J2000. */
function tleEpochDay(l1: string): number {
  const yy = parseInt(l1.substring(18, 20), 10)
  const doy = parseFloat(l1.substring(20, 32))
  if (!Number.isFinite(yy) || !Number.isFinite(doy)) return 0
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return daysSinceJ2000(Date.UTC(year, 0, 1)) + (doy - 1)
}

const VERT = /* glsl */ `
  // NOTE: launch gating uses DAYS-since-J2000, not epoch-milliseconds. A GLSL
  // float is 32-bit (~24-bit mantissa, exact only to ~16.7M), so epoch-ms values
  // (~1.8e12 today) lose ~10^5 ms of precision — enough to corrupt the
  // 'launched yet?' comparison and leak pre-Space-Age satellites. Days-since-J2000
  // (|value| < ~25,000) is exact in float32, so the gate is reliable.
  attribute float aLaunchDay;   // days since J2000 (2000-01-01 12:00 UTC)
  attribute float aDecayDay;    // MODELED re-entry day (debris/rocket bodies;
                                // perigee-based lifetime forecast, not tracking)
  attribute vec3 aColor;
  attribute float aDebris;      // 1 = debris / rocket body → render smaller
  attribute float aGroup;       // constellation group id (see SAT_GROUPS)
  attribute float aFamily;      // debris fragmentation-family id (see DEBRIS_FAMILIES), -1 = none
  attribute float aRegime;      // orbit regime id (0=LEO 1=MEO 2=GEO 3=HEO)
  attribute float aRand;        // stable per-sat random [0,1) → stratified LOD cull
  uniform float uTimeDay;       // current sim time, days since J2000
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIsolate;   // 1.0 = a satellite is selected → hide the whole swarm
  uniform float uGroupSel;  // -1 = all groups; else show only this group id
  uniform float uFamilySel; // -1 = no family isolate; else show ONLY this debris family
  uniform float uTypeSel;   // -1 = all · 0 = active only (hide debris) · 1 = debris only
  uniform float uRegimeSel; // -1 = all regimes; else show only this regime id
  uniform float uLod;       // 0 = Earth fills the frame (full catalogue) → 1 = Earth
                            // small on screen (LEO thinned to a calm haze)
  uniform float uKeepScale; // viewport-area dot budget: 1 on desktop, ~0.25 on a
                            // phone — a 390px-wide screen can't carry 18k dots
  uniform float uKeepFloor; // never thin below ~1,200 visible dots: in sparse
                            // eras (1960s scrub) or small filtered groups, the
                            // cull would misrepresent an almost-empty sky
  uniform float uMaxPx;     // dot size ceiling (CSS px) — also area-scaled so
                            // close-range dots don't bloat into moss on mobile
  varying vec3 vColor;
  varying float vHidden;
  varying float vDebris;   // passed to frag → debris drawn dimmer (active stand out)
  varying float vFade;     // LOD alpha multiplier (LEO haze at overview zoom)
  varying float vRand;     // stable per-dot random → gentle twinkle phase in frag
  varying float vTypeEmph; // 1 = a type filter is engaged → let type colour SPEAK
  void main() {
    vColor = aColor;
    vDebris = aDebris;
    vRand = aRand;
    // The ALL/ACTIVE/DEBRIS chips read as broken without visible feedback:
    // hiding 2.6k of 18.7k calm-white dots is imperceptible. With a filter
    // engaged, the frag swaps the calm tint for the real type colour
    // (payload green / rocket-body yellow / debris red) so the choice SHOWS.
    vTypeEmph = (uTypeSel >= 0.0) ? 1.0 : 0.0;
    // Overview declutter, LEO only. ~85% of the catalogue lives in a band just
    // 6–30% above the surface; at overview zoom 18k min-px dots in that thin
    // annulus fuse into a solid crust over Earth. Thin LEO to a stratified
    // sample as Earth shrinks on screen (aRand is stable per satellite, so the
    // same sats persist frame to frame — no shimmer). MEO / GEO / HEO are
    // sparse and ARE the structure (nav shell, GEO belt), so they never cull.
    // Any explicit filter or isolate means the user asked for a specific
    // subset — show it in full.
    float lodEff = (uGroupSel >= 0.0 || uRegimeSel >= 0.0 || uFamilySel >= 0.0 || uTypeSel >= 0.0 || uIsolate > 0.5) ? 0.0 : uLod;
    // Now the shell is EXPANDED (SHELL_EXPAND), LEO no longer piles into a crust —
    // so keep FAR more dots at overview (0.55 → 0.85) so the swarm is clearly
    // visible even before you click, not a faint scatter.
    float keep = max(mix(1.0, 0.85, lodEff) * uKeepScale, uKeepFloor);
    // Soft cull edge: each dot fades over a small aRand band around the moving
    // threshold instead of popping, so zooming reads as the haze *resolving*
    // into satellites, not dots switching on.
    float cullFade = (aRegime < 0.5) ? (1.0 - smoothstep(keep - 0.08, keep, aRand)) : 1.0;
    // Debris decay: past its modeled re-entry day the fragment is GONE (burned
    // up); it dims over its last ~60 days so scrubbing forward reads as the
    // junk population slowly dying, not dots blinking off.
    float decayed = (aDebris > 0.5 && uTimeDay > aDecayDay) ? 1.0 : 0.0;
    float decayFade = (aDebris > 0.5) ? clamp((aDecayDay - uTimeDay) / 60.0, 0.0, 1.0) : 1.0;
    // Launch gating: not yet launched → collapse to zero size.
    // Selection no longer hides the swarm (LeoLabs read: the field stays alive,
    // dimmed via uIsolate in the fragment shader, with the pick highlighted).
    // Group + regime filters AND together (both must pass if set).
    // Type filter (ALL/ACTIVE/DEBRIS chips): 0 = active only → hide debris;
    // 1 = debris only → hide active. aDebris is 1 for debris/rocket bodies.
    float typeHide = (uTypeSel < -0.5) ? 0.0
                   : (uTypeSel < 0.5) ? aDebris          // active-only: hide debris
                   : (1.0 - aDebris);                    // debris-only: hide active
    vHidden = (aLaunchDay > uTimeDay || decayed > 0.5 || cullFade < 0.01 ||
               typeHide > 0.5 ||
               (uGroupSel >= 0.0 && abs(aGroup - uGroupSel) > 0.5) ||
               (uRegimeSel >= 0.0 && abs(aRegime - uRegimeSel) > 0.5) ||
               (uFamilySel >= 0.0 && abs(aFamily - uFamilySel) > 0.5)) ? 1.0 : 0.0;
    // Surviving LEO dots soften at overview so the band reads as a luminous
    // haze around the globe, resolving into crisp dots as you zoom in.
    // Keep LEO nearly full-brightness at overview (0.6 → 0.9) so the swarm reads
    // clearly zoomed-out, not just after you click a craft.
    vFade = ((aRegime < 0.5) ? mix(1.0, 0.9, lodEff) : 1.0) * cullFade * max(decayFade, 0.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective size with distance falloff, BUT clamped to a visible floor so
    // the shell never collapses into sub-pixel specks when Earth is framed — the
    // LeoLabs read is thousands of CRISP dots, not a faint scatter. Debris slightly
    // smaller so active payloads stand out.
    float sizeMul = aDebris > 0.5 ? 0.7 : 1.0;
    float persp = uSize * sizeMul * uPixelRatio * (1.0 / -mv.z);
    // Floor keeps every satellite legible without blooming. With the expanded
    // shell the overview no longer risks a crust, so hold a stronger floor
    // zoomed-out (0.7 → 1.15) so the swarm reads as crisp visible dots, not a
    // faint scatter you only see after clicking.
    float minPx = mix(1.3, 1.15, lodEff) * uPixelRatio * sizeMul;
    float s = vHidden > 0.5 ? 0.0 : clamp(persp, minPx, uMaxPx * uPixelRatio);
    gl_PointSize = s;
  }
`
const FRAG = /* glsl */ `
  precision mediump float;
  uniform highp float uIsolate;  // 1 = selected → dim (not hide) the swarm; highp to
                                 // match the vertex declaration or the program fails
                                 // validation (precision mismatch)
  uniform highp float uTimeDay;  // sim time (days since J2000) → gentle twinkle phase
  varying vec3 vColor;
  varying float vHidden;
  varying float vDebris;
  varying float vFade;
  varying float vRand;
  varying float vTypeEmph;
  void main() {
    if (vHidden > 0.5) discard;
    // Crisp catalogued dot: a bright tight core + a small soft rim. Denser than
    // before so overlapping points build into a luminous shell (the LeoLabs look)
    // rather than a grey haze.
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // CLEAN but VISIBLE (Ankur: 'make it better that satellites are visible' — the
    // ultra-subtle veil read too faint). A bright, crisp core with a soft halo so
    // each dot is a clear luminous point, while staying ONE calm tint (not the old
    // tacky rainbow). Sweet spot: legible + elegant.
    float coreDot = 1.0 - smoothstep(0.0, 0.32, d);  // tight bright centre
    float halo    = (1.0 - smoothstep(0.0, 0.5, d)) * 0.35; // soft surround
    float a = clamp(coreDot + halo, 0.0, 1.0);
    // One calm tint — a bright cool-white, with the core whitened to a hot point so
    // the dot reads clearly against Earth. Type colour survives as a faint undertone
    // — UNLESS a type filter is engaged, when the real type colour takes over
    // (and the white-hot core softens so the colour actually reads).
    vec3 CALM = vec3(0.86, 0.93, 1.0);
    float typeMix = mix(0.16, 0.85, vTypeEmph);
    vec3 col = mix(mix(CALM, vColor, typeMix), vec3(1.0), coreDot * mix(0.4, 0.15, vTypeEmph));
    a *= vDebris > 0.5 ? 0.85 : 1.0;                // clearly visible now
    a *= vFade;   // overview LOD: LEO softens into haze when Earth is small
    // Gentle life: a very subtle per-dot twinkle (each phased by its stable random)
    // so the shell shimmers softly instead of sitting frozen — alive, not noisy.
    float tw = 0.88 + 0.12 * sin(uTimeDay * 40000.0 + vRand * 6.2831853);
    a *= tw;
    // Selection dims the rest to quiet context so the pick stands out.
    a *= mix(1.0, 0.5, uIsolate);
    gl_FragColor = vec4(col, a);
  }
`

export function SatelliteField({ earthVisualRadius }: { earthVisualRadius: number }) {
  const [sats, setSats] = useState<Sat[] | null>(null)
  const satrecs = useRef<unknown[]>([])
  const sgp4 = useRef<Sgp4 | null>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const lastCompute = useRef(0)
  // SAT-2: prev/next SGP4 position buffers. SGP4 runs at 4 Hz (expensive), but we
  // LERP the live `position` attribute between prev→next every frame so the swarm
  // glides smoothly along its orbits instead of stepping every 250 ms.
  const prevPos = useRef<Float32Array | null>(null)
  const nextPos = useRef<Float32Array | null>(null)
  // Time-sliced SGP4 sweep: instead of propagating all ~15,700 sats in one frame
  // (a 4 Hz stutter), we propagate a budget per frame into nextPos, advancing a
  // cursor; a full pass rolls next→prev. Same freshness, no single-frame stall.
  const sweepCursor = useRef(0)
  const sweepStartMs = useRef(0)
  // scene units per km, so satellite altitudes sit just above Earth's sphere
  const kmToScene = earthVisualRadius / EARTH_RADIUS_KM

  // Warm the archetype GLBs the moment the field mounts — the user is now one
  // click away from selecting a satellite, so the download races their intent.
  useEffect(() => {
    for (const a of Object.values(ARCHETYPES)) useGLTF.preload(a.url)
  }, [])

  useEffect(() => {
    let cancelled = false
    // Load satellite.js + the catalogue in parallel, then build satrecs. The
    // catalogue comes from the SHARED cache (loadFullCatalog) so the 4.3 MB file
    // is fetched + parsed once for the whole app, not per consumer.
    Promise.all([
      import("satellite.js") as Promise<unknown> as Promise<Sgp4>,
      loadFullCatalog(),
    ])
      .then(([lib, list]) => {
        if (cancelled) return
        sgp4.current = lib
        satrecs.current = list.map((s) => {
          try { return lib.twoline2satrec(s.l1, s.l2) } catch { return null }
        })
        setSats(list as Sat[])
        // Publish to the DOM-side bridge so the search card can scan the whole
        // catalogue on demand (nearest-overhead) using these same parsed satrecs.
        satLibRef.current = lib
        satrecsRef.current = satrecs.current
        satsRef.current = list as Sat[]
      })
      .catch(() => setSats([]))
    return () => { cancelled = true }
  }, [])

  const markerRef = useRef<THREE.Group>(null)
  // Instant selection reticle (group) — billboarded + screen-space scaled each
  // frame. selReticleAt tracks WHEN the current selection started, for the
  // one-shot "converging" pop that draws the eye on a fresh lock-on.
  const selReticleRef = useRef<THREE.Group>(null)
  const selReticleAt = useRef(0)
  const haloRef = useRef<THREE.Mesh>(null)
  // True 1:1 span (scene units) of the currently selected craft — set on
  // selection, read by the locator-halo fade so the ring hands off to the
  // real model at the right distance for EACH craft's actual size.
  const selectedSpanRef = useRef(0.01)
  const geoRingRef = useRef<THREE.Mesh>(null)
  // SAT-3: one group per notable craft, positioned on its real orbit each frame.
  const notableRefs = useRef<(THREE.Group | null)[]>([])
  // resolve each notable craft's catalogue index once sats load.
  const notableIdx = useMemo(
    () => NOTABLE_CRAFT.map((c) => sats?.findIndex((s) => s.id === c.id) ?? -1),
    [sats],
  )
  const { camera, raycaster, size } = useThree()
  const viewportH = size.height
  // Viewport-area dot budget, relative to the 1440×900 desktop the dot density
  // was tuned on. A phone has ~25% of those pixels — it gets ~25% of the LEO
  // dots and a smaller size ceiling, or the swarm reads as moss at any zoom.
  const areaScale = Math.min(1, Math.max(0.22, (size.width * size.height) / (1440 * 900)))
  const maxPx = 2.2 + 2.3 * Math.sqrt(areaScale) // 4.5 CSS px desktop → ~3.3 phone
  // Smoothed overview-LOD state (0 = full catalogue, 1 = decluttered haze).
  // Starts at 1: the field first appears at solar-system zoom, where the
  // decluttered read is the right one.
  const lodRef = useRef(1)
  // Current cull floor (mirrors uKeepFloor) + LEO member count of the active
  // group filter (null = no filter → use the launched-LEO count instead).
  const keepFloorRef = useRef(0)
  const filterLeoCountRef = useRef<number | null>(null)
  // Points are dimensionless to a ray, so give the raycaster a hit radius. Sized
  // to ~a few % of Earth's visual radius so clicking near a dot in the shell
  // registers, without grabbing everything. (World units.)
  useEffect(() => {
    if (raycaster.params.Points) raycaster.params.Points.threshold = earthVisualRadius * 0.02
  }, [raycaster, earthVisualRadius])
  const lastSelected = useRef<number | null>(null)
  // Selected satellite's display label ("L179: COSMOS 996"-style) — shown as an
  // always-visible tag on the marker, a LeoLabs-style locator readout.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  // Reactive mirror of selectedSatRef for JSX gates (the notable riders hide
  // their DOM labels through this — drei <Html> ignores group.visible).
  const [selId, setSelId] = useState<number | null>(null)
  // Orbit-path polyline for the selected satellite (recomputed on selection).
  const [orbitPts, setOrbitPts] = useState<THREE.Vector3[] | null>(null)
  // Origin→destination arc: launch site on Earth → the craft's current orbit.
  // Earth-fixed (drawn in the ground-track group). null when no known site.
  const [originArc, setOriginArc] = useState<THREE.Vector3[] | null>(null)
  const [originLabel, setOriginLabel] = useState<{ name: string; country: string; pos: THREE.Vector3 } | null>(null)
  // Ground track — the curve the sub-satellite point traces ON Earth's surface
  // over one orbit (the real "path over the ground"), + the live radial tether
  // from the current sub-point up to the craft (the honest "surface → orbit"
  // link; the actual launch ascent isn't in TLE data, so we draw geometry that
  // IS true: where it is over Earth, and how far above the surface it flies).
  const [groundTrack, setGroundTrack] = useState<THREE.Vector3[] | null>(null)
  // The ground track is stored in the Earth-FIXED frame; this group re-applies
  // Earth's current spin each frame so the swath stays glued to the continents.
  const groundTrackGroupRef = useRef<THREE.Group>(null)
  // Wraps the selected orbit path so it hides in-frame when the craft isn't
  // launched yet at the scrubbed time (space-time fidelity).
  const selLinesRef = useRef<THREE.Group>(null)
  const subPointRef = useRef<THREE.Mesh>(null)
  // Two-point line geometry for the surface→craft tether; its endpoints are
  // rewritten each frame (craft moves), so create it once and mutate in place.
  const tetherGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3))
    return g
  }, [])
  // SAT-1: orbit-track ellipses for the currently-FILTERED group — a sampled
  // subset (drawing all ~18k would be thousands of lines), each colored by its
  // altitude band, so you see the constellation's STRUCTURE (Starlink shell, GPS
  // ring, GEO belt), not just current dots. null = no group selected (all).
  const [groupTracks, setGroupTracks] = useState<{ pts: THREE.Vector3[]; color: string }[]>([])
  const lastGroupSel = useRef<number>(-1)
  // Which archetype model the selected satellite uses (chosen on selection).
  const [arch, setArch] = useState<Archetype>(ARCHETYPES.cubesat)
  const archRef = useRef<Archetype>(ARCHETYPES.cubesat)
  // Precision-floor lift for the selected craft (see MIN_VISIBLE_SPAN): ≥1, the
  // factor by which the model is enlarged so it clears the float32 wall and is
  // visible. State drives the marker's <SatModel> scale; the ref keeps useFrame
  // in sync without waiting on a re-render.
  const [selectedLift, setSelectedLift] = useState(1)
  const selectedLiftRef = useRef(1)
  // NORAD id → buffer index, for fast selection lookup.
  const idToIndex = useMemo(() => {
    const m = new Map<number, number>()
    sats?.forEach((s, i) => m.set(s.id, i))
    return m
  }, [sats])

  // Sorted LEO launch days (days since J2000) — binary-searched each frame for
  // "how many LEO satellites exist at the current sim time", which drives the
  // cull floor (sparse eras must show everything they have).
  const leoLaunchDays = useMemo(() => {
    if (!sats) return new Float64Array(0)
    const days: number[] = []
    for (const s of sats) if (classifyRegimeId(s.l2) === 0) days.push(msToJ2000Day(s.launchMs))
    days.sort((a, b) => a - b)
    return Float64Array.from(days)
  }, [sats])

  // Propagate one full orbit of a satrec into scene-space points (for the path
  // line). Period from mean motion `no` (rad/min); fall back to ~95 min LEO.
  function computeOrbit(rec: unknown): THREE.Vector3[] {
    const lib = sgp4.current
    if (!lib || !rec) return []
    const no = (rec as { no?: number }).no ?? 0
    const periodMin = no > 0 ? (2 * Math.PI) / no : 95
    const start = clampToSpaceAge(simTimeRef.current.simMs)
    const steps = 128
    const out: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = new Date(start + (periodMin * 60000 * i) / steps)
      let r: { position?: { x: number; y: number; z: number } } | false = false
      try { r = lib.propagate(rec, t) } catch { r = false }
      const p = finitePos(r)
      if (p) {
        const [ex, ey, ez] = expandEci(p.x, p.y, p.z) // match the swarm's expanded shell
        out.push(new THREE.Vector3(ex * kmToScene, ez * kmToScene, -ey * kmToScene))
      }
    }
    return out
  }

  // Ground track: the sub-satellite curve ON Earth's surface over one orbit,
  // computed in the EARTH-FIXED (ECEF) frame so it shows the real swath drifting
  // westward as the planet turns under the craft (the classic sine-wave track),
  // glued to the continents. Each ECI sample is un-rotated by that sample's GMST
  // (earthRotationAngle at time t) into the Earth-fixed frame, then projected to
  // the surface. Rendered inside a group that RE-APPLIES earthRotationAngle at the
  // current sim time — the SAME angle the Earth mesh uses — so the track spins in
  // exact lockstep with the globe regardless of the texture-offset calibration.
  function computeGroundTrack(rec: unknown): THREE.Vector3[] {
    const lib = sgp4.current
    if (!lib || !rec) return []
    const no = (rec as { no?: number }).no ?? 0
    const periodMin = no > 0 ? (2 * Math.PI) / no : 95
    const start = simTimeRef.current.simMs
    const steps = 160
    const surfR = earthVisualRadius * 1.002 // hug the surface, avoid z-fight
    const out: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const tMs = start + (periodMin * 60000 * i) / steps
      let r: { position?: Vec3 } | false = false
      try { r = lib.propagate(rec, new Date(tMs)) } catch { r = false }
      const p = finitePos(r)
      if (!p) continue
      // ECI → scene (x, z, -y), project to surface, then un-rotate about Y by the
      // Earth angle AT THIS SAMPLE TIME → Earth-fixed. The render group re-applies
      // the current angle, so a point sampled 90 min ago lands where the ground was
      // then, and the whole swath drifts west across the continents over the orbit.
      const v = new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene)
      const len = v.length()
      if (len <= 1e-9) continue
      v.multiplyScalar(surfR / len)
      v.applyAxisAngle(UP_Y, -earthRotationAngle(tMs))
      out.push(v)
    }
    return out
  }

  // Lat/lon (deg) → an Earth-FIXED scene point on the surface (same frame as the
  // ground track, so it lives in groundTrackGroupRef and spins with the globe).
  function launchSiteScenePoint(latDeg: number, lonDeg: number): THREE.Vector3 {
    const lat = (latDeg * Math.PI) / 180
    const lon = (lonDeg * Math.PI) / 180
    // Standard lat/lon → unit sphere, matched to the engine's ECI→scene mapping
    // (x, z, -y) with the +X axis at lon 0. Earth-fixed: no rotation applied here
    // (the render group re-applies the current spin, like the ground track).
    const cx = Math.cos(lat) * Math.cos(lon)
    const cy = Math.cos(lat) * Math.sin(lon)
    const cz = Math.sin(lat)
    const v = new THREE.Vector3(cx, cz, -cy)
    return v.multiplyScalar(earthVisualRadius * 1.002)
  }

  // ORIGIN → DESTINATION connector: an arc from the satellite's launch site (its
  // ORIGIN on Earth) up to where it flies now (its DESTINATION orbit). The real
  // ascent trajectory isn't in TLE data, so this is drawn as an honest lofted
  // arc — a "this left from here, and now flies here" connector, not a claim of
  // the exact flight path. Earth-fixed (lives in the spinning ground-track group)
  // so the origin stays glued to the launch pad as the globe turns.
  function computeOriginArc(rec: unknown, latDeg: number, lonDeg: number): THREE.Vector3[] {
    const lib = sgp4.current
    if (!lib || !rec) return []
    // Current craft position, projected into the Earth-FIXED frame (un-rotate by
    // the current Earth angle) so both endpoints share the ground-track group.
    let r: { position?: Vec3 } | false = false
    try { r = lib.propagate(rec, new Date(clampToSpaceAge(simTimeRef.current.simMs))) } catch { r = false }
    const p = finitePos(r)
    if (!p) return []
    const dest = new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene)
      .applyAxisAngle(UP_Y, -earthRotationAngle(simTimeRef.current.simMs))
    const origin = launchSiteScenePoint(latDeg, lonDeg)
    // Loft the arc above the straight chord so it reads as an ascent, peaking a
    // bit above the destination altitude at the midpoint.
    const steps = 48
    const out: THREE.Vector3[] = []
    const destAlt = dest.length()
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const pt = origin.clone().lerp(dest, t)
      // Radial loft: 0 at the ends, peak ~+12% of the destination radius mid-arc.
      const loft = Math.sin(t * Math.PI) * destAlt * 0.12
      const len = pt.length()
      if (len > 1e-6) pt.multiplyScalar((len + loft) / len)
      out.push(pt)
    }
    return out
  }

  const geometry = useMemo(() => {
    if (!sats || sats.length === 0) return null
    const n = sats.length
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    const launch = new Float32Array(n)
    const isDeb = new Float32Array(n) // 1 = debris/rocket body → smaller in shader
    sats.forEach((s, i) => {
      // Colour by OBJECT TYPE (LeoLabs' signature legend): payload green, rocket
      // body yellow, debris red, unknown grey-blue — a green dot is working hard-
      // ware, a red one is tracked junk. More recognisable than altitude bands.
      const c = typeColor(s.type)
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2]
      isDeb[i] = (s.type === "DEB" || s.type === "R/B") ? 1 : 0
      // store launch as days-since-J2000 (small → exact in the float32 attribute)
      launch[i] = msToJ2000Day(s.launchMs)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3))
    g.setAttribute("aLaunchDay", new THREE.BufferAttribute(launch, 1))
    g.setAttribute("aDebris", new THREE.BufferAttribute(isDeb, 1))
    const groups = new Float32Array(n)
    const regimes = new Float32Array(n)
    const families = new Float32Array(n)
    const rands = new Float32Array(n)
    const decays = new Float32Array(n)
    sats.forEach((sv, gi) => {
      groups[gi] = classifyGroup(sv.name, sv.type)
      regimes[gi] = classifyRegimeId(sv.l2)
      families[gi] = sv.type === "DEB" ? classifyDebrisFamily(sv.name) : -1
      // Stable per-satellite random for the overview LOD cull — hashed from the
      // NORAD id (not the index) so the visible sample never reshuffles when
      // the catalogue refreshes.
      rands[gi] = Math.abs(Math.sin(sv.id * 12.9898) * 43758.5453) % 1
      // Modeled re-entry day for junk: TLE epoch + perigee lifetime, jittered
      // ±35% per object so the population dies off gradually as the timeline
      // plays into the future, not in banded steps. Payloads never decay here
      // (we can't know which are dead + station-keeping).
      if (sv.type === "DEB" || sv.type === "R/B") {
        const mm = parseFloat(sv.l2.substring(52, 63))
        const ecc = parseFloat("0." + sv.l2.substring(26, 33).trim())
        let perigee = 400
        if (mm > 0) {
          const nRad = (mm * 2 * Math.PI) / 86400
          const aKm = Math.cbrt(398600.4418 / (nRad * nRad))
          perigee = aKm * (1 - (Number.isFinite(ecc) ? ecc : 0)) - EARTH_RADIUS_KM
        }
        decays[gi] = tleEpochDay(sv.l1) + modeledLifetimeDays(perigee) * (0.65 + 0.7 * rands[gi])
      } else {
        decays[gi] = 1e9
      }
    })
    g.setAttribute("aGroup", new THREE.BufferAttribute(groups, 1))
    g.setAttribute("aRegime", new THREE.BufferAttribute(regimes, 1))
    g.setAttribute("aFamily", new THREE.BufferAttribute(families, 1))
    g.setAttribute("aRand", new THREE.BufferAttribute(rands, 1))
    g.setAttribute("aDecayDay", new THREE.BufferAttribute(decays, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), earthVisualRadius * 12)
    return g
  }, [sats, earthVisualRadius])

  useFrame((_, delta) => {
    // Adaptive pick radius: a dot renders at a fixed on-screen size, but the
    // raycaster hit-test is in WORLD units — so a fixed threshold missed dots
    // when zoomed in (they're far apart in world space) and grabbed nothing.
    // Scale the threshold with camera distance so a click that visually lands on
    // a dot registers at ANY zoom. This is what made even Hubble unselectable.
    if (raycaster.params.Points) {
      const camDist = camera.position.length() // Earth is near the origin
      // ~2.2% of the viewing distance = a comfortable few-px pick halo.
      raycaster.params.Points.threshold = Math.max(earthVisualRadius * 0.02, camDist * 0.022)
    }
    if (matRef.current) {
      matRef.current.uniforms.uTimeDay.value = msToJ2000Day(simTimeRef.current.simMs)
      matRef.current.uniforms.uGroupSel.value = satGroupFilterRef.current
      matRef.current.uniforms.uRegimeSel.value = satRegimeFilterRef.current
      matRef.current.uniforms.uFamilySel.value = debrisFamilyFilterRef.current
      matRef.current.uniforms.uTypeSel.value = satTypeFilterRef.current
      matRef.current.uniforms.uKeepScale.value = areaScale
      matRef.current.uniforms.uMaxPx.value = maxPx
      // Overview LOD from Earth's APPARENT size on screen (not raw camera
      // distance — screen-relative, so it holds across viewports + FOVs).
      // Earth ≥ ~380px radius → 0 (full catalogue); ≤ ~180px → 1 (LEO haze).
      // Smoothed so crossing the band never pops.
      const showAll = showAllSatsRef.current
      if (pointsRef.current) {
        pointsRef.current.getWorldPosition(_fieldWorld)
        const dist = camera.position.distanceTo(_fieldWorld)
        const halfFovTan = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)
        const apparentPx = (earthVisualRadius / Math.max(dist * halfFovTan, 1e-6)) * (viewportH / 2)
        // "Show all" forces LOD 0 (no thinning) — the whole catalogue, always.
        const targetLod = showAll ? 0 : THREE.MathUtils.clamp((380 - apparentPx) / (380 - 180), 0, 1)
        lodRef.current += (targetLod - lodRef.current) * (1 - Math.exp(-delta * 5))
        matRef.current.uniforms.uLod.value = lodRef.current
      }
      // Cull floor: how many LEO satellites exist at the current sim time
      // (binary search over sorted launch days), or the filtered group's LEO
      // member count. If that's small, the cull stands down entirely — an
      // almost-empty 1960s sky must show every object it has.
      {
        const day = msToJ2000Day(simTimeRef.current.simMs)
        let lo = 0
        let hi = leoLaunchDays.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (leoLaunchDays[mid] <= day) lo = mid + 1
          else hi = mid
        }
        const leoCount = filterLeoCountRef.current ?? lo
        // Show-all pins the floor to 1 → every object kept, no stratified cull.
        keepFloorRef.current = showAll ? 1 : Math.min(1, MIN_VISIBLE_DOTS / Math.max(leoCount, 1))
        matRef.current.uniforms.uKeepFloor.value = keepFloorRef.current
      }
      // GEO belt guide follows the LOD: a faint arc at overview (when the belt
      // is the structure worth reading), gone up close / filtered / isolated —
      // and gone before Syncom 2 (1963): no belt existed to annotate.
      if (geoRingRef.current) {
        const m = geoRingRef.current.material as THREE.MeshBasicMaterial
        const quiet =
          selectedSatRef.current != null ||
          satGroupFilterRef.current >= 0 ||
          satRegimeFilterRef.current >= 0 ||
          simTimeRef.current.simMs < FIRST_GEO_MS
        m.opacity = quiet ? 0 : 0.14 * lodRef.current
        geoRingRef.current.visible = m.opacity > 0.005
      }
    }
    const lib = sgp4.current
    if (!geometry || !sats || !lib) return
    const sel = selectedSatRef.current
    const isolated = sel != null
    // Selection DIMS the swarm (fragment shader) — it stays alive + propagating,
    // the LeoLabs read: the pick + its orbit are highlighted against live context.
    if (matRef.current) matRef.current.uniforms.uIsolate.value = isolated ? 1 : 0

    const now = performance.now()
    // Device-tier SGP4 budget: cadence + how many frames a full sweep spreads
    // over. Read once per frame so a live tier downgrade takes effect immediately.
    const { recomputeMs, sweepFrames } = satBudget()

    // SAT-2: per-frame interpolation. Every frame (not just on the SGP4 step) we
    // lerp the live positions from prevPos→nextPos by how far we are through the
    // current refresh window, so the swarm moves continuously.
    if (prevPos.current && nextPos.current) {
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      // Interpolate prev→next across the current sweep window. The window lasts
      // recomputeMs; a completed sweep resets sweepStartMs (below), so `t` glides
      // 0→1 over the window regardless of how many frames the slices took.
      const t = Math.min(1, (now - sweepStartMs.current) / recomputeMs)
      const a = prevPos.current, b = nextPos.current
      for (let i = 0; i < arr.length; i++) arr[i] = a[i] + (b[i] - a[i]) * t
      pos.needsUpdate = true
    }

    // SAT-3: position the notable craft on their real orbits EVERY frame (only a
    // few propagations → cheap), so the famous hardware glides smoothly. Hidden
    // while a single satellite is isolated (that view is about the one craft).
    {
      const recsN = satrecs.current
      const nowMs = clampToSpaceAge(simTimeRef.current.simMs)
      const dateN = new Date(nowMs)
      for (let c = 0; c < NOTABLE_CRAFT.length; c++) {
        const g = notableRefs.current[c]
        const idx = notableIdx[c]
        if (!g) continue
        // Selecting a notable craft hands it to the true-1:1 marker — the
        // boosted rider must yield or both render at once and the chase camera
        // arrives INSIDE the oversized rider (Hubble's follow view was a
        // screen-filling wall of foil). This is the isolate the comment above
        // always promised.
        if (sel === NOTABLE_CRAFT[c].id) { g.visible = false; continue }
        // TRUTH GATE: hide the craft before its real launch date. SGP4 will
        // happily propagate ISS to 6000 BC — but it didn't exist then. Only show
        // once the sim clock has reached the satellite's actual launch.
        const launched = idx >= 0 && sats[idx] ? nowMs >= sats[idx].launchMs : false
        if (idx < 0 || !recsN[idx] || !launched) { g.visible = false; continue }
        let r: { position?: Vec3; velocity?: Vec3 } | false = false
        try { r = lib.propagate(recsN[idx], dateN) } catch { r = false }
        const p = finitePos(r)
        if (!p) { g.visible = false; continue }
        g.visible = true
        {
          const [nx, ny, nz] = expandEci(p.x, p.y, p.z)
          g.position.set(nx * kmToScene, nz * kmToScene, -ny * kmToScene)
        }
        // orient along velocity (sample a moment ahead)
        let r2: { position?: Vec3 } | false = false
        try { r2 = lib.propagate(recsN[idx], new Date(dateN.getTime() + 30000)) } catch { r2 = false }
        const p2 = finitePos(r2)
        if (p2) {
          const [ax, ay, az] = expandEci(p2.x, p2.y, p2.z)
          const ahead = new THREE.Vector3(ax * kmToScene, az * kmToScene, -ay * kmToScene)
          if (ahead.distanceToSquared(g.position) > 1e-9) g.lookAt(ahead)
        }
      }
    }

    // Clamp to the space age before propagating (see clampToSpaceAge): keeps a
    // far-past/future scrub from feeding SGP4 a millennia-scale delta that returns
    // NaN and freezes the frame. The shader still launch-gates by real launch date.
    const date = new Date(clampToSpaceAge(simTimeRef.current.simMs))
    const recs = satrecs.current

    // SAT-1: when the group filter changes, (re)build a sampled set of orbit-
    // track ellipses for that group so its STRUCTURE is visible. Cleared when the
    // filter is 'all' (-1) — thousands of overlapping ellipses would be noise.
    const gSel = satGroupFilterRef.current
    if (gSel !== lastGroupSel.current) {
      lastGroupSel.current = gSel
      if (gSel < 0 || isolated) {
        setGroupTracks([])
        filterLeoCountRef.current = null
      } else {
        const MAX_TRACKS = 60 // enough to read the shell/ring; cheap to draw
        const members: number[] = []
        for (let i = 0; i < sats.length; i++) {
          if (classifyGroup(sats[i].name, sats[i].type) === gSel) members.push(i)
        }
        // LEO member count feeds the cull floor: a small filtered group
        // (Stations, ~a dozen craft) must never lose members to the budget.
        let leoMembers = 0
        for (const mi of members) if (classifyRegimeId(sats[mi].l2) === 0) leoMembers++
        filterLeoCountRef.current = leoMembers
        // even stride sample so the tracks span the whole constellation
        const stride = Math.max(1, Math.floor(members.length / MAX_TRACKS))
        const tracks: { pts: THREE.Vector3[]; color: string }[] = []
        for (let k = 0; k < members.length && tracks.length < MAX_TRACKS; k += stride) {
          const idx = members[k]
          const pts = computeOrbit(recs[idx])
          if (pts.length > 2) {
            const c = bandColor(sats[idx].l2, sats[idx].type)
            const hex = `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`
            tracks.push({ pts, color: hex })
          }
        }
        setGroupTracks(tracks)
      }
    }

    {
      // Swarm view — TIME-SLICED SGP4 sweep (runs even while a satellite is
      // selected: the dimmed field keeps flying). Propagating all ~15,700 in
      // one frame is a 4 Hz stutter; instead we do a fixed BUDGET per frame into
      // nextPos, advancing sweepCursor. When the cursor wraps a full pass we roll
      // next→prev and restart the interpolation window (sweepStartMs). Positions
      // stay just as fresh, but no single frame ever stalls on the whole catalogue.
      const n = recs.length * 3
      const propagateInto = (buf: Float32Array, j: number) => {
        const rec = recs[j / 3]
        if (!rec) { buf[j] = 0; buf[j + 1] = 0; buf[j + 2] = 0; return }
        let r: { position?: { x: number; y: number; z: number } } | false = false
        try { r = lib.propagate(rec, date) } catch { r = false }
        // Reject non-finite SGP4 output (far-from-epoch scrub) so NaNs never reach
        // the geometry — the far-past-date freeze. See finitePos().
        const p = finitePos(r)
        if (!p) { buf[j] = 0; buf[j + 1] = 0; buf[j + 2] = 0; return }
        // ECI km → scene units, with the shell EXPANDED (altitude exaggerated) so
        // the swarm spreads out and dots separate. Map ECI (x,y,z) to scene
        // (x, z, -y) so the orbital plane sits around Earth's equator.
        const [ex, ey, ez] = expandEci(p.x, p.y, p.z)
        buf[j] = ex * kmToScene
        buf[j + 1] = ez * kmToScene
        buf[j + 2] = -ey * kmToScene
      }

      const firstFill = !nextPos.current || nextPos.current.length !== n
      if (firstFill) {
        // One full immediate fill so the swarm appears in place; seed prev==next.
        nextPos.current = new Float32Array(n)
        prevPos.current = new Float32Array(n)
        for (let k = 0; k < n; k += 3) propagateInto(nextPos.current, k)
        prevPos.current.set(nextPos.current)
        sweepCursor.current = n // parked at end → next window starts a fresh sweep
        sweepStartMs.current = now
      } else {
        const nx = nextPos.current!
        // Start a NEW sweep once the window elapsed and the previous sweep finished
        // (cursor parked at end). Rolling prev←next HERE keeps a clean double buffer:
        // prev = last complete positions, next = being filled this window.
        if (sweepCursor.current >= n && now - sweepStartMs.current >= recomputeMs) {
          prevPos.current!.set(nx)
          sweepCursor.current = 0
          sweepStartMs.current = now
          lastCompute.current = now
        }
        // Propagate a BUDGET of sats this frame, spread across `sweepFrames` frames
        // so no single frame stalls on the whole catalogue. Lower tiers use more
        // frames (smaller per-frame batch = smoother) at the cost of freshness.
        const budget = Math.ceil(recs.length / sweepFrames) * 3 // *3: floats
        let done = 0
        let j = sweepCursor.current
        while (done < budget && j < n) { propagateInto(nx, j); j += 3; done += 3 }
        sweepCursor.current = j
      }
    }

    // --- selected satellite: position the GLB marker, orient it, follow, orbit ---
    const marker = markerRef.current
    if (sel != null && marker) {
      const idx = idToIndex.get(sel)
      const rec = idx != null ? recs[idx] : null
      // SPACE-TIME FIDELITY: the selected craft's GLB marker is rendered
      // SEPARATELY from the point swarm (which the shader launch-gates), so it
      // must be gated too — otherwise scrubbing the clock before the object's
      // launch date left its model floating in a sky where it didn't exist yet.
      // Hide the marker (and skip its orbit/tether updates) until its launch.
      const selLaunchMs = idx != null ? sats?.[idx]?.launchMs : undefined
      const notYetLaunched = selLaunchMs != null && simTimeRef.current.simMs < selLaunchMs
      // Show/hide the selected craft's orbit path + ground track with its launch.
      if (selLinesRef.current) selLinesRef.current.visible = !notYetLaunched
      if (groundTrackGroupRef.current) groundTrackGroupRef.current.visible = !notYetLaunched
      if (notYetLaunched) {
        marker.visible = false
      } else if (rec) {
        let r: { position?: Vec3; velocity?: Vec3 } | false = false
        try { r = lib.propagate(rec, date) } catch { r = false }
        const p = finitePos(r)
        if (p) {
          // Keep the card's altitude + speed live as the craft moves along its
          // orbit (apogee/perigee/period/inclination are fixed elements, set once
          // on selection below). This is the "watch it fly" payoff.
          if (selectedOrbitRef.current) {
            selectedOrbitRef.current.altitudeKm =
              Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - EARTH_RADIUS_KM
            const v = r && r.velocity
            if (v) selectedOrbitRef.current.speedKms = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
            // Live sub-satellite point — the lat/lon on Earth it's over RIGHT NOW —
            // plus, if the user shared their location, the straight-line distance
            // from THEM to the object (slant range) and its elevation over their
            // horizon. Same topocentric math as the pass planner (eciToEcf →
            // look angles), so "how far is it from me" is a real number, not altitude.
            try {
              const gmst = lib.gstime(date)
              const geo = lib.eciToGeodetic(p, gmst)
              selectedOrbitRef.current.subLatDeg = lib.degreesLat(geo.latitude)
              selectedOrbitRef.current.subLonDeg = lib.degreesLong(geo.longitude)
              const obs = observerRef.current
              if (obs) {
                const ecf = lib.eciToEcf(p, gmst)
                const la = lib.ecfToLookAngles(obs, ecf)
                selectedOrbitRef.current.slantRangeKm = la.rangeSat
                selectedOrbitRef.current.elevationDeg = (la.elevation * 180) / Math.PI
              } else {
                selectedOrbitRef.current.slantRangeKm = null
                selectedOrbitRef.current.elevationDeg = null
              }
            } catch { /* keep last */ }
            // SUNLIT vs ECLIPSE: is the craft catching the sun, or in Earth's
            // shadow right now? Cylindrical umbra test — the craft is lit unless
            // it's on the anti-sun side AND within one Earth radius of the
            // Sun–Earth axis. Low-precision solar vector is plenty for the
            // boolean. (Same physics the ISS "golden hour" passes depend on.)
            try {
              const dd = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000
              const g = (357.529 + 0.98560028 * dd) * (Math.PI / 180)
              const q = (280.459 + 0.98564736 * dd) * (Math.PI / 180)
              const L = q + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * (Math.PI / 180)
              const e = 23.439 * (Math.PI / 180)
              const sx = Math.cos(L), sy = Math.cos(e) * Math.sin(L), sz = Math.sin(e) * Math.sin(L)
              const rlen = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1
              const along = (p.x * sx + p.y * sy + p.z * sz) // sat·sun (km, sun unit)
              // perpendicular distance from the Sun–Earth axis
              const px = p.x - along * sx, py = p.y - along * sy, pz = p.z - along * sz
              const perp = Math.sqrt(px * px + py * py + pz * pz)
              selectedOrbitRef.current.sunlit = along >= 0 || perp > EARTH_RADIUS_KM
              // ground speed: orbital speed scaled by Earth-radius / orbital-radius
              // (the sub-point traces a smaller circle than the craft), the
              // intuitive "how fast its shadow crosses the ground".
              selectedOrbitRef.current.groundSpeedKms =
                selectedOrbitRef.current.speedKms * (EARTH_RADIUS_KM / rlen)
            } catch { /* keep last */ }
          }
          // Position on the EXPANDED shell (matches the swarm); the altitude
          // READOUT above stays true km — only the visual position is stretched.
          const [cex, cey, cez] = expandEci(p.x, p.y, p.z)
          const cur = new THREE.Vector3(cex * kmToScene, cez * kmToScene, -cey * kmToScene)
          // orient the model along its direction of travel (sample a moment ahead)
          let r2: { position?: { x: number; y: number; z: number } } | false = false
          try { r2 = lib.propagate(rec, new Date(date.getTime() + 30000)) } catch { r2 = false }
          const p2 = finitePos(r2)
          marker.position.copy(cur)

          // Update the surface→craft tether: from the sub-point (craft direction
          // projected onto Earth's surface) up to the craft. Its length = real
          // altitude to scale, the honest "how high above the ground it flies".
          {
            const posAttr = tetherGeom.getAttribute("position") as THREE.BufferAttribute
            const dir = cur.clone().normalize()
            const surf = dir.clone().multiplyScalar(earthVisualRadius * 1.002)
            posAttr.setXYZ(0, surf.x, surf.y, surf.z)
            posAttr.setXYZ(1, cur.x, cur.y, cur.z)
            posAttr.needsUpdate = true
            // Live sub-point dot sits where the tether meets the surface (current
            // inertial radial) — the moving head of the ground track.
            if (subPointRef.current) subPointRef.current.position.copy(surf)
          }
          // Spin the Earth-fixed ground-track group in lockstep with the globe.
          if (groundTrackGroupRef.current) {
            groundTrackGroupRef.current.rotation.y = earthRotationAngle(simTimeRef.current.simMs)
          }
          if (p2) {
            const [ax, ay, az] = expandEci(p2.x, p2.y, p2.z)
            const ahead = new THREE.Vector3(ax * kmToScene, az * kmToScene, -ay * kmToScene)
            if (ahead.distanceToSquared(cur) > 1e-9) marker.lookAt(ahead)
          }
          marker.visible = true

          // INSTANT selection ring: billboard it to the camera (the marker group
          // is rotated to the craft's travel direction, so the ring must undo
          // that + face the viewer) and scale it in SCREEN space so it's always a
          // clean, consistent ring — a clear "this one is selected" from any
          // distance, the moment you click, before the fly even arrives.
          const reticle = selReticleRef.current
          if (reticle) {
            // Face the camera: world-quaternion = camera's, expressed in the
            // marker's local frame (cancel the parent's travel-direction spin).
            marker.getWorldQuaternion(_haloTmpQ)
            reticle.quaternion.copy(_haloTmpQ).invert().multiply(camera.quaternion)
            // Screen-space size: scale by distance so the reticle subtends a
            // roughly constant fraction of the view (a tidy lock-on, not a giant
            // off-frame circle up close), clamped so it's always a clean marker.
            const camDist = camera.position.distanceTo(marker.position)
            const base = Math.min(earthVisualRadius * 0.7, Math.max(earthVisualRadius * 0.022, camDist * 0.022))
            // One-shot CONVERGING pop on a fresh selection: the reticle starts a
            // touch larger + snaps in over ~350ms so the eye catches the lock-on.
            const age = performance.now() - selReticleAt.current
            const pop = age < 350 ? 1 + 0.6 * (1 - age / 350) : 1
            reticle.scale.setScalar(base * pop)
          }

          // Debug readout for the "selected craft won't render" diagnosis: real
          // marker state (no guessing). Read window.__ueSat headlessly or in devtools.
          if (typeof window !== "undefined") {
            const w = new THREE.Vector3(); marker.getWorldPosition(w)
            const meshCount = (() => { let n = 0; marker.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++ }); return n })()
            ;(window as unknown as { __ueSat?: object }).__ueSat = {
              sel, archUrl: archRef.current.url, archLabel: archRef.current.label,
              markerVisible: marker.visible,
              markerWorld: [w.x, w.y, w.z],
              camDist: camera.position.distanceTo(w),
              meshCountUnderMarker: meshCount, // 0 = GLB not mounted/loaded
              span: selectedSpanRef.current,
            }
          }

          // Locator halo: subtends a ~constant small screen size when far (so you
          // can FIND the otherwise-invisible 1:1 craft), then shrinks + fades to
          // nothing as you approach, letting the real model emerge. Sized in the
          // marker's LOCAL space (it's the group child) from the camera distance.
          const halo = haloRef.current
          if (halo) {
            const world = new THREE.Vector3()
            marker.getWorldPosition(world)
            const dist = camera.position.distanceTo(world)
            // The ring subtends a ~CONSTANT small angle on screen (so it's a tidy
            // locator at any distance, never a growing blob). ring screen-size ≈
            // dist * tan(angle); a small factor keeps it a modest ring. It FADES
            // OUT as you close in so the real model reads on its own.
            const span = selectedSpanRef.current
            // FADE: the ring is a "find it from afar" locator. It fully disappears
            // once you're within ~8 craft-spans so it NEVER dominates the close-up
            // (it was a giant gold ring filling the view up close). 0 near → 1 far.
            const fade = Math.min(1, Math.max(0.0, (dist / Math.max(span, 1e-6) - 8.0) / 40.0))
            const worldScale = marker.getWorldScale(new THREE.Vector3()).x || 1
            // A SMALL constant angular ring (~1.2% of distance) — a tidy locator,
            // not a screen-filling circle. No span-based floor (that kept it huge
            // up close after the shell expansion inflated span).
            const ringWorld = dist * 0.012
            halo.scale.setScalar(ringWorld / worldScale)
            // Billboard the ring to face the camera. The halo is a child of the
            // marker (which is rotated to the craft's travel direction), so cancel
            // the parent's world rotation, then apply the camera's — net world
            // orientation = camera-facing, a clean circle from any angle.
            if (marker.parent) {
              marker.getWorldQuaternion(_haloTmpQ)
              halo.quaternion.copy(_haloTmpQ).invert().multiply(camera.quaternion)
            } else {
              halo.quaternion.copy(camera.quaternion)
            }
            const mat = halo.material as THREE.MeshBasicMaterial
            mat.opacity = 0.5 * fade
            halo.visible = fade > 0.02
          }
        }
        // On a NEW selection: pick the archetype, follow, recompute the orbit, and
        // tighten the camera near-plane / zoom floor so the user can dolly right
        // up to the true-1:1 craft (FlyToController reads focusDepthRef).
        if (sel !== lastSelected.current) {
          lastSelected.current = sel
          selReticleAt.current = performance.now() // trigger the converging pop
          // Tell the DOM shell a follow began (search pick OR a dot click) —
          // the explorer closes the first-run tour card so it can't sit over
          // the chase view the user just asked for.
          window.dispatchEvent(new Event("celestial:sat-selected"))
          setOrbitPts(computeOrbit(rec))
          setGroundTrack(computeGroundTrack(rec))

          // altitude + speed (km, km/s) from a fresh propagate → drives archetype
          // choice AND the live card readout.
          const meta = sats.find((s) => s.id === sel)

          // Origin → destination: draw the arc from this craft's launch site up
          // to its current orbit, if we know the site. Earth-fixed (ground-track
          // group). Unknown site → no arc (honest: we don't guess an origin).
          const site = launchSiteFor((meta as { site?: string } | undefined)?.site)
          if (site) {
            setOriginArc(computeOriginArc(rec, site.lat, site.lon))
            setOriginLabel({ name: site.name, country: site.country, pos: launchSiteScenePoint(site.lat, site.lon) })
          } else {
            setOriginArc(null)
            setOriginLabel(null)
          }
          let altKm = 0
          let speedKms = 0
          {
            let rr: { position?: Vec3; velocity?: Vec3 } | false = false
            try { rr = lib.propagate(rec, date) } catch { rr = false }
            const pp = finitePos(rr)
            if (pp) altKm = Math.sqrt(pp.x * pp.x + pp.y * pp.y + pp.z * pp.z) - EARTH_RADIUS_KM
            const vv = rr && rr.velocity
            if (vv) speedKms = Math.sqrt(vv.x * vv.x + vv.y * vv.y + vv.z * vv.z)
          }
          const archId = classifyArchetype(meta?.name ?? "", meta?.owner ?? "", altKm, meta?.type, meta?.launchMs)
          const a = ARCHETYPES[archId]
          archRef.current = a
          selectedArchetypeIdRef.current = archId
          setArch(a)
          setSelectedLabel(meta ? `${meta.id} · ${meta.name}` : null)
          setSelId(sel)

          // Orbital readout — apogee/perigee/inclination from the satrec elements,
          // period from mean motion; altitude + speed from the live propagate above.
          {
            const r = rec as SatRec
            const apogeeKm = r.alta != null ? r.alta * EARTH_RADIUS_KM : altKm
            const perigeeKm = r.altp != null ? r.altp * EARTH_RADIUS_KM : altKm
            const periodMin = r.no && r.no > 0 ? (2 * Math.PI) / r.no : 0
            const inclinationDeg = r.inclo != null ? (r.inclo * 180) / Math.PI : 0
            selectedOrbitRef.current = {
              altitudeKm: altKm,
              speedKms,
              apogeeKm,
              perigeeKm,
              periodMin,
              inclinationDeg,
              regime: orbitRegime(apogeeKm, perigeeKm),
              subLatDeg: 0,
              subLonDeg: 0,
              slantRangeKm: null,
              elevationDeg: null,
              // orbits/day from the period; sunlit/groundSpeed refined per frame.
              orbitsPerDay: periodMin > 0 ? 1440 / periodMin : 0,
              sunlit: true,
              groundSpeedKms: speedKms * (EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altKm)),
            }
          }

          // PROPORTIONALLY-TRUE span: real deployed metres × one shared boost.
          // Literal 1:1 is unrenderable here — at world coords ~150 units,
          // float32 precision is ~1e-5 units, and a 9 m craft IS ~1e-5 units.
          // The ×SELECTED_SCALE_BOOST keeps every craft above that floor while
          // the PROPORTIONS stay honest: the ISS really is ~70× the debris
          // shard. Follow distance + near-plane scale with each craft's span,
          // so arrival frames a 1.5 m fragment as tightly as a station.
          const trueSpan = a.k * earthVisualRadius * a.nativeSpan * SELECTED_SCALE_BOOST
          // Lift the span above the float32 precision floor so small craft
          // (Iridium, OneWeb, debris) are actually visible; apply the SAME lift
          // to the model scale (via selectedLiftRef) so framing + model agree.
          const { span, lift } = clampSpan(trueSpan)
          selectedLiftRef.current = lift
          setSelectedLift(lift)
          selectedSpanRef.current = span
          focusDepthRef.current = {
            // Tighten the near plane so you can dolly right up to the craft's
            // hull without it clipping.
            near: Math.max(span * 0.12, 1.2e-4),
            // Let the user zoom in until the craft nearly fills the frame. The old
            // floor (span * 1.1) sat you barely closer than arrival, so scrolling
            // in felt dead — "can't zoom on the satellite". span * 0.28 gives a
            // real close-inspection range while staying just outside the hull.
            minDistance: Math.max(span * 0.28, 2e-4),
            // Pull FAR in to just past Earth (centre ~0.42 from a LEO craft, radius
            // 0.05) + generous margin: with near this tight, the FULL linear depth
            // buffer now falls on the craft ↔ Earth range, so the craft stops
            // z-fighting the limb. 6 units covers Earth + the whole satellite shell
            // while dropping the wasted 3000 of empty far space.
            far: 6,
          }
          // expose the chosen archetype label to the search card (DOM side)
          selectedArchetypeRef.current = a.label
          // Following is a HUMAN view: snap to real time so the ground below
          // moves the way an astronaut sees it, even if the user had the
          // timeline running at warp. They can re-scrub afterwards — only the
          // moment of selection resets the pace.
          timeScaleRef.current = REALTIME_TIME_SCALE
          const m = marker
          requestFollow(
            () => {
              const v = new THREE.Vector3()
              m.getWorldPosition(v)
              return { x: v.x, y: v.y, z: v.z }
            },
            // Arrive framing the craft with a little breathing room (model +
            // locator ring both read), close enough that the zoom-in range below
            // it feels alive rather than starting you far out.
            span * 7,
            meta?.name,
            undefined,
            // Travel frame for the chase camera: the marker's +Z is aimed along
            // its orbit (lookAt at the propagated ahead-point), radial-out is
            // position − Earth centre (the field's parent group). With this,
            // "behind the satellite" stays behind all the way around the orbit.
            () => {
              m.getWorldQuaternion(_sfQ)
              _sfT.set(0, 0, 1).applyQuaternion(_sfQ)
              m.getWorldPosition(_sfUp)
              if (m.parent) m.parent.getWorldPosition(_sfE)
              else _sfE.set(0, 0, 0)
              _sfUp.sub(_sfE)
              return {
                t: { x: _sfT.x, y: _sfT.y, z: _sfT.z },
                up: { x: _sfUp.x, y: _sfUp.y, z: _sfUp.z },
              }
            },
          )
        }
      }
    } else if (marker) {
      marker.visible = false
      if (lastSelected.current !== null) {
        lastSelected.current = null
        setOrbitPts(null)
        setGroundTrack(null)
        setOriginArc(null)
        setOriginLabel(null)
        setSelectedLabel(null)
        setSelId(null)
        selectedOrbitRef.current = null
        focusDepthRef.current = null   // restore normal near-plane / zoom limits
      }
    }
  })

  if (!geometry) return null

  // Is this dot actually on screen right now? The raycaster sees every point
  // in the buffer — including ones hidden by the launch gate or the overview
  // LOD cull — so click/hover must mirror the shader's visibility rules
  // (same NORAD-id hash, same keep threshold, same floor) or the cursor flips
  // and the camera flies to satellites the user can't see.
  const isDotVisible = (idx: number) => {
    if (!sats || !sats[idx]) return false
    if (simTimeRef.current.simMs < sats[idx].launchMs) return false
    if (classifyRegimeId(sats[idx].l2) !== 0) return true
    const filtered =
      satGroupFilterRef.current >= 0 || satRegimeFilterRef.current >= 0 || selectedSatRef.current != null
    const keep = Math.max((filtered ? 1 : 1 - 0.45 * lodRef.current) * areaScale, keepFloorRef.current)
    const rand = Math.abs(Math.sin(sats[idx].id * 12.9898) * 43758.5453) % 1
    return rand <= keep - 0.04
  }

  // Click a dot in the 3D view → select that satellite (draw its orbit, follow,
  // show its data). R3F raycasts the points; we take the closest hit, map its
  // buffer index back to the NORAD id, and set the selection ref. Only fires when
  // not already isolated (so clicking the followed craft doesn't re-trigger).
  const onPointsClick = (e: {
    index?: number
    intersections?: { index?: number }[]
    stopPropagation: () => void
  }) => {
    const idx = e.index ?? e.intersections?.[0]?.index
    if (idx == null || !isDotVisible(idx)) return
    e.stopPropagation()
    // The swarm stays visible while one craft is selected, so clicking another
    // dot re-targets the chase — LeoLabs-style hop from object to object.
    if (sats![idx].id === selectedSatRef.current) return
    selectedSatRef.current = sats![idx].id
  }

  return (
    <>
      <points
        ref={pointsRef}
        geometry={geometry}
        frustumCulled={false}
        onClick={onPointsClick}
        onPointerOver={(e: { index?: number }) => {
          // Only flip the cursor for dots that are actually visible — the
          // pointer ring promising a click on empty-looking space is a lie.
          if (e.index == null || isDotVisible(e.index)) document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => { document.body.style.cursor = "" }}
      >
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          // NORMAL (over) blending, not additive: additive made 18k overlapping
          // dots sum into a hot halo that bloomed over Earth ("looks broken").
          // Normal blending keeps each dot crisp + the shell calm, closer to the
          // precise LeoLabs read. The dots are already bright enough on their own.
          blending={THREE.NormalBlending}
          uniforms={{
            uTimeDay: { value: msToJ2000Day(simTimeRef.current.simMs) },
            // Balanced: visible crisp pinpoints without fat tacky blobs.
            uSize: { value: 90 },
            uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
            uIsolate: { value: 0 },
            uGroupSel: { value: -1 },
            uFamilySel: { value: -1 },
            uTypeSel: { value: -1 },
            uRegimeSel: { value: -1 },
            uLod: { value: 1 },
            uKeepScale: { value: 1 },
            uKeepFloor: { value: 0 },
            uMaxPx: { value: 3.8 },
          }}
        />
      </points>

      {/* GEO belt guide — the geostationary ring is real, sharply defined
          structure (35,786 km above the equator, 42,164 km from Earth's
          center); at overview zoom this faint arc traces it so the sparse
          orange dots read as THE BELT. Opacity rides the LOD: it hands over
          to the dots as you zoom in, and stands down for filters/isolate. */}
      <mesh ref={geoRingRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[42164 * kmToScene, earthVisualRadius * 0.004, 6, 160]} />
        <meshBasicMaterial color="#ff9a6b" transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Selected satellite, riding its live SGP4 position at PROPORTIONALLY-
          TRUE scale: real deployed metres × one shared boost (float32 world
          coords can't carry literal 1:1 — see SELECTED_SCALE_BOOST). A 109 m
          station and a 1.5 m fragment keep their real 70:1 ratio. The chase-
          follow's span-proportional arrival distance frames each craft; the
          locator halo marks the spot from afar and fades as the model reads. */}
      <group ref={markerRef} visible={false}>
        <SatModel url={arch.url} scale={arch.k * earthVisualRadius * SELECTED_SCALE_BOOST * selectedLift} />
        {/* INSTANT selection RETICLE — an unmistakable camera-facing target that
            appears the MOMENT a dot is clicked (the marker group flips visible on
            select, before the fly-in arrives), so you immediately know WHICH craft
            is selected from any distance. A bright ring PLUS four corner brackets
            reads as a deliberate lock-on, not a faint hoop. Billboarded + screen-
            scaled each frame (selReticleRef block in useFrame). renderOrder high +
            depthTest off so it never hides behind the craft. */}
        <group ref={selReticleRef}>
          {/* Bright core ring (thicker than before). */}
          <mesh renderOrder={22}>
            <ringGeometry args={[0.86, 1.02, 64]} />
            <meshBasicMaterial color="#8fe0ff" transparent opacity={0.95} toneMapped={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* Soft outer glow ring so it catches the eye from afar. */}
          <mesh renderOrder={21}>
            <ringGeometry args={[1.05, 1.5, 64]} />
            <meshBasicMaterial color="#4fbfff" transparent opacity={0.18} toneMapped={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
          {/* Four corner brackets — the "lock-on" reticle feel. Thin boxes at the
              N/E/S/W of a square framing the ring. */}
          {[[0, 1.5, 0], [0, -1.5, 0], [1.5, 0, Math.PI / 2], [-1.5, 0, Math.PI / 2]].map((p, i) => (
            <mesh key={i} position={[p[0], p[1], 0]} rotation={[0, 0, p[2]]} renderOrder={22}>
              <planeGeometry args={[0.5, 0.09]} />
              <meshBasicMaterial color="#8fe0ff" transparent opacity={0.9} toneMapped={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
        {/* Always-visible locator label on the selected object — a LeoLabs-style
            tag so you can read WHAT you're looking at without the side panel. */}
        {selectedLabel && (
          <Html
            center
            distanceFactor={undefined}
            zIndexRange={[30, 0]}
            style={{ pointerEvents: "none", userSelect: "none", transform: "translate(16px, -14px)" }}
          >
            {/* Selected craft: same delicate tag style, in accent — a thin dot +
                label, not a boxy chip, so it annotates without cluttering. */}
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-1 w-1 rounded-full bg-accent" />
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-accent [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                {selectedLabel}
              </span>
            </div>
          </Html>
        )}
      </group>

      {/* Orbital path of the selected satellite (one full revolution). Wrapped in
          a ref'd group so it can be hidden in-frame when the craft isn't launched
          yet at the scrubbed time (space-time fidelity — see the marker gate). */}
      <group ref={selLinesRef}>
        {orbitPts && orbitPts.length > 1 && (
          <Line points={orbitPts} color="#ffd24a" transparent opacity={0.4} lineWidth={1} />
        )}
      </group>

      {/* Ground track — the sub-satellite curve ON Earth's surface. Stored in the
          Earth-FIXED frame and rendered inside a group that spins with the globe
          (groundTrackGroupRef, angle set each frame), so it shows the real swath
          drifting westward over the continents as Earth turns — the classic
          sine-wave ground track. Cyan, distinct from the amber orbit above. */}
      <group ref={groundTrackGroupRef}>
        {groundTrack && groundTrack.length > 1 && (
          <Line points={groundTrack} color="#5affc0" transparent opacity={0.5} lineWidth={1.5} />
        )}
        {/* ORIGIN → DESTINATION: the arc from the launch site up to the craft's
            current orbit + a marker + label at the launch pad. Earth-fixed, so
            the origin stays on the pad as the globe turns. Amber-to-white gives
            a clear "left here → flies there" read distinct from the cyan track. */}
        {originArc && originArc.length > 1 && (
          <Line points={originArc} color="#ff8a3a" transparent opacity={0.6} lineWidth={1.5} dashed dashSize={0.04} gapSize={0.02} />
        )}
        {originLabel && (
          <group position={originLabel.pos}>
            <mesh>
              <sphereGeometry args={[earthVisualRadius * 0.014, 12, 12]} />
              <meshBasicMaterial color="#ff8a3a" toneMapped={false} />
            </mesh>
            {/* SCREEN-SPACE label (no distanceFactor): a world-scaled DOM label
                blew up to fill the whole view when the chase camera closed in on
                a craft passing near its own launch site — a constant 10px tag
                reads at every distance, same idiom as the selected-craft tag. */}
            <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <div style={{
                whiteSpace: "nowrap", transform: "translateY(-1.6em)",
                fontFamily: "var(--font-jetbrains-mono, monospace)", fontSize: "10px",
                letterSpacing: "0.03em", color: "#ffd7b0",
                background: "rgba(10,8,6,0.72)", padding: "2px 6px", borderRadius: "4px",
                border: "1px solid rgba(255,138,58,0.4)",
              }}>
                ↑ {originLabel.name}
              </div>
            </Html>
          </group>
        )}
      </group>
      {/* Live sub-point marker — a small dot where the craft is DIRECTLY overhead
          right now (current inertial radial), the moving head of the ground track. */}
      {groundTrack && groundTrack.length > 1 && (
        <mesh ref={subPointRef}>
          <sphereGeometry args={[earthVisualRadius * 0.012, 12, 12]} />
          <meshBasicMaterial color="#5affc0" toneMapped={false} />
        </mesh>
      )}

      {/* Live tether — the radial link from the current sub-point up to the craft,
          i.e. surface → orbit. Its length IS the craft's real altitude, drawn to
          scale. Geometry updated each frame in the marker useFrame block. Only
          shown while a craft is selected. */}
      {orbitPts && orbitPts.length > 1 && (
        <threeLine geometry={tetherGeom}>
          <lineBasicMaterial color="#5affc0" transparent opacity={0.35} depthWrite={false} />
        </threeLine>
      )}

      {/* SAT-1: orbit-track ellipses for the selected group — the constellation's
          real structure (shell / ring / belt), sampled + altitude-band colored.
          Faint so they read as scaffolding behind the bright dots. */}
      {groupTracks.map((t, i) => (
        <Line key={`gt-${i}`} points={t.pts} color={t.color} transparent opacity={0.22} lineWidth={1} />
      ))}

      {/* SAT-3: notable craft (ISS, Hubble, Tiangong) as real 3D hardware riding
          their true orbits, at a legible boosted scale with an always-on label. */}
      {NOTABLE_CRAFT.map((c, i) => {
        const a = ARCHETYPES[c.arch]
        const scale = NOTABLE_VISIBLE_SPAN / a.nativeSpan
        return (
          <group
            key={`nc-${c.id}`}
            ref={(el) => { notableRefs.current[i] = el }}
            visible={false}
          >
            <SatModel url={a.url} scale={scale} />
            {/* Clickable hit target — SatModel disables raycasting on the mesh (so
                it doesn't block clicks on OTHER swarm dots), which also made the
                notable riders themselves unselectable (Ankur: "unable to click on
                Hubble or ISS"). This invisible sphere, sized to the boosted render
                span, restores the click → selects the craft the same way clicking
                its swarm dot does. */}
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                if (selectedSatRef.current !== c.id) selectedSatRef.current = c.id
              }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
              onPointerOut={() => { document.body.style.cursor = "" }}
            >
              <sphereGeometry args={[NOTABLE_VISIBLE_SPAN * 0.7, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Refined tag: a hairline dot + thin label, no chunky box — reads as
                a delicate annotation floating beside the craft, not a UI chip.
                Gated on selId: <Html> ignores group.visible, so when this craft
                is selected (rider hidden, true-1:1 marker takes over) the DOM
                tag would otherwise keep floating in the chase view. */}
            {selId !== c.id && (
              <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none", userSelect: "none", transform: "translate(14px, -12px)" }}>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-1 w-1 rounded-full bg-white/70" />
                  <span className="font-mono text-[9px] tracking-[0.15em] uppercase text-white/70 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                    {c.label}
                  </span>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

/** The chosen archetype GLB, cloned for the selected satellite. Cloning keys on
 *  the url so switching archetypes swaps the mesh.
 *
 *  SELF-LIT: a real satellite orbiting into Earth's shadow goes dark, but for
 *  TRACKING that's useless — you must always see the craft you flew to (Ankur:
 *  "dark vs light because of sun isn't required for satellites"). So each cloned
 *  material gets an emissive floor from its own base colour: the craft stays
 *  clearly visible on the night side instead of collapsing to a dark speck, while
 *  still catching the sun on the lit side. */
function SatModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const c = scene.clone()
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      // Don't let the selected craft's model intercept clicks meant for OTHER
      // swarm dots behind it (Ankur: "not allowing to click on other satellites").
      ;(mesh as unknown as { raycast: () => null }).raycast = () => null
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined
      if (mat && "emissive" in mat) {
        const m = mat.clone()
        // Emissive = the material's own colour at a low floor, so the craft
        // self-illuminates without washing out its shading.
        m.emissive = (m.color ? m.color.clone() : new THREE.Color(0xffffff))
        m.emissiveIntensity = 0.55
        m.toneMapped = false
        mesh.material = m
      }
    })
    return c
  }, [scene, url])
  return <primitive object={cloned} scale={scale} />
}
