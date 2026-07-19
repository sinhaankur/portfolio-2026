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
import { simTimeRef, requestFollow, focusDepthRef, daysSinceJ2000, timeScaleRef, REALTIME_TIME_SCALE } from "./astronomy"

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
type ArchetypeId = "cubesat" | "starlink" | "starlink2" | "gps" | "comsat" | "debris" | "rocketbody" | "telescope" | "station" | "weather" | "smallsat" | "iss" | "oneweb" | "kuiper" | "iridium"
type Archetype = { url: string; label: string; realSpanM: number; nativeSpan: number; k: number }
function mkArch(url: string, label: string, realSpanM: number, nativeSpan: number): Archetype {
  return { url, label, realSpanM, nativeSpan, k: realSpanM / 1000 / 6371 / nativeSpan }
}
const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  cubesat:    mkArch("/models/satellite-leopard.glb",  "CubeSat",            1.7, 15.84),
  starlink:   mkArch("/models/satellite-starlink.glb", "Starlink v1 flat-pack", 30, 8.31),
  // v2 Mini — the current generation (~7k on orbit): twin 12 m wings where
  // v1.5 had one. Split from v1 by launch date (v2 Mini flights began
  // 2023-02) — the catalog name alone can't tell the generations apart.
  starlink2:  mkArch("/models/satellite-starlink2.glb", "Starlink v2 Mini", 30, 23.9),
  gps:        mkArch("/models/satellite-gps.glb",      "Navigation craft",   17, 11.42),
  comsat:     mkArch("/models/satellite-dish.glb",     "Dish comsat",        35, 12.22),
  debris:     mkArch("/models/satellite-debris.glb",   "Debris fragment",     1.5, 1.09),
  rocketbody: mkArch("/models/satellite-rocketbody.glb","Spent rocket stage", 10, 4.0),
  telescope:  mkArch("/models/satellite-telescope.glb","Space telescope",     13, 7.5),
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
  kuiper:     mkArch("/models/satellite-kuiper.glb",   "Kuiper flat-bus (approx.)", 9.0, 4.48),
  iridium:    mkArch("/models/satellite-iridium.glb",  "Iridium NEXT",        9.4, 8.05),
}
// SAT-3: a curated set of NOTABLE, recognizable craft that always ride their
// real orbits as actual 3D hardware (not just dots) — so the scene shows the
// famous machines where they really are. Real NORAD ids from the catalogue.
type NotableCraft = { id: number; label: string; arch: ArchetypeId }
const NOTABLE_CRAFT: NotableCraft[] = [
  { id: 25544, label: "ISS",      arch: "iss" },
  { id: 20580, label: "Hubble",   arch: "telescope" },
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
  if (n.includes("ISS") || n.includes("ZARYA")) return "iss"
  if (n.includes("TIANGONG") || n.includes("CSS (") || n.includes("MIR") || n.includes("TIANHE"))
    return "station"
  // Space telescopes / observatories
  if (n.includes("HUBBLE") || n.includes("HST") || n.includes("KEPLER") || n.includes("TESS") ||
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
}
export const selectedOrbitRef: { current: SatOrbit | null } = { current: null }

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

export type SatMeta = { id: number; name: string; owner: string; type?: "PAY" | "R/B" | "DEB"; launchMs: number }

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
    sats.map((s) => ({ id: s.id, name: s.name, owner: s.owner, type: s.type, launchMs: s.launchMs })),
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
}
// SGP4 satrec fields we read for the orbital readout (satellite.js@5 names).
type SatRec = { inclo?: number; alta?: number; altp?: number; no?: number; ecco?: number }

const EARTH_RADIUS_KM = 6371
const RECOMPUTE_MS = 250 // SGP4 refresh cadence (4 Hz)

// Scratch vector for the per-frame overview-LOD measurement (no allocation).
const _fieldWorld = new THREE.Vector3()
// Chase-frame scratch (travel direction + radial-out for the follow camera).
const _sfQ = new THREE.Quaternion()
const _sfT = new THREE.Vector3()
const _sfUp = new THREE.Vector3()
const _sfE = new THREE.Vector3()

// Never thin the swarm below this many visible LEO dots: in the sparse eras
// (scrub to 1965 — a few hundred objects total) or a small filtered group,
// the pixel-budget cull would misrepresent an almost-empty sky as emptier.
const MIN_VISIBLE_DOTS = 2400

