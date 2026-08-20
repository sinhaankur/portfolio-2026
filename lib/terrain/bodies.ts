/**
 * Terrain engine — the TRUTH SPINE.
 *
 * One table drives the whole planetary-terrain explorer (`/lab/terrain`), exactly
 * as `astronomy.ts` drives the orbital engine: adding a body is a one-entry edit.
 *
 * Every value here is REAL and SOURCED (USGS Astrogeology / GEBCO / NASA). The
 * renderer displaces a sphere by the body's actual elevation map, so the terrain
 * a viewer flies over is the measured surface — Olympus Mons is 21 km because the
 * data says 21 km, not because we sculpted it. Where a body's global DEM isn't
 * yet baked, `heightMap` is null and the picker shows it as "baking".
 *
 * No React, no Three — pure data + helpers (mirrors the engine's astronomy.ts
 * discipline so this file stays testable and import-cheap).
 */

export type TerrainSourceKind = "laser-altimeter" | "radar" | "stereo" | "bathymetry"

/**
 * A high-resolution REGIONAL height tile — a bounded lat/lon window cropped from
 * the body's native-resolution DEM at far finer detail than the whole-planet map.
 * When the deep-zoom camera descends over a region's bounds, the patch swaps its
 * sampling to this tile, so the max-zoom view is crisp (real relief) instead of a
 * blur of the global map. Baked via `fetch-terrain-dem.mjs <body> --region <id>`.
 */
export interface TerrainRegion {
  /** Stable id (kebab). */
  id: string
  /** Display name (e.g. "Valles Marineris"). */
  name: string
  /** Region bounds in degrees: west/east longitude, south/north latitude. */
  lonW: number
  lonE: number
  latS: number
  latN: number
  /** Path to the baked regional height tile (16-bit equirectangular crop). */
  tile: string
  /** True if the tile lives only on R2 (heavy) — loaded via the CDN. */
  tileOnR2?: boolean
}

export interface RoverSite {
  /** Display name of the mission / landing site. */
  name: string
  /** Real landing latitude, degrees (+N). */
  lat: number
  /** Real landing longitude, degrees East (0–360 or -180..180; we normalise). */
  lon: number
  /** Landing (or arrival) year, for the label. */
  year: number
  /**
   * NASA Mars Rover Photos API rover slug, when live imagery is available
   * (api.nasa.gov/mars-photos). Undefined = historic site, marker only.
   */
  roverSlug?: "perseverance" | "curiosity" | "opportunity" | "spirit"
  /** One-line human note shown in the site panel. */
  note: string
}

