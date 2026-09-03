/**
 * satellite-data — the Three-FREE satellite data layer: types, shared bridge
 * refs, the SGP4-math helpers, catalogue loading, and classification.
 *
 * WHY THIS FILE EXISTS: the DOM chrome (satellite-search.tsx, the celestial
 * explorer) needs these functions + refs, but they used to live in
 * `satellite-field.tsx`, which imports `three` + `@react-three/fiber` + `drei`.
 * Importing one helper from there dragged the whole ~800 KB Three.js bundle into
 * the page's EAGER first-load chunk, even though the 3D field itself is behind a
 * dynamic import. Moving the pure, render-free pieces here lets the DOM import
 * them with zero Three.js cost; `satellite-field.tsx` re-imports them so the
 * render code is unchanged. One source of truth, no duplication.
 *
 * Nothing here imports three / R3F. satellite.js (SGP4) is loaded dynamically by
 * the field at runtime and its handle is shared via satLibRef.
 */

// ── Shared geometry constant ────────────────────────────────────────────────
export const EARTH_RADIUS_KM = 6371

// ── satellite.js (SGP4) shapes — imported dynamically by the field ──────────
export type Vec3 = { x: number; y: number; z: number }
export type Sgp4 = {
  twoline2satrec: (l1: string, l2: string) => unknown
  propagate: (rec: unknown, date: Date) => { position?: Vec3; velocity?: Vec3 } | false
  gstime: (date: Date) => number
  eciToGeodetic: (eci: Vec3, gmst: number) => { latitude: number; longitude: number; height: number }
  degreesLat: (rad: number) => number
  degreesLong: (rad: number) => number
  degreesToRadians: (deg: number) => number
  eciToEcf: (eci: Vec3, gmst: number) => Vec3
  ecfToLookAngles: (
    observer: { longitude: number; latitude: number; height: number },
    ecf: Vec3,
  ) => { azimuth: number; elevation: number; rangeSat: number }
}

export type SatType = "PAY" | "R/B" | "DEB"
// `group` — for debris, the CelesTrak GP group it came from (fragmentation
// cloud id or "analyst"); absent on payloads. Used to classify the analyst set,
// which is catalogued "UNKNOWN" and can't be matched by name.
export type Sat = { id: number; name: string; owner: string; type?: SatType; group?: string; launchMs: number; l1: string; l2: string }

// ── Catalogue record + metadata types ───────────────────────────────────────
export type SatMeta = { id: number; name: string; owner: string; type?: SatType; group?: string; launchMs: number; site?: string }
export type SatRecord = SatMeta & { l1: string; l2: string }

export type SatOrbit = {
  altitudeKm: number
  speedKms: number
  apogeeKm: number
  perigeeKm: number
  periodMin: number
  inclinationDeg: number
  regime: string
  subLatDeg: number
  subLonDeg: number
  slantRangeKm: number | null
  elevationDeg: number | null
  sunlit: boolean
  orbitsPerDay: number
  groundSpeedKms: number
}

export type NearestSat = {
  id: number
  name: string
  slantRangeKm: number
  elevationDeg: number
  altitudeKm: number
}

export type LaunchMate = {
  id: number
  name: string
  type: "PAY" | "R/B" | "DEB" | string
  piece: string
  altitudeKm: number | null
}

// ── Bridge refs (DOM ↔ field) ────────────────────────────────────────────────
export const selectedArchetypeRef: { current: string | null } = { current: null }
export const selectedArchetypeIdRef: { current: string | null } = { current: null }
export const selectedOrbitRef: { current: SatOrbit | null } = { current: null }

/** The user's own location in RADIANS (satellite.js observerGd form). */
export const observerRef: {
  current: { longitude: number; latitude: number; height: number } | null
} = { current: null }

/** Field publishes these once the catalogue + satellite.js load, so the DOM card
 *  can scan on demand without re-fetching. satrecsRef aligns with satsRef. */
export const satLibRef: { current: Sgp4 | null } = { current: null }
export const satrecsRef: { current: unknown[] } = { current: [] }
export const satsRef: { current: Sat[] } = { current: [] }

