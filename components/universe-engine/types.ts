/**
 * Universe Engine — public types.
 *
 * Anything a consumer of <UniverseEngine /> might need to read or pass through
 * the hover/info pipeline lives here. R3F-internal types (ScenePlanet etc.)
 * also live here so the data + scene files stay decoupled.
 */

export type BodyInfo = {
  name: string
  classification: string
  surfaceTempK?: { min?: number; mean: number; max?: number }
  surfaceTempC?: { mean: number }
  aAU?: number
  periodDays?: number
  rotHours?: number
  tiltDeg?: number
  radiusEarth?: number
  moons?: number
  fact?: string
  /** True if the body responds to a click (e.g. Polaris resets the view). */
  clickable?: boolean
}

export type HoverHandler = (info: BodyInfo | null) => void

export type Planet = {
  name: string
  aAU: number
  radiusEarth: number
  periodDays: number
  tiltDeg: number
  rotHours: number
  inclDeg: number
  startPhase: number
  shade: string
  surfaceTempK: { min?: number; mean: number; max?: number }
  classification: string
  moons: number
  fact?: string
  hasRings?: boolean
  /** Optional equirectangular surface texture URL — when set, the planet
   *  morphs from its abstract grey shade to the photographic globe on hover. */
  textureUrl?: string
}

export type ScenePlanet = {
  raw: Planet
  orbitRadius: number
  visualRadius: number
  orbitalSpeedRadPerSec: number
  rotSpeedRadPerSec: number
  axialTilt: number
  inclination: number
}

export type MoonData = {
  name: string
  parent: "Earth" | "Mars" | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  visualRadius: number
  orbitRadius: number
  periodDays: number
  shade: string
  fact: string
}

export type ConstellationStar = {
  name: string
  designation: string
  raHours: number
  decDeg: number
  magnitude: number
}

export type ConstellationId =
  | "ursa-major"
  | "polaris"
  | "orion"
  | "cassiopeia"
  | "leo"
  | "lyra"
  | "cygnus"
  | "scorpius"
  | "crux"
  | "centaurus"
  | "sagittarius"
  | "pegasus"

export type Constellation = {
  id: ConstellationId
  name: string
  designation: string
  fact: string
  /** Member stars in the asterism, in the order referenced by edges. */
  stars: ConstellationStar[]
  /** Index pairs into `stars` — each pair draws one line segment of the asterism. */
  edges: [number, number][]
  /** Click target — e.g. Polaris resets the camera. */
  clickAction?: "reset-view"
}

/**
 * A named small body — comet, asteroid, or interstellar visitor.
 *
 * The Data Engine extension to UniverseEngine. Each body declares its
 * orbital elements; the renderer animates it continuously along an
 * approximated Kepler orbit (semi-major axis + eccentricity + inclination
 * + epoch phase). Periodic bodies (Halley, Tempel-Tuttle, etc.) keep
 * coming back; interstellar visitors (1I/'Oumuamua, 2I/Borisov) follow
 * a one-way hyperbolic-ish path that doesn't repeat.
 *
 * Add entries to `namedBodies` in astronomy.ts — they appear in the scene
 * automatically with name-on-hover, kind-aware styling, and per-period
 * orbital animation. This is intentionally a data-only authoring surface
 * so the catalog can keep growing.
 */
export type NamedBody = {
  /** Common name shown in the cursor label / info panel. */
  name: string
  /** Catalog designation (e.g. "1P/Halley"). */
  designation: string
  /** Category — drives styling + hit-zone behavior. */
  kind: "comet" | "asteroid" | "interstellar" | "spacecraft" | "dwarf"
  /** Semi-major axis in AU. For interstellars, this is the perihelion distance. */
  aAU: number
  /** Eccentricity (0 = circular, <1 elliptical, >=1 unbound). */
  eccentricity: number
  /** Orbital inclination relative to the ecliptic, in degrees. */
  inclDeg: number
  /** Period in Earth years. Use Infinity for interstellar visitors. */
  periodYears: number
  /** 0–1 phase along the orbit at scene start (jitters body positions). */
  startPhase: number
  /** Short fact shown in the info panel. */
  fact: string
  /** Visual sphere radius in scene units (default 0.05). */
  visualRadius?: number
  /** Optional hex colour override. Defaults derived from `kind`. */
  shade?: string
}

/**
 * A far-field point projected onto the sky-shell at fixed RA/Dec.
 *
 * Covers everything that isn't part of the solar system: galaxies,
 * nebulae, star clusters, exoplanet host stars. Real-world J2000
 * coordinates project to a sphere around the Sun (same shell that
 * constellations live on), so the layout reads as a real sky chart.
 *
 * Each kind gets its own rendering treatment in scene.tsx — galaxies
 * and nebulae are diffuse halos, clusters small point clouds, exoplanet
 * hosts a single accent dot with a host-tag visible on hover.
 */
export type SkyPoint = {
  id: string
  name: string
  designation: string
  kind: "galaxy" | "nebula" | "cluster" | "exoplanet-host" | "black-hole"
  raHours: number
  decDeg: number
  /** Distance from Earth as a human-readable string (e.g. "2.5 million ly"). */
  distance?: string
  /** Apparent magnitude — used to scale the visual size for stars + dots. */
  magnitude?: number
  /** Visual size in scene units. Defaults vary by kind (galaxies ~3, dots ~0.4). */
  visualSize?: number
  /** Short fact shown in the info panel. */
  fact: string
}