export interface TerrainBody {
  /** Stable id used in the URL hash + picker (`mars`, `moon`, …). */
  id: string
  /** Display name. */
  name: string
  /** Mean radius in km (real). Sets the sphere scale + elevation-to-radius ratio. */
  radiusKm: number
  /**
   * Real global elevation range in METRES relative to the datum (areoid / geoid /
   * sphere). Used to decode the 16-bit height map back to true metres and to size
   * the honest vertical scale. Source noted per body below.
   */
  elevationMinM: number
  elevationMaxM: number
  /**
   * Default vertical exaggeration for the FIRST view. Real planetary relief is
   * tiny next to planetary radius (Everest is 0.1% of Earth's radius), so a
   * displayed 1× looks like a smooth ball. We open at a legible exaggeration and
   * ALWAYS label it; the HUD slider reaches down to true 1×. Honesty rule:
   * the number is shown, never hidden.
   */
  defaultExaggeration: number
  /**
   * Path to the 16-bit greyscale height map (equirectangular, 0=min, 65535=max
   * across [elevationMinM, elevationMaxM]). null until baked → picker shows
   * "baking". Committed small; deep tiles come from R2 later.
   */
  heightMap: string | null
  /**
   * True once this (heavy) height map has been uploaded to R2
   * (assets.sinhaankur.com) — then production serves it from the CDN with the
   * committed copy as local fallback. Until it's actually on R2, leave this OFF
   * so the map loads from the repo copy and never 404s. Mars's 29 KB map ships
   * from the repo and doesn't need R2; the Moon (3.2 MB) + Earth (3.0 MB) maps
   * are R2 candidates — flip this to true after running scripts/upload-terrain.sh.
   */
  heightMapOnR2?: boolean
  /**
   * This height map lives ONLY on R2 — it's too large to commit (e.g. the 11 MB
   * GEBCO 15″ map). `heightMap` holds the R2 key path; there's no repo copy.
   */
  heightMapR2Only?: boolean
  /**
   * Set true ONLY after an R2-only map has actually been uploaded (run
   * scripts/upload-terrain.sh). Until then the body stays HIDDEN from the picker
   * so it never 404s to a smooth ball — the CDN base is always configured (it's
   * in .env.local), so "CDN up" alone isn't proof the file exists. Flip this the
   * moment the upload succeeds and GEBCO appears.
   */
  heightMapUploaded?: boolean
  /** Path to the colour/albedo map (equirectangular). Reuses engine textures. */
  colorMap: string
  /** What instrument measured the elevation (shown as provenance). */
  source: TerrainSourceKind
  /** Data attribution string (credited per the attribution principle). */
  attribution: string
  /** Accent colour for the body in the picker / HUD. */
  accent: string
  /** One-line hook shown under the name in the picker. */
  tagline: string
  /** Rover / lander sites to pin on the surface (real coords). */
  sites: RoverSite[]
  /**
   * High-resolution regional tiles. When the deep-zoom camera descends over a
   * region's bounds, the patch loads its tile for crisp max-zoom detail.
   */
  regions?: TerrainRegion[]
  /** Optional: this body has a real ocean we can drain (Earth). */
  hasOcean?: boolean
  /** Sea-level elevation in metres (for the ocean toggle). Earth = 0. */
  seaLevelM?: number
  /**
   * Open with the hypsometric (elevation-tint) overlay on. True for Earth: its
   * colour map paints blue oceans, which is wrong once drained — the depth tint
   * reveals the real seafloor instead. Bodies whose colour map already is the
   * bare surface (Mars, Moon) default off.
   */
  defaultHypsometric?: boolean
}

/**
 * The bodies. Mars is fully wired first (real MOLA); the rest carry their real
 * elevation ranges + sources now, `heightMap: null` until baked, so the picker
 * and provenance are correct from day one and turning one on is a bake + a path.
 */