// Syncom 2, 26 Jul 1963 — the first geosynchronous satellite. The GEO guide
// ring is an annotation of a real populated belt; before this date there was
// no belt to annotate.
const FIRST_GEO_MS = Date.UTC(1963, 6, 26)

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
  attribute float aRegime;      // orbit regime id (0=LEO 1=MEO 2=GEO 3=HEO)
  attribute float aRand;        // stable per-sat random [0,1) → stratified LOD cull
  uniform float uTimeDay;       // current sim time, days since J2000
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uIsolate;   // 1.0 = a satellite is selected → hide the whole swarm
  uniform float uGroupSel;  // -1 = all groups; else show only this group id
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
  void main() {
    vColor = aColor;
    vDebris = aDebris;
    // Overview declutter, LEO only. ~85% of the catalogue lives in a band just
    // 6–30% above the surface; at overview zoom 18k min-px dots in that thin
    // annulus fuse into a solid crust over Earth. Thin LEO to a stratified
    // sample as Earth shrinks on screen (aRand is stable per satellite, so the
    // same sats persist frame to frame — no shimmer). MEO / GEO / HEO are
    // sparse and ARE the structure (nav shell, GEO belt), so they never cull.
    // Any explicit filter or isolate means the user asked for a specific
    // subset — show it in full.
    float lodEff = (uGroupSel >= 0.0 || uRegimeSel >= 0.0 || uIsolate > 0.5) ? 0.0 : uLod;
    float keep = max(mix(1.0, 0.55, lodEff) * uKeepScale, uKeepFloor);
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
    vHidden = (aLaunchDay > uTimeDay || decayed > 0.5 || cullFade < 0.01 ||
               (uGroupSel >= 0.0 && abs(aGroup - uGroupSel) > 0.5) ||
               (uRegimeSel >= 0.0 && abs(aRegime - uRegimeSel) > 0.5)) ? 1.0 : 0.0;
    // Surviving LEO dots soften at overview so the band reads as a luminous
    // haze around the globe, resolving into crisp dots as you zoom in.
    vFade = ((aRegime < 0.5) ? mix(1.0, 0.6, lodEff) : 1.0) * cullFade * max(decayFade, 0.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Perspective size with distance falloff, BUT clamped to a visible floor so
    // the shell never collapses into sub-pixel specks when Earth is framed — the
    // LeoLabs read is thousands of CRISP dots, not a faint scatter. Debris slightly
    // smaller so active payloads stand out.
    float sizeMul = aDebris > 0.5 ? 0.7 : 1.0;
    float persp = uSize * sizeMul * uPixelRatio * (1.0 / -mv.z);
    // floor ~1.1 device px keeps every satellite legible without blooming; a
    // tighter ceiling (4.5px) keeps dots CRISP like LeoLabs instead of fat blobs
    // that wash over Earth. At overview zoom the floor eases to ~0.7px so the
    // thinned LEO band stays a haze instead of re-fusing into a crust.
    float minPx = mix(1.1, 0.7, lodEff) * uPixelRatio * sizeMul;
    float s = vHidden > 0.5 ? 0.0 : clamp(persp, minPx, uMaxPx * uPixelRatio);
    gl_PointSize = s;
  }
`
const FRAG = /* glsl */ `
  precision mediump float;
  uniform highp float uIsolate;  // 1 = selected → dim (not hide) the swarm; highp to
                                 // match the vertex declaration or the program fails
                                 // validation (precision mismatch)
  varying vec3 vColor;
  varying float vHidden;
  varying float vDebris;
  varying float vFade;
  void main() {
    if (vHidden > 0.5) discard;
    // Crisp catalogued dot: a bright tight core + a small soft rim. Denser than
    // before so overlapping points build into a luminous shell (the LeoLabs look)
    // rather than a grey haze.
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // TIGHT crisp dot (LeoLabs read): a sharp small core + a very thin rim, so
    // 18k points read as precise pinpoints — not fat additive blobs that bloom
    // over Earth. Narrower core + lower alpha keeps the shell legible but calm.
    float core = 1.0 - smoothstep(0.0, 0.22, d);   // crisp bright core
    float rim  = pow(1.0 - smoothstep(0.18, 0.46, d), 1.5) * 0.28;
    float a = clamp(core + rim, 0.0, 1.0) * 0.92;   // solid dots (LeoLabs density)
    // slight whiten at the very centre keeps each dot a hot point
    vec3 col = mix(vColor, vec3(1.0), core * 0.35);
    a *= vDebris > 0.5 ? 0.45 : 1.0;
    a *= vFade;   // overview LOD: LEO softens into haze when Earth is small
    // Selection dims the swarm to context instead of hiding it — the LeoLabs
    // read keeps the whole field alive with the pick + its orbit highlighted.
    a *= mix(1.0, 0.22, uIsolate);
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
      })
      .catch(() => setSats([]))
    return () => { cancelled = true }
  }, [])

  const markerRef = useRef<THREE.Group>(null)
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
  // Orbit-path polyline for the selected satellite (recomputed on selection).
  const [orbitPts, setOrbitPts] = useState<THREE.Vector3[] | null>(null)
  // SAT-1: orbit-track ellipses for the currently-FILTERED group — a sampled
  // subset (drawing all ~18k would be thousands of lines), each colored by its
  // altitude band, so you see the constellation's STRUCTURE (Starlink shell, GPS
  // ring, GEO belt), not just current dots. null = no group selected (all).
  const [groupTracks, setGroupTracks] = useState<{ pts: THREE.Vector3[]; color: string }[]>([])
  const lastGroupSel = useRef<number>(-1)
  // Which archetype model the selected satellite uses (chosen on selection).
  const [arch, setArch] = useState<Archetype>(ARCHETYPES.cubesat)
  const archRef = useRef<Archetype>(ARCHETYPES.cubesat)
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
    const start = simTimeRef.current.simMs
    const steps = 128
    const out: THREE.Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const t = new Date(start + (periodMin * 60000 * i) / steps)
      let r: { position?: { x: number; y: number; z: number } } | false = false
      try { r = lib.propagate(rec, t) } catch { r = false }
      const p = r && r.position
      if (p) out.push(new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene))
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
    const rands = new Float32Array(n)
    const decays = new Float32Array(n)
    sats.forEach((sv, gi) => {
      groups[gi] = classifyGroup(sv.name, sv.type)
      regimes[gi] = classifyRegimeId(sv.l2)
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
    g.setAttribute("aRand", new THREE.BufferAttribute(rands, 1))
    g.setAttribute("aDecayDay", new THREE.BufferAttribute(decays, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), earthVisualRadius * 12)
    return g
  }, [sats, earthVisualRadius])

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTimeDay.value = msToJ2000Day(simTimeRef.current.simMs)
      matRef.current.uniforms.uGroupSel.value = satGroupFilterRef.current
      matRef.current.uniforms.uRegimeSel.value = satRegimeFilterRef.current
      matRef.current.uniforms.uKeepScale.value = areaScale
      matRef.current.uniforms.uMaxPx.value = maxPx
      // Overview LOD from Earth's APPARENT size on screen (not raw camera
      // distance — screen-relative, so it holds across viewports + FOVs).
      // Earth ≥ ~380px radius → 0 (full catalogue); ≤ ~180px → 1 (LEO haze).
      // Smoothed so crossing the band never pops.
      if (pointsRef.current) {
        pointsRef.current.getWorldPosition(_fieldWorld)
        const dist = camera.position.distanceTo(_fieldWorld)
        const halfFovTan = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)
        const apparentPx = (earthVisualRadius / Math.max(dist * halfFovTan, 1e-6)) * (viewportH / 2)
        const targetLod = THREE.MathUtils.clamp((380 - apparentPx) / (380 - 180), 0, 1)
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
        keepFloorRef.current = Math.min(1, MIN_VISIBLE_DOTS / Math.max(leoCount, 1))
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

    // SAT-2: per-frame interpolation. Every frame (not just on the 4 Hz SGP4
    // step) we lerp the live positions from prevPos→nextPos by how far we are
    // through the current 250 ms window, so the swarm moves continuously.
    if (prevPos.current && nextPos.current) {
      const pos = geometry.getAttribute("position") as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      // Interpolate prev→next across the current sweep window. The window lasts
      // RECOMPUTE_MS; a completed sweep resets sweepStartMs (below), so `t` glides
      // 0→1 over the window regardless of how many frames the slices took.
      const t = Math.min(1, (now - sweepStartMs.current) / RECOMPUTE_MS)
      const a = prevPos.current, b = nextPos.current
      for (let i = 0; i < arr.length; i++) arr[i] = a[i] + (b[i] - a[i]) * t
      pos.needsUpdate = true
    }

    // SAT-3: position the notable craft on their real orbits EVERY frame (only a
    // few propagations → cheap), so the famous hardware glides smoothly. Hidden
    // while a single satellite is isolated (that view is about the one craft).
    {
      const recsN = satrecs.current
      const nowMs = simTimeRef.current.simMs
      const dateN = new Date(nowMs)
      for (let c = 0; c < NOTABLE_CRAFT.length; c++) {
        const g = notableRefs.current[c]
        const idx = notableIdx[c]
        if (!g) continue
        // TRUTH GATE: hide the craft before its real launch date. SGP4 will
        // happily propagate ISS to 6000 BC — but it didn't exist then. Only show
        // once the sim clock has reached the satellite's actual launch.
        const launched = idx >= 0 && sats[idx] ? nowMs >= sats[idx].launchMs : false
        if (idx < 0 || !recsN[idx] || !launched) { g.visible = false; continue }
        let r: { position?: Vec3; velocity?: Vec3 } | false = false
        try { r = lib.propagate(recsN[idx], dateN) } catch { r = false }
        const p = r && r.position
        if (!p) { g.visible = false; continue }
        g.visible = true
        g.position.set(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene)
        // orient along velocity (sample a moment ahead)
        let r2: { position?: Vec3 } | false = false
        try { r2 = lib.propagate(recsN[idx], new Date(dateN.getTime() + 30000)) } catch { r2 = false }
        const p2 = r2 && r2.position
        if (p2) {
          const ahead = new THREE.Vector3(p2.x * kmToScene, p2.z * kmToScene, -p2.y * kmToScene)
          if (ahead.distanceToSquared(g.position) > 1e-9) g.lookAt(ahead)
        }
      }
    }

    const date = new Date(simTimeRef.current.simMs)
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
        const p = r && r.position
        if (!p) { buf[j] = 0; buf[j + 1] = 0; buf[j + 2] = 0; return }
        // ECI km → scene units. Map ECI (x,y,z) to scene (x, z, -y) so the orbital
        // plane sits around Earth's equator in scene space.
        buf[j] = p.x * kmToScene
        buf[j + 1] = p.z * kmToScene
        buf[j + 2] = -p.y * kmToScene
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
        if (sweepCursor.current >= n && now - sweepStartMs.current >= RECOMPUTE_MS) {
          prevPos.current!.set(nx)
          sweepCursor.current = 0
          sweepStartMs.current = now
          lastCompute.current = now
        }
        // Propagate a BUDGET of sats this frame (spread across ~a dozen frames so no
        // single frame stalls on the whole catalogue).
        const budget = Math.max(1500, Math.ceil(recs.length / 12)) * 3 // *3: floats
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
      if (rec) {
        let r: { position?: Vec3; velocity?: Vec3 } | false = false
        try { r = lib.propagate(rec, date) } catch { r = false }
        const p = r && r.position
        if (p) {
          // Keep the card's altitude + speed live as the craft moves along its
          // orbit (apogee/perigee/period/inclination are fixed elements, set once
          // on selection below). This is the "watch it fly" payoff.
          if (selectedOrbitRef.current) {
            selectedOrbitRef.current.altitudeKm =
              Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - EARTH_RADIUS_KM
            const v = r && r.velocity
            if (v) selectedOrbitRef.current.speedKms = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
            // Live sub-satellite point — the lat/lon on Earth it's over RIGHT NOW.
            try {
              const gmst = lib.gstime(date)
              const geo = lib.eciToGeodetic(p, gmst)
              selectedOrbitRef.current.subLatDeg = lib.degreesLat(geo.latitude)
              selectedOrbitRef.current.subLonDeg = lib.degreesLong(geo.longitude)
            } catch { /* keep last */ }
          }
          const cur = new THREE.Vector3(p.x * kmToScene, p.z * kmToScene, -p.y * kmToScene)
          // orient the model along its direction of travel (sample a moment ahead)
          let r2: { position?: { x: number; y: number; z: number } } | false = false
          try { r2 = lib.propagate(rec, new Date(date.getTime() + 30000)) } catch { r2 = false }
          const p2 = r2 && r2.position
          marker.position.copy(cur)
          if (p2) {
            const ahead = new THREE.Vector3(p2.x * kmToScene, p2.z * kmToScene, -p2.y * kmToScene)
            if (ahead.distanceToSquared(cur) > 1e-9) marker.lookAt(ahead)
          }
          marker.visible = true

          // Locator halo: subtends a ~constant small screen size when far (so you
          // can FIND the otherwise-invisible 1:1 craft), then shrinks + fades to
          // nothing as you approach, letting the real model emerge. Sized in the
          // marker's LOCAL space (it's the group child) from the camera distance.
          const halo = haloRef.current
          if (halo) {
            const world = new THREE.Vector3()
            marker.getWorldPosition(world)
            const dist = camera.position.distanceTo(world)
            // Keep a soft locator ring around the craft at ALL distances so you
            // always see WHERE it is — a true-1:1 craft is sub-pixel from afar,
            // so the ring is the reliable "here it is" cue. Fades near the end
            // of a close approach so the real model reads on its own.
            const span = selectedSpanRef.current
            const fade = Math.min(1, Math.max(0.35, (dist / span - 1) / 20))
            // local scale ÷ marker's world scale so the screen size is distance-stable
            const worldScale = marker.getWorldScale(new THREE.Vector3()).x || 1
            const haloLocal = (dist * 0.02 * fade) / worldScale
            halo.scale.setScalar(haloLocal)
            const mat = halo.material as THREE.MeshBasicMaterial
            mat.opacity = 0.55 * fade
            halo.visible = true
          }
        }
        // On a NEW selection: pick the archetype, follow, recompute the orbit, and
        // tighten the camera near-plane / zoom floor so the user can dolly right
        // up to the true-1:1 craft (FlyToController reads focusDepthRef).
        if (sel !== lastSelected.current) {
          lastSelected.current = sel
          setOrbitPts(computeOrbit(rec))

          // altitude + speed (km, km/s) from a fresh propagate → drives archetype
          // choice AND the live card readout.
          const meta = sats.find((s) => s.id === sel)
          let altKm = 0
          let speedKms = 0
          {
            let rr: { position?: Vec3; velocity?: Vec3 } | false = false
            try { rr = lib.propagate(rec, date) } catch { rr = false }
            const pp = rr && rr.position
            if (pp) altKm = Math.sqrt(pp.x * pp.x + pp.y * pp.y + pp.z * pp.z) - EARTH_RADIUS_KM
            const vv = rr && rr.velocity
            if (vv) speedKms = Math.sqrt(vv.x * vv.x + vv.y * vv.y + vv.z * vv.z)
          }
          const a = ARCHETYPES[classifyArchetype(meta?.name ?? "", meta?.owner ?? "", altKm, meta?.type, meta?.launchMs)]
          archRef.current = a
          setArch(a)
          setSelectedLabel(meta ? `${meta.id} · ${meta.name}` : null)

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
            }
          }

          // PROPORTIONALLY-TRUE span: real deployed metres × one shared boost.
          // Literal 1:1 is unrenderable here — at world coords ~150 units,
          // float32 precision is ~1e-5 units, and a 9 m craft IS ~1e-5 units.
          // The ×SELECTED_SCALE_BOOST keeps every craft above that floor while
          // the PROPORTIONS stay honest: the ISS really is ~70× the debris
          // shard. Follow distance + near-plane scale with each craft's span,
          // so arrival frames a 1.5 m fragment as tightly as a station.
          const span = a.k * earthVisualRadius * a.nativeSpan * SELECTED_SCALE_BOOST
          selectedSpanRef.current = span
          focusDepthRef.current = {
            near: Math.max(span * 0.35, 2e-4),
            minDistance: Math.max(span * 1.1, 6e-4),
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
            // frame the craft with breathing room — model + locator ring both read.
            span * 12,
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
        setSelectedLabel(null)
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
            // Calmer base size — crisp pinpoints, not fat blobs. (min-pixel floor
            // in the vertex shader keeps distant sats visible.)
            uSize: { value: 95 },
            uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
            uIsolate: { value: 0 },
            uGroupSel: { value: -1 },
            uRegimeSel: { value: -1 },
            uLod: { value: 1 },
            uKeepScale: { value: 1 },
            uKeepFloor: { value: 0 },
            uMaxPx: { value: 4.5 },
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
        <SatModel url={arch.url} scale={arch.k * earthVisualRadius * SELECTED_SCALE_BOOST} />
        <mesh ref={haloRef}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#ffd24a" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
        {/* Always-visible locator label on the selected object — a LeoLabs-style
            tag so you can read WHAT you're looking at without the side panel. */}
        {selectedLabel && (
          <Html
            center
            distanceFactor={undefined}
            zIndexRange={[30, 0]}
            style={{ pointerEvents: "none", userSelect: "none", transform: "translateY(-22px)" }}
          >
            <div className="whitespace-nowrap rounded-sm border border-accent/50 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-accent backdrop-blur-sm">
              {selectedLabel}
            </div>
          </Html>
        )}
      </group>

      {/* Orbital path of the selected satellite (one full revolution). */}
      {orbitPts && orbitPts.length > 1 && (
        <Line points={orbitPts} color="#ffd24a" transparent opacity={0.4} lineWidth={1} />
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
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none", userSelect: "none", transform: "translateY(-18px)" }}>
              <div className="whitespace-nowrap rounded-sm border border-white/30 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-white/85 backdrop-blur-sm">
                {c.label}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

/** The chosen archetype GLB, cloned for the selected satellite. Cloning keys on
 *  the url so switching archetypes swaps the mesh. */
function SatModel({ url, scale }: { url: string; scale: number }) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => scene.clone(), [scene, url])
  return <primitive object={cloned} scale={scale} />
}