export const satTypeFilterRef: { current: number } = { current: -1 }
export const satRegimeFilterRef: { current: number } = { current: -1 }
export const debrisFamilyFilterRef: { current: number } = { current: -1 }

// ── Group + debris-family data ───────────────────────────────────────────────
export const SAT_GROUPS = [
  "Starlink", "OneWeb", "Navigation", "Stations", "Debris", "Rocket bodies", "Other",
] as const

export const DEBRIS_FAMILIES = [
  { id: 0, prefix: "FENGYUN 1C", label: "Fengyun-1C", event: "China ASAT test", year: 2007 },
  { id: 1, prefix: "COSMOS 2251", label: "Cosmos-2251", event: "Iridium collision", year: 2009 },
  { id: 2, prefix: "IRIDIUM 33", label: "Iridium-33", event: "Cosmos collision", year: 2009 },
  { id: 3, prefix: "COSMOS 1408", label: "Cosmos-1408", event: "Russia ASAT test", year: 2021 },
  // Uncorrelated / unidentified tracked objects (CelesTrak `analyst` set) — real
  // debris whose parent object isn't attributed. Matched by GROUP, not name
  // (they're catalogued "UNKNOWN"), so it carries no prefix.
  { id: 4, prefix: "", group: "analyst", label: "Unidentified", event: "Uncorrelated tracked objects", year: 0 },
  // The full Space-Track catalogue adds thousands more. Two catch-alls so every
  // extra object still lands in a real family (never -1): spent rocket stages,
  // then everything else (fragments from older/smaller breakups). Order matters —
  // classifyDebrisFamily tries the named clouds first, so these only catch the rest.
  { id: 5, prefix: "", matchRB: true, label: "Rocket bodies", event: "Spent upper stages", year: 0 },
  { id: 6, prefix: "", catchAll: true, label: "Other tracked debris", event: "Fragments from earlier breakups", year: 0 },
] as const

// ── SGP4 date guard + finite check (Three-free) ──────────────────────────────
const SPACE_AGE_START_MS = Date.UTC(1957, 9, 4) // Sputnik 1
const SPACE_AGE_END_MS = Date.UTC(2075, 0, 1)
export const clampToSpaceAge = (ms: number) =>
  ms < SPACE_AGE_START_MS ? SPACE_AGE_START_MS : ms > SPACE_AGE_END_MS ? SPACE_AGE_END_MS : ms

/** A propagated position is USABLE only if it exists and every component is
 *  finite — SGP4 returns NaN/Inf (without throwing) far from a TLE's epoch. */
export function finitePos(
  r: { position?: { x: number; y: number; z: number } } | false | null | undefined,
): { x: number; y: number; z: number } | null {
  const p = r && r.position
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null
  return p
}

// ── Classification (name/TLE based) ──────────────────────────────────────────
/** Debris fragmentation family id, or -1 if this isn't debris/junk. Precedence:
 *  named fragmentation clouds (by name prefix) → analyst set (by `group`) →
 *  rocket bodies (by type) → catch-all "other tracked debris". With the full
 *  Space-Track catalogue this puts EVERY object in a real family (never -1 for
 *  a genuine DEB/RB), so the debris panel's totals stay honest. */
export function classifyDebrisFamily(name: string, group?: string, type?: SatType): number {
  const n = name.toUpperCase()
  // 1) named fragmentation clouds — most specific, always win.
  for (const f of DEBRIS_FAMILIES) if (f.prefix && n.startsWith(f.prefix)) return f.id
  // 2) the CelesTrak analyst set, matched by its provenance group.
  if (group) {
    const byGroup = DEBRIS_FAMILIES.find((f) => "group" in f && f.group === group)
    if (byGroup) return byGroup.id
  }
  // 3) rocket bodies (Space-Track OBJECT_TYPE = ROCKET BODY, or an "R/B" name).
  if (type === "R/B" || n.includes(" R/B") || n.endsWith(" DEB (R/B)")) {
    const rb = DEBRIS_FAMILIES.find((f) => "matchRB" in f && f.matchRB)
    if (rb) return rb.id
  }
  // 4) everything else that's debris → the catch-all family.
  if (type === "DEB" || type === "R/B") {
    const other = DEBRIS_FAMILIES.find((f) => "catchAll" in f && f.catchAll)
    if (other) return other.id
  }
  return -1
}