export const TERRAIN_BODIES: TerrainBody[] = [
  {
    id: "mars",
    name: "Mars",
    radiusKm: 3389.5,
    // MOLA global relief — exact from the DEM's own statistics (aux.xml):
    // STATISTICS_MINIMUM -8201 m (Hellas basin), STATISTICS_MAXIMUM 21241 m
    // (Olympus Mons summit). Real measured span, not rounded.
    elevationMinM: -8201,
    elevationMaxM: 21241,
    defaultExaggeration: 20,
    heightMap: "/textures/terrain/mars-height-2k.png",
    colorMap: "/textures/mars.webp",
    source: "laser-altimeter",
    attribution: "Elevation: NASA MGS MOLA (USGS Astrogeology, public domain)",
    accent: "#e07a4f",
    tagline: "Olympus Mons, Valles Marineris — the real MOLA surface",
    sites: [
      {
        name: "Perseverance — Jezero Crater",
        lat: 18.4447,
        lon: 77.4508,
        year: 2021,
        roverSlug: "perseverance",
        note: "Ancient river delta; caching samples for return. Live imagery.",
      },
      {
        name: "Curiosity — Gale Crater",
        lat: -4.5895,
        lon: 137.4417,
        year: 2012,
        roverSlug: "curiosity",
        note: "Climbing Mount Sharp's sedimentary layers. Live imagery.",
      },
      {
        name: "Opportunity — Meridiani Planum",
        lat: -1.9462,
        lon: 354.4734,
        year: 2004,
        roverSlug: "opportunity",
        note: "Drove 45 km over 14 years; found hematite 'blueberries'.",
      },
      {
        name: "Viking 1 — Chryse Planitia",
        lat: 22.697,
        lon: 311.811,
        year: 1976,
        note: "First successful U.S. Mars landing.",
      },
    ],
    regions: [
      {
        // The grandest canyon in the solar system — 4000 km long, up to 7 km deep.
        // Cropped from the native-resolution MOLA source at ~10× the global map's
        // detail density over this window.
        id: "valles-marineris",
        name: "Valles Marineris",
        lonW: -95,
        lonE: -35,
        latS: -20,
        latN: 10,
        tile: "/textures/terrain/mars-valles-marineris-2k.png",
      },
      {
        // The tallest volcano in the solar system — ~22 km high, 600 km across.
        // Centre ~226°E (-134°), +18° lat.
        id: "olympus-mons",
        name: "Olympus Mons",
        lonW: -152,
        lonE: -116,
        latS: 2,
        latN: 34,
        tile: "/textures/terrain/mars-olympus-mons-2k.png",
      },
      {
        // Perseverance's home — an ancient crater lake + river delta. ~77.4°E, 18.4°N.
        id: "jezero",
        name: "Jezero Crater",
        lonW: 70,
        lonE: 85,
        latS: 12,
        latN: 24,
        tile: "/textures/terrain/mars-jezero-2k.png",
      },
    ],
  },
  {
    id: "moon",
    name: "The Moon",
    radiusKm: 1737.4,
    // LOLA global relief — exact from the LDEM_64 PDS label (DN × 0.5 m):
    // MINIMUM -18251 DN → -9125.5 m (near South Pole–Aitken), MAXIMUM 21546 DN
    // → +10773 m (far-side highlands). Real measured span.
    elevationMinM: -9126,
    elevationMaxM: 10773,
    defaultExaggeration: 15,
    heightMap: "/textures/terrain/moon-height-2k.png",
    heightMapOnR2: false, // 3.2 MB — R2 candidate; flip true after upload
    colorMap: "/textures/moon.webp",
    source: "laser-altimeter",
    attribution: "Elevation: NASA LRO LOLA (USGS Astrogeology, public domain)",
    accent: "#c9c4bd",
    tagline: "Apollo & Chang'e sites over real LOLA topography",
    sites: [
      { name: "Apollo 11 — Sea of Tranquility", lat: 0.6741, lon: 23.4730, year: 1969, note: "First crewed landing." },
      { name: "Apollo 17 — Taurus–Littrow", lat: 20.1908, lon: 30.7717, year: 1972, note: "Last crewed landing; geologist Schmitt aboard." },
      { name: "Chang'e 4 — Von Kármán Crater", lat: -45.4446, lon: 177.5991, year: 2019, note: "First soft landing on the far side." },
    ],
    regions: [
      {
        // Tycho — a young, sharp rayed crater with a dramatic central peak.
        // ~85 km wide, centred ~11.4°W, 43.3°S.
        id: "tycho",
        name: "Tycho Crater",
        lonW: -19,
        lonE: -3,
        latS: -51,
        latN: -35,
        tile: "/textures/terrain/moon-tycho-2k.png",
      },
    ],
  },
  {
    id: "mercury",
    name: "Mercury",
    radiusKm: 2439.7,
    // MESSENGER global DEM relief — measured on bake: -5380 m to +4480 m.
    elevationMinM: -5380,
    elevationMaxM: 4480,
    defaultExaggeration: 25,
    heightMap: "/textures/terrain/mercury-height-2k.png",
    colorMap: "/textures/mercury.webp",
    source: "stereo",
    attribution: "Elevation: NASA MESSENGER (USGS Astrogeology, public domain)",
    accent: "#b9a99a",
    tagline: "Caloris basin, scarps — MESSENGER's mapped surface",
    sites: [],
  },
  {
    id: "venus",
    name: "Venus",
    radiusKm: 6051.8,
    // Magellan radar topo relief: ≈ -2900 m (datum) to +11000 m (Maxwell Montes).
    elevationMinM: -2900,
    elevationMaxM: 10998,
    defaultExaggeration: 30,
    heightMap: "/textures/terrain/venus-height-2k.png",
    colorMap: "/textures/venus.webp",
    source: "radar",
    attribution: "Elevation: NASA Magellan radar (USGS Astrogeology, public domain)",
    accent: "#d9b98a",
    tagline: "Maxwell Montes under the clouds — Magellan radar relief",
    sites: [],
    regions: [
      {
        // Maxwell Montes — the highest mountains on Venus, ~11 km above the mean
        // radius. In Ishtar Terra, centred ~3.3°E, 65.2°N.
        id: "maxwell-montes",
        name: "Maxwell Montes",
        lonW: -12,
        lonE: 20,
        latS: 55,
        latN: 75,
        tile: "/textures/terrain/venus-maxwell-montes-2k.png",
      },
    ],
  },
  {
    id: "earth",
    name: "Earth (oceans drained)",
    radiusKm: 6371.0,
    // ETOPO 2022 BED elevation — the solid surface below both ice and water.
    // Declared range spans Challenger Deep (≈ -10900 m) to Everest (≈ 8849 m);
    // the 60″ global bed grid downsampled to 2K resolves ≈ -10196 m … +6288 m
    // (peaks average down at this resolution). Decode uses the declared range.
    elevationMinM: -10900,
    elevationMaxM: 8849,
    defaultExaggeration: 12,
    heightMap: "/textures/terrain/earth-height-2k.png",
    heightMapOnR2: false, // 3.0 MB — R2 candidate; flip true after upload
    colorMap: "/textures/earth.webp",
    source: "bathymetry",
    attribution: "Elevation: NOAA NCEI ETOPO 2022 bed elevation (public domain)",
    accent: "#5aa9e0",
    tagline: "Drain the oceans: mid-ocean ridges & trenches, really there",
    sites: [],
    hasOcean: true,
    seaLevelM: 0,
    defaultHypsometric: true,
  },
  {
    id: "earth-gebco",
    name: "Earth (GEBCO 15″)",
    radiusKm: 6371.0,
    // GEBCO_2024 combined bathymetry + topography at 15 arc-second — ~4× ETOPO's
    // resolution, baked to a 4K map. Same real range; sharper seafloor detail
    // (ridges, fracture zones, seamount chains). Decode uses the declared range.
    elevationMinM: -10900,
    elevationMaxM: 8849,
    defaultExaggeration: 12,
    // R2-only (11 MB, too big to commit). The path is the R2 key; hidden from
    // the picker until the CDN base is set AND the file is uploaded.
    heightMap: "earth-gebco-height-4k.png",
    heightMapR2Only: true,
    colorMap: "/textures/earth.webp",
    source: "bathymetry",
    attribution: "Elevation: GEBCO Compilation Group (GEBCO_2024 Grid) — CC BY 4.0",
    accent: "#4fb0d9",
    tagline: "The sharper seafloor — GEBCO 15″ bathymetry",
    sites: [],
    hasOcean: true,
    seaLevelM: 0,
    defaultHypsometric: true,
  },
]

