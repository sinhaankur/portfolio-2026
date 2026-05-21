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
  parent: "Earth" | "Jupiter" | "Saturn" | "Neptune"
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