export function classifyRegimeId(l2: string): number {
  const mm = parseFloat(l2.substring(52, 63))
  if (!(mm > 0)) return 0
  const ecc = parseFloat("0." + l2.substring(26, 33).trim())
  if (ecc > 0.25) return 3
  const n = (mm * 2 * Math.PI) / 86400
  const a = Math.cbrt(398600.4418 / (n * n))
  const alt = a - 6371
  if (alt < 2000) return 0
  if (alt < 34000) return 1
  if (alt < 37000) return 2
  return 1
}

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

/** Name the orbit band from apogee/perigee. */
export function orbitRegime(apogeeKm: number, perigeeKm: number): string {
  const mean = (apogeeKm + perigeeKm) / 2
  const ecc = (apogeeKm - perigeeKm) / (apogeeKm + perigeeKm + 2 * EARTH_RADIUS_KM)
  if (ecc > 0.25) return "Highly elliptical (HEO)"
  if (mean < 2000) return "Low Earth orbit (LEO)"
  if (mean < 34000) return "Medium Earth orbit (MEO)"
  if (mean < 37000) return "Geostationary (GEO)"
  return "High orbit"
}

// ── COSPAR launch designator + launch-mates ──────────────────────────────────
/** TLE line 1, cols 10–14 = "YYNNN" (year + launch number); shared by every
 *  object from the same launch. "" if the TLE has no designator. */
export function launchDesignator(l1?: string): string {
  if (!l1 || l1.length < 14) return ""
  return l1.slice(9, 14).trim()
}

/** Every OTHER tracked object from the same launch as `satId` (its rocket body +
 *  catalogued fragments), each with current altitude via SGP4. */
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
  const out: LaunchMate[] = []
  for (let i = 0; i < sats.length; i++) {
    const s = sats[i]
    if (s.id === satId) continue
    if (launchDesignator(s.l1) !== launch) continue
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
      piece: s.l1.length >= 17 ? s.l1.slice(14, 17).trim() : "",
      altitudeKm,
    })
  }
  const rank = (t: string) => (t === "R/B" ? 0 : t === "DEB" ? 1 : 2)
  out.sort((a, b) => rank(a.type) - rank(b.type) || (b.altitudeKm ?? 0) - (a.altitudeKm ?? 0))
  return out
}

/** Scan the FULL catalogue for the object physically closest to the user right
 *  now (smallest slant range) among those above their horizon. One SGP4 pass. */
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
    if (la.elevation <= 0) continue
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

// ── Shared FULL-catalogue cache (fetched + parsed exactly once) ──────────────
/** Provenance header of the baked catalogue (snapshot date, source line, type
 *  breakdown). Filled as a side effect of loadFullCatalog so the transparency
 *  metrics panel can show WHERE the data came from without a second download. */
export type CatalogHeader = { snapshot?: string; source?: string; count?: number; breakdown?: Record<string, number> }
export const catalogHeaderRef: { current: CatalogHeader | null } = { current: null }

let _fullCatalogPromise: Promise<SatRecord[]> | null = null
export function loadFullCatalog(): Promise<SatRecord[]> {
  if (!_fullCatalogPromise) {
    _fullCatalogPromise = fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d) => {
        catalogHeaderRef.current = { snapshot: d.snapshot, source: d.source, count: d.count, breakdown: d.breakdown }
        return d.sats as SatRecord[]
      })
      .catch(() => [])
  }
  return _fullCatalogPromise
}

/** Metadata-only view for the search box (no second download). Keeps `group`
 *  so the debris panel can classify the analyst / Space-Track families. */
export function loadSatelliteCatalog(): Promise<SatMeta[]> {
  return loadFullCatalog().then((sats) =>
    sats.map((s) => ({ id: s.id, name: s.name, owner: s.owner, type: s.type, group: s.group, launchMs: s.launchMs, site: s.site })),
  )
}