export function getTerrainBody(id: string): TerrainBody | undefined {
  return TERRAIN_BODIES.find((b) => b.id === id)
}

/** True when the R2 asset CDN is configured (its base env is set). */
export function isAssetCdnConfigured(): boolean {
  return Boolean((process.env.NEXT_PUBLIC_ASSET_CDN_BASE ?? "").trim())
}

/**
 * Bodies to show in the picker. An R2-only body (e.g. GEBCO) is hidden until its
 * map is actually uploaded (`heightMapUploaded`) AND the CDN is configured, so it
 * never renders as a smooth 404 ball. Flip `heightMapUploaded` after running
 * scripts/upload-terrain.sh and GEBCO appears.
 */
export function visibleTerrainBodies(): TerrainBody[] {
  const cdnUp = isAssetCdnConfigured()
  return TERRAIN_BODIES.filter(
    (b) => !b.heightMapR2Only || (b.heightMapUploaded && cdnUp),
  )
}

/** Normalise a longitude (any convention) to [-180, 180] degrees. */
export function normLon(lonDeg: number): number {
  let l = ((lonDeg + 180) % 360 + 360) % 360 - 180
  if (l === -180) l = 180
  return l
}

/**
 * Convert body lat/lon (degrees) to a unit direction on the sphere, matching the
 * equirectangular height/colour maps: lon 0 at +X, increasing east toward +Z,
 * lat + toward +Y. The renderer scales this by (radius + displacement).
 */
export function latLonToUnitVec(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180
  const lon = (normLon(lonDeg) * Math.PI) / 180
  const cosLat = Math.cos(lat)
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)]
}

/** Real elevation range span in metres (for decoding the height map). */
export function elevationSpanM(body: TerrainBody): number {
  return body.elevationMaxM - body.elevationMinM
}
