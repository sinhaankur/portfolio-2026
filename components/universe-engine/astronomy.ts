/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Universe Engine — astronomy data + helpers.
 *
 * Everything in this file is pure data or pure math: no React, no R3F.
 * Real-world values (AU, period in days, RA/Dec, axial tilt) are kept
 * faithful — the scene-scale conversion happens via {@link buildScenePlanets}
 * and {@link raDecToScenePos}.
 *
 * Scale model:
 *   Milky Way diameter ≈ 100,000 ly → galaxy radius 130 scene units.
 *   Sun → galactic centre ≈ 26,670 ly (ratio 0.505) → Sun sits at scene-x 66.
 */

import type {
  BodyInfo,
  Constellation,
  ConstellationStar,
  MoonData,
  NamedBody,
  Planet,
  ScenePlanet,
  SkyPoint,
} from "./types"

/* --------------------------------------------------------------------------
 * Scene-scale constants
 * ------------------------------------------------------------------------ */

export const GALAXY_RADIUS_SCENE = 130
export const SUN_OFFSET_SCENE = 66
export const SOLAR_SYSTEM_POSITION: [number, number, number] = [
  SUN_OFFSET_SCENE,
  0,
  0,
]

// Galactic plane tilt relative to the ecliptic (real ~60.2°).
export const GALACTIC_PLANE_TILT_RAD = 60.2 * (Math.PI / 180)

// Sky-shell distance for constellation projection (around the Sun, not the galactic centre).
export const SKY_SHELL_DISTANCE = 150

/* --------------------------------------------------------------------------
 * Time warp
 *
 * Module-scoped mutable ref is read inside useFrame loops — avoids re-render
 * storms when the user drags the slider. Trade-off: only one UniverseEngine
 * can be active per page (which matches the realistic use-case).
 * ------------------------------------------------------------------------ */

// At multiplier=1, Earth completes one orbit in 24 seconds.
const BASE_TIME_WARP_DAYS_PER_SEC = 365.25 / 24

export const TIME_WARP_DAYS_PER_SEC = BASE_TIME_WARP_DAYS_PER_SEC

export const timeWarpRef = { current: 1.0 }

/* --------------------------------------------------------------------------
 * Simulation clock
 *
 * Tracks how much simulated time has advanced since the page loaded, so
 * the HUD can surface a real calendar date and waypoints can eventually
 * scrub to specific dates (Halley's perihelion, the next eclipse, your
 * birthday). The accumulator is advanced by the SceneClock component
 * each frame using `delta × TIME_WARP_DAYS_PER_SEC × timeWarpRef.current`,
 * which is the exact same scaling every orbiting body uses — so the
 * displayed date stays in lockstep with where the planets visibly are.
 *
 * `epochMs` is captured at module load on the client (Date.now()); the
 * displayed date is `epochMs + days × 86_400_000`. Pausing the time-warp
 * slider freezes both the bodies and the date.
 * ------------------------------------------------------------------------ */

export const simTimeRef = {
  current: {
    /** Days elapsed in simulation since page load. */
    days: 0,
    /** Real-world epoch the simulation started from. Set on first read. */
    epochMs: typeof Date !== "undefined" ? Date.now() : 0,
  },
}

export const DEG = Math.PI / 180

/* --------------------------------------------------------------------------
 * Black-hole physics
 *
 * The Schwarzschild radius is the radius at which an object's escape
 * velocity equals the speed of light — i.e. the size of the event
 * horizon for a non-rotating black hole.
 *
 *     rs = 2 G M / c²
 *
 * For a Kerr (rotating) black hole the event-horizon radius shrinks
 * with spin: r₊ = (M + √(M² - a²M²)) · G/c²
 * where 'a' is the dimensionless spin parameter (0 to 1).
 *
 * Real-world reference points:
 *   - Earth   (5.97e24 kg)              rs ≈ 8.87 mm
 *   - Sun     (1 M☉)                    rs ≈ 2.95 km
 *   - Sgr A*  (4.15e6 M☉)               rs ≈ 12.3 million km
 *   - M87*    (6.5e9 M☉)                rs ≈ 1.92e10 km ≈ 128 AU
 *   - TON 618 (66e9 M☉)                 rs ≈ 1.95e11 km ≈ 1,304 AU
 *
 * The visualisation uses a sqrt-of-log scaling so all three black holes
 * in the catalog read as distinct sizes without the supermassive ones
 * dwarfing Cygnus X-1 by a factor of 10⁹.
 * ------------------------------------------------------------------------ */

/** Gravitational constant (m³·kg⁻¹·s⁻²). */
export const G_NEWTON = 6.674e-11
/** Speed of light (m/s). */
export const C_LIGHT = 299_792_458
/** Solar mass (kg). */
export const SOLAR_MASS_KG = 1.98892e30
/** Astronomical unit (m). */
export const AU_METERS = 1.495978707e11

/**
 * Schwarzschild radius in metres, given mass in solar masses (M☉).
 * Pure form of `rs = 2GM / c²`.
 */
export function schwarzschildRadiusMeters(massSolar: number): number {
  const massKg = massSolar * SOLAR_MASS_KG
  return (2 * G_NEWTON * massKg) / (C_LIGHT * C_LIGHT)
}

/**
 * Kerr event-horizon radius for a rotating BH. Reduces to rs at spin=0;
 * gives M·G/c² (half of rs) at spin=1 (maximal Kerr). Returns metres.
 */
export function kerrHorizonRadiusMeters(massSolar: number, spin: number): number {
  const rs = schwarzschildRadiusMeters(massSolar)
  // r₊ = (M + √(M² − a²M²)) · G/c² = (rs/2) · (1 + √(1 − a²))
  const a = Math.min(Math.max(spin, 0), 0.9999)
  return (rs / 2) * (1 + Math.sqrt(1 - a * a))
}

/**
 * Pretty-print a length for the BH data overlay. Picks the most
 * legible unit per order of magnitude:
 *   < 1 km     → metres
 *   < 1 AU     → kilometres (with comma grouping)
 *   < 1 ly     → AU
 *   otherwise  → light-years
 */
export function formatLength(metres: number): string {
  const km = metres / 1000
  const au = metres / AU_METERS
  const ly = metres / 9.461e15
  if (metres < 1000) return `${metres.toFixed(2)} m`
  if (au < 1) return `${Math.round(km).toLocaleString()} km`
  if (ly < 1) {
    if (au < 100) return `${au.toFixed(2)} AU`
    return `${Math.round(au).toLocaleString()} AU`
  }
  return `${ly.toFixed(2)} ly`
}

/** Format a mass in solar masses for the overlay. */
export function formatSolarMass(m: number): string {
  if (m < 1000) return `${m.toLocaleString()} M☉`
  if (m < 1e6) return `${(m / 1000).toFixed(1)} × 10³ M☉`
  if (m < 1e9) return `${(m / 1e6).toFixed(1)} × 10⁶ M☉`
  return `${(m / 1e9).toFixed(1)} × 10⁹ M☉`
}

/* --------------------------------------------------------------------------
 * Fly-to controller
 *
 * Module-scoped target that the in-scene FlyToController reads in useFrame.
 * Body click handlers + the destinations menu both write into this ref; the
 * controller animates the OrbitControls target + camera distance toward it.
 *
 * Same trade-off as timeWarpRef: only one engine per page (we share one ref).
 *
 * Vector3 lives here as a plain { x, y, z } so this file stays React/R3F-free.
 * The controller copies it into a real Three.Vector3 before lerping.
 * ------------------------------------------------------------------------ */

export type FlyToTarget = {
  /** World-space focal point in scene units. */
  target: { x: number; y: number; z: number }
  /** Desired camera distance from the target after the fly. */
  distance: number
  /** Set true to ask the controller to animate; controller clears it on arrival. */
  active: boolean
  /** Optional human-readable name — purely for telemetry / debugging. */
  label?: string
  /** Optional fixed camera position. When non-null, the controller drives
   *  the camera toward this specific point instead of moving it along
   *  the existing target→camera ray. Used for narrative beats (e.g. the
   *  Pale Blue Dot vantage) where *where you look from* is the story. */
  cameraPos: { x: number; y: number; z: number } | null
  /** Optional caption text shown by the HUD while this fly is active. */
  caption: string | null
  /** Optional caption attribution rendered under the caption. */
  captionSource: string | null
}

export const flyToRef: { current: FlyToTarget } = {
  current: {
    target: { x: SUN_OFFSET_SCENE, y: 0, z: 0 },
    distance: 13,
    active: false,
    cameraPos: null,
    caption: null,
    captionSource: null,
  },
}

/** Request a fly-to. Body click handlers + the HUD destinations menu both call this. */
export function requestFlyTo(
  target: { x: number; y: number; z: number },
  distance: number,
  label?: string,
  options?: {
    cameraPos?: { x: number; y: number; z: number }
    caption?: string
    captionSource?: string
  },
) {
  // Any new fly-to cancels an active follow — they're mutually exclusive
  // modes. The follow stays sticky until the user takes a deliberate
  // action that hands the camera back to a fixed target.
  followRef.current = null
  flyToRef.current.target.x = target.x
  flyToRef.current.target.y = target.y
  flyToRef.current.target.z = target.z
  flyToRef.current.distance = distance
  flyToRef.current.active = true
  flyToRef.current.label = label
  flyToRef.current.cameraPos = options?.cameraPos ?? null
  flyToRef.current.caption = options?.caption ?? null
  flyToRef.current.captionSource = options?.captionSource ?? null
}

/* --------------------------------------------------------------------------
 * Follow controller
 *
 * Sustained tracking of a moving body — currently used by comets, where
 * double-clicking the comet locks the camera onto its orbital path and
 * follows it as it sweeps through perihelion. The FlyToController reads
 * this ref each frame; when set, it overrides the static fly-to target
 * with the body's current world position.
 *
 * The follower is a getter function so callers (NamedBodyMesh) can pass a
 * closure over their own group ref — the ref is read once per frame and
 * gives an always-current world position without needing to plumb a body
 * id through the controller.
 *
 * Cleared by: requestFlyTo (any new fly cancels follow), explicit
 * cancelFollow() call, or the engine's reset handler.
 * ------------------------------------------------------------------------ */

export type FollowGetter = () => { x: number; y: number; z: number } | null

export const followRef: {
  current: {
    getter: FollowGetter
    distance: number
    label?: string
    /** Set true by the FlyToController once the initial fly-in has
     *  arrived at the target. After that, the camera-distance lerp
     *  stops fighting user input — drag rotates, scroll zooms, and
     *  the controller only keeps the *target* tracking the body. */
    arrived: boolean
  } | null
} = { current: null }

/** Request follow mode. Cancels any in-flight fly-to. */
export function requestFollow(getter: FollowGetter, distance: number, label?: string) {
  flyToRef.current.active = false
  followRef.current = { getter, distance, label, arrived: false }
}

/** Cancel follow mode (called by reset, by a new fly, by Esc / explore toggle). */
export function cancelFollow() {
  followRef.current = null
}

/** Cancel any active fly-to. Called when the user takes over via explore mode. */
export function cancelFlyTo() {
  flyToRef.current.active = false
}

/* --------------------------------------------------------------------------
 * Default journey
 *
 * Plays automatically while the user hasn't entered explore mode. The
 * camera moves through a small loop of canonical sights — opens with a
 * solar-system overview, then visits Saturn → galactic centre → Andromeda
 * → Orion Nebula → back to open view. Loops until the user clicks "Tap
 * to explore," at which point the journey stops and the user has the
 * controls. Respects prefers-reduced-motion (skipped if true).
 *
 * Linger values include the fly-in animation (~1s) plus the dwell time
 * at the target. Tuned to feel unhurried — each scene gets ~5s to read.
 * ------------------------------------------------------------------------ */

export type JourneyWaypoint = {
  target: { x: number; y: number; z: number }
  distance: number
  label?: string
  /** ms to linger before flying to the next waypoint. */
  linger: number
  /** Optional fixed camera position. When set, overrides the usual
   *  "preserve viewing direction" behaviour so the camera ends up at a
   *  specific point instead of `distance` units away along the existing
   *  ray. Used for narrative beats (Pale Blue Dot) where the *vantage
   *  point* is the story, not just the subject. */
  cameraPos?: { x: number; y: number; z: number }
  /** Optional caption rendered while this waypoint is active. Pure text;
   *  long-form captions are wrapped at narrow widths in the HUD. */
  caption?: string
  /** Optional attribution shown under the caption (smaller, dimmer). */
  captionSource?: string
}

export const DEFAULT_JOURNEY: JourneyWaypoint[] = [
  {
    target: { x: SUN_OFFSET_SCENE, y: 4, z: 9 },
    distance: 14,
    label: "Open view",
    linger: 6500,
  },
  {
    // Saturn — Park ~9.27 scene units from the Sun, slightly above the
    // ecliptic so the rings catch the camera at an interesting angle.
    target: { x: SUN_OFFSET_SCENE + 9.27, y: 0.35, z: 0 },
    distance: 2.2,
    label: "Saturn",
    linger: 6500,
  },
  {
    // Pale Blue Dot — Voyager 1's vantage on Valentine's Day 1990.
    // Target is Earth (≈ 3 scene units from the Sun, on its start-phase
    // position); camera is fixed ~46 scene units out, high above the
    // ecliptic to mimic Voyager 1's actual heliocentric position
    // (35.7° inclination, ~166 AU today). The fixed camera position is
    // what makes the *vantage* the story — Earth shows up as a single
    // sub-pixel speck against the void, exactly as Sagan described it.
    target: { x: SUN_OFFSET_SCENE - 0.63, y: 0, z: 2.93 },
    cameraPos: { x: SUN_OFFSET_SCENE - 28, y: 22, z: 30 },
    distance: 46,
    label: "Pale Blue Dot",
    caption:
      "Look again at that dot. That's here. That's home. That's us. On it, everyone you love, everyone you know, everyone you ever heard of, every human being who ever was, lived out their lives.",
    captionSource: "Carl Sagan · Pale Blue Dot · 1994",
    linger: 11000,
  },
  {
    // Galactic centre (Sgr A*) — origin of the MilkyWay group.
    target: { x: 0, y: 0, z: 0 },
    distance: 38,
    label: "Galactic centre",
    linger: 6500,
  },
  {
    // Andromeda (M31) — projected onto the sky-shell around the Sun.
    target: { x: SUN_OFFSET_SCENE + 102.2, y: 99.0, z: 16.9 },
    distance: 22,
    label: "Andromeda",
    linger: 7000,
  },
  {
    // Orion Nebula (M42) — projected onto the sky-shell around the Sun.
    target: { x: SUN_OFFSET_SCENE - 53.1, y: -14.1, z: -138.5 },
    distance: 14,
    label: "Orion Nebula",
    linger: 7000,
  },
]


/* --------------------------------------------------------------------------
 * Info records — surface on hover
 * ------------------------------------------------------------------------ */

export const MILKY_WAY_INFO: BodyInfo = {
  name: "Milky Way",
  classification: "Barred spiral galaxy · SBbc",
  fact: "~100,000 ly across · 400 billion stars · 4 major arms (Perseus, Sagittarius, Scutum-Centaurus, Norma). Our Sun sits ~26,670 ly from the galactic centre, on the Orion Arm.",
}

export const SGR_A_INFO: BodyInfo = {
  name: "Sagittarius A*",
  classification: "Supermassive black hole",
  surfaceTempK: { mean: 0 },
  fact: "Galactic centre. ~4.15 million solar masses, event horizon ~24 million km. The whole Milky Way rotates around it.",
}

export const SUN_INFO: BodyInfo = {
  name: "Sun",
  classification: "G2V — Yellow Dwarf",
  surfaceTempK: { mean: 5778 },
  surfaceTempC: { mean: 5505 },
  fact: "Core temperature ≈ 15.7M K. Converts ~4M tonnes of mass into energy every second.",
}

export const ASTEROID_BELT_INFO: BodyInfo = {
  name: "Asteroid Belt",
  classification: "Circumstellar disc · 2.2–3.2 AU",
  fact: "Between Mars and Jupiter. ~1.9 million asteroids larger than 1 km — Ceres, Vesta, Pallas, Hygiea hold ~half the total mass. Total mass: ~4% of Earth's Moon.",
}

export const KUIPER_BELT_INFO: BodyInfo = {
  name: "Kuiper Belt",
  classification: "Trans-Neptunian disc · 30–50 AU",
  fact: "Home to Pluto, Eris, Makemake, Haumea. Holds short-period comets. Source region for many of the icy bodies that visit the inner solar system.",
}

/* --------------------------------------------------------------------------
 * Planets (real astronomical values)
 * ------------------------------------------------------------------------ */

export const planetsData: Planet[] = [
  { name: "Mercury", aAU: 0.387, radiusEarth: 0.383, periodDays: 87.97,   tiltDeg: 0.03,   rotHours: 1407.6, inclDeg: 7.005, startPhase: 0.0, shade: "#7a7a7a", surfaceTempK: { min: 100, mean: 440, max: 700 }, classification: "Terrestrial planet", moons: 0, fact: "No atmosphere. Day side 700 K, night side 100 K — biggest swing in the solar system. A year on Mercury is just 88 Earth days; a single day is 176 Earth days. Two years pass for every day.", textureUrl: "/textures/mercury.webp", deep: { massEarth: 0.0553, densityGcc: 5.43, gravity: 3.70, escapeVelocityKms: 4.30, eccentricity: 0.206 } },
  { name: "Venus",   aAU: 0.723, radiusEarth: 0.949, periodDays: 224.70,  tiltDeg: 177.4,  rotHours: -5832.5, inclDeg: 3.395, startPhase: 2.1, shade: "#bdbdbd", surfaceTempK: { mean: 737 }, classification: "Terrestrial planet (retrograde)", moons: 0, fact: "Hottest surface — 737 K — runaway CO₂ greenhouse. Rotates backwards on a 243-day day. The 177° axial tilt means Venus is technically upside-down relative to the rest of the planets.", textureUrl: "/textures/venus.webp", deep: { massEarth: 0.815, densityGcc: 5.24, gravity: 8.87, escapeVelocityKms: 10.36, eccentricity: 0.007 } },
  { name: "Earth",   aAU: 1.000, radiusEarth: 1.000, periodDays: 365.25,  tiltDeg: 23.44,  rotHours: 23.93,  inclDeg: 0.000, startPhase: 4.5, shade: "#dcdcdc", surfaceTempK: { min: 184, mean: 288, max: 330 }, classification: "Terrestrial planet — life", moons: 1, fact: "Mean surface 288 K. Only known planet with liquid water and life.", textureUrl: "/textures/earth.webp", deep: { massEarth: 1.000, densityGcc: 5.51, gravity: 9.81, escapeVelocityKms: 11.19, eccentricity: 0.017 } },
  { name: "Mars",    aAU: 1.524, radiusEarth: 0.532, periodDays: 686.97,  tiltDeg: 25.19,  rotHours: 24.62,  inclDeg: 1.850, startPhase: 1.3, shade: "#c1623a", surfaceTempK: { min: 130, mean: 210, max: 308 }, classification: "Terrestrial planet", moons: 2, fact: "Thin CO₂ atmosphere, polar ice caps, evidence of ancient liquid water. Hosts the solar system's tallest mountain (Olympus Mons, 22 km) and longest canyon (Valles Marineris, 4,000 km). The 25° axial tilt gives Mars Earth-like seasons.", textureUrl: "/textures/mars.webp", deep: { massEarth: 0.107, densityGcc: 3.93, gravity: 3.71, escapeVelocityKms: 5.03, eccentricity: 0.094 } },
  { name: "Jupiter", aAU: 5.203, radiusEarth: 11.21, periodDays: 4332.59, tiltDeg: 3.13,   rotHours: 9.92,   inclDeg: 1.303, startPhase: 5.8, shade: "#cfcfcf", surfaceTempK: { mean: 165 }, classification: "Gas giant", moons: 95, fact: "Largest planet. 10-hour day. Great Red Spot is a storm wider than Earth.", textureUrl: "/textures/jupiter.webp", deep: { massEarth: 317.8, densityGcc: 1.33, gravity: 24.79, escapeVelocityKms: 59.5, eccentricity: 0.049 } },
  { name: "Saturn",  aAU: 9.537, radiusEarth: 9.449, periodDays: 10759.22,tiltDeg: 26.73,  rotHours: 10.66,  inclDeg: 2.485, startPhase: 3.2, shade: "#bababa", surfaceTempK: { mean: 134 }, classification: "Gas giant", moons: 146, fact: "Ring system spans 282,000 km but is only ~10 m thick.", hasRings: true, textureUrl: "/textures/saturn.webp", deep: { massEarth: 95.16, densityGcc: 0.69, gravity: 10.44, escapeVelocityKms: 35.5, eccentricity: 0.057 } },
  { name: "Uranus",  aAU: 19.19, radiusEarth: 4.007, periodDays: 30688.50,tiltDeg: 97.77,  rotHours: -17.24, inclDeg: 0.773, startPhase: 0.7, shade: "#a5dad0", surfaceTempK: { mean: 76 }, classification: "Ice giant (sideways)", moons: 28, fact: "Rotates on its side at 98° tilt — likely from an ancient collision. Each pole experiences 42 years of sunlight followed by 42 years of darkness. Surface methane gives it that pale blue-green colour.", textureUrl: "/textures/uranus.webp", deep: { massEarth: 14.54, densityGcc: 1.27, gravity: 8.87, escapeVelocityKms: 21.3, eccentricity: 0.046, discoveredYear: 1781, discoveredBy: "William Herschel" } },
  { name: "Neptune", aAU: 30.07, radiusEarth: 3.883, periodDays: 60182.00,tiltDeg: 28.32,  rotHours: 16.11,  inclDeg: 1.770, startPhase: 2.9, shade: "#4a6db8", surfaceTempK: { mean: 72 }, classification: "Ice giant", moons: 16, fact: "Coldest planet. Fastest winds in the solar system — 2,100 km/h supersonic gales. 165-year orbit means it has completed only one orbit since its discovery in 1846.", textureUrl: "/textures/neptune.webp", deep: { massEarth: 17.15, densityGcc: 1.64, gravity: 11.15, escapeVelocityKms: 23.5, eccentricity: 0.011, discoveredYear: 1846, discoveredBy: "Le Verrier / Galle" } },
  // Pluto — reclassified to dwarf planet in 2006 but still part of the family.
  // 17.16° inclination really does tilt its ring above the ecliptic — Pluto
  // crosses inside Neptune's orbit for ~20 years every 248-year orbit.
  { name: "Pluto",   aAU: 39.48, radiusEarth: 0.186, periodDays: 90560.00,tiltDeg: 122.5,  rotHours: -153.3, inclDeg: 17.16, startPhase: 4.1, shade: "#a07b54", surfaceTempK: { min: 33, mean: 44, max: 55 }, classification: "Dwarf planet · Kuiper Belt", moons: 5, fact: "Reclassified from planet to dwarf planet in 2006. 17° orbital inclination lifts it above the ecliptic. Charon is so massive (12% of Pluto's mass) they orbit a barycentre outside Pluto's surface — effectively a binary system. The famous heart-shaped Tombaugh Regio was photographed by New Horizons in 2015.", deep: { massEarth: 0.00220, densityGcc: 1.86, gravity: 0.62, escapeVelocityKms: 1.21, eccentricity: 0.244, discoveredYear: 1930, discoveredBy: "Clyde Tombaugh" } },
]

export function buildScenePlanets(): ScenePlanet[] {
  return planetsData.map((p) => {
    const orbitRadius = Math.sqrt(p.aAU) * 3
    // Visual size is sqrt-scaled from real Earth-radii so the giants don't
    // visually dwarf the inner planets, then floored at 0.13 scene units so
    // tiny bodies like Pluto stay findable on their orbit ring instead of
    // shrinking to a pinprick.
    const visualRadius = Math.max(0.13, Math.sqrt(p.radiusEarth) * 0.2)
    const orbitalSpeedRadPerSec = (2 * Math.PI) / (p.periodDays / TIME_WARP_DAYS_PER_SEC)
    const rotSpeedRadPerSec = (2 * Math.PI) / ((p.rotHours / 24) / TIME_WARP_DAYS_PER_SEC)
    return {
      raw: p,
      orbitRadius,
      visualRadius,
      orbitalSpeedRadPerSec,
      rotSpeedRadPerSec,
      axialTilt: p.tiltDeg * DEG,
      inclination: p.inclDeg * DEG,
    }
  })
}

export function planetToInfo(p: Planet): BodyInfo {
  return {
    name: p.name,
    classification: p.classification,
    surfaceTempK: p.surfaceTempK,
    surfaceTempC: { mean: Math.round(p.surfaceTempK.mean - 273.15) },
    aAU: p.aAU,
    periodDays: p.periodDays,
    rotHours: p.rotHours,
    tiltDeg: p.tiltDeg,
    radiusEarth: p.radiusEarth,
    moons: p.moons,
    fact: p.fact,
    deep: p.deep,
  }
}

/* --------------------------------------------------------------------------
 * Moons (real data)
 * ------------------------------------------------------------------------ */

export const moons: MoonData[] = [
  { name: "Moon (Luna)",     parent: "Earth",   visualRadius: 0.05,  orbitRadius: 0.42, periodDays: 27.32,  shade: "#bdbdbd", fact: "Earth's only natural satellite. Surface temp −173 to +127 °C. Tidally locked — same face always toward Earth.", textureUrl: "/textures/moon.webp" },
  // Mars's two tiny moons — both probably captured asteroids
  { name: "Phobos",          parent: "Mars",    visualRadius: 0.025, orbitRadius: 0.38, periodDays: 0.319,  shade: "#9a8b78", fact: "Closer to its planet than any other moon in the solar system — orbits Mars in just 7.6 hours. Spirals inward by ~1.8 m per century; will eventually crash or shatter into a ring." },
  { name: "Deimos",          parent: "Mars",    visualRadius: 0.020, orbitRadius: 0.55, periodDays: 1.263,  shade: "#a89a85", fact: "Smaller of Mars's two moons — only 12 km across. From the Martian surface, Deimos would look like a slightly brighter star, not a disc." },
  { name: "Io",              parent: "Jupiter", visualRadius: 0.05,  orbitRadius: 0.95, periodDays: 1.77,   shade: "#cfcfcf", fact: "Most volcanically active body in the solar system — 400+ active volcanoes from tidal heating from Jupiter." },
  { name: "Europa",          parent: "Jupiter", visualRadius: 0.045, orbitRadius: 1.15, periodDays: 3.55,   shade: "#dcdcdc", fact: "Icy crust over a subsurface ocean. One of the best candidates for life beyond Earth." },
  { name: "Ganymede",        parent: "Jupiter", visualRadius: 0.07,  orbitRadius: 1.40, periodDays: 7.15,   shade: "#bababa", fact: "Largest moon in the solar system — bigger than Mercury. Has its own magnetic field." },
  { name: "Callisto",        parent: "Jupiter", visualRadius: 0.065, orbitRadius: 1.75, periodDays: 16.69,  shade: "#9a9a9a", fact: "Most heavily cratered body known. Outermost Galilean moon — sees least of Jupiter's radiation." },
  // Saturn's notable moons — Titan + Enceladus + Mimas + Iapetus
  { name: "Mimas",           parent: "Saturn",  visualRadius: 0.030, orbitRadius: 1.45, periodDays: 0.942,  shade: "#cccccc", fact: "The 'Death Star moon' — a 130-km crater (Herschel) covers a third of its face, making it eerily resemble the Empire's battle station decades before Star Wars existed." },
  { name: "Enceladus",       parent: "Saturn",  visualRadius: 0.040, orbitRadius: 1.65, periodDays: 1.370,  shade: "#f5f5f5", fact: "Geysers of liquid water erupt through cracks at its south pole, feeding Saturn's E-ring. Cassini flew through the plumes and detected organic molecules — one of the strongest candidates for life beyond Earth." },
  { name: "Titan",           parent: "Saturn",  visualRadius: 0.08,  orbitRadius: 1.85, periodDays: 15.95,  shade: "#d6c98c", fact: "Saturn's largest moon — bigger than Mercury. Only moon with a thick atmosphere (nitrogen + methane). Has lakes of liquid methane." },
  { name: "Iapetus",         parent: "Saturn",  visualRadius: 0.060, orbitRadius: 2.10, periodDays: 79.32,  shade: "#76695a", fact: "Two-faced moon — one hemisphere is bright water ice, the other is black as coal. The leading face sweeps up dust from outer moon Phoebe, painting it dark; the trailing face stays clean." },
  // Uranus's notable moon
  { name: "Miranda",         parent: "Uranus",  visualRadius: 0.035, orbitRadius: 0.70, periodDays: 1.413,  shade: "#bcb8b0", fact: "The most geologically bizarre body in the solar system — sheer cliffs 20 km tall (taller than Everest), chevron-shaped features, and patchwork terrain that looks like the moon was smashed apart and put back together." },
  { name: "Triton",          parent: "Neptune", visualRadius: 0.055, orbitRadius: 0.95, periodDays: -5.88,  shade: "#d8c6b8", fact: "Neptune's largest moon. Orbits BACKWARDS (retrograde) — likely a captured Kuiper Belt object." },
  // Charon — Pluto's largest moon. Tidally locked in a mutual rotation
  // (Pluto-Charon are double-tidally-locked: both faces stay turned to each other).
  { name: "Charon",          parent: "Pluto",   visualRadius: 0.04,  orbitRadius: 0.22, periodDays: 6.39,   shade: "#9e958a", fact: "Half the diameter of Pluto. Mutually tidally locked — the two bodies present the same face to each other forever. Discovered in 1978 from a smudge on a photographic plate." },
]

/* --------------------------------------------------------------------------
 * Named small bodies — comets, asteroids, interstellars
 *
 * Add an entry and it joins the scene with its name on hover, orbital
 * animation tuned to its real period, and a hover-info panel summarising
 * what it is. This is the Data Engine's extension point — keep growing
 * the catalog and the scene will keep evolving.
 *
 * Notes on values:
 *   - Periodic bodies have finite periodYears; their phase loops.
 *   - Interstellar visitors set periodYears: Infinity — the renderer
 *     interprets this as a one-way crossing along a hyperbolic path
 *     and never recycles them on screen.
 *   - eccentricity ~0 = circular, ~0.5 = clearly elliptical,
 *     0.97 (Halley) = a long thin streak.
 * ------------------------------------------------------------------------ */

export const namedBodies: NamedBody[] = [
  // ----- Periodic comets — sources of named annual meteor showers -----
  {
    name: "Halley's Comet",
    designation: "1P/Halley",
    kind: "comet",
    aAU: 17.8,
    eccentricity: 0.967,
    inclDeg: 162.3,        // retrograde — orbits backwards relative to the planets
    periodYears: 75.3,
    startPhase: 0.62,
    fact: "Returns every ~76 years; next perihelion in 2061. Parent body of both the Eta Aquariids (May) and Orionids (October) meteor showers — Earth crosses its trail twice per orbit.",
    visualRadius: 0.07,
  },
  {
    name: "Comet Swift-Tuttle",
    designation: "109P/Swift–Tuttle",
    kind: "comet",
    aAU: 26.1,
    eccentricity: 0.963,
    inclDeg: 113.4,
    periodYears: 133.3,
    startPhase: 0.18,
    fact: "Source of the Perseids meteor shower (peaks August 12 each year). Nucleus is ~26 km across — one of the largest objects that repeatedly crosses Earth's orbit.",
    visualRadius: 0.06,
  },
  {
    name: "Comet Tempel-Tuttle",
    designation: "55P/Tempel–Tuttle",
    kind: "comet",
    aAU: 10.3,
    eccentricity: 0.906,
    inclDeg: 162.5,
    periodYears: 33.2,
    startPhase: 0.34,
    fact: "Source of the Leonids meteor shower (peaks November 17). Every 33 years its return triggers spectacular Leonid storms — the 1833 storm rained ~100,000 meteors per hour over North America.",
    visualRadius: 0.05,
  },
  {
    name: "Comet Encke",
    designation: "2P/Encke",
    kind: "comet",
    aAU: 2.22,
    eccentricity: 0.848,
    inclDeg: 11.8,
    periodYears: 3.3,
    startPhase: 0.71,
    fact: "Shortest-period known comet — completes an orbit in just 3.3 years, the second comet ever found to be periodic. Parent of the Taurid meteor shower in October/November.",
    visualRadius: 0.05,
  },
  {
    name: "Comet Giacobini-Zinner",
    designation: "21P/Giacobini–Zinner",
    kind: "comet",
    aAU: 3.5,
    eccentricity: 0.706,
    inclDeg: 31.9,
    periodYears: 6.6,
    startPhase: 0.05,
    fact: "Parent of the Draconids meteor shower (peaks October 8). Visited by the ICE spacecraft in 1985 — the first ever direct flyby of a comet's tail.",
    visualRadius: 0.05,
  },
  // ----- Named near-Earth + main-belt asteroids -----
  {
    name: "Apophis",
    designation: "99942 Apophis",
    kind: "asteroid",
    aAU: 0.922,
    eccentricity: 0.191,
    inclDeg: 3.34,
    periodYears: 0.89,
    startPhase: 0.44,
    fact: "370-metre near-Earth asteroid that passes inside the Moon's orbit on April 13, 2029 — closer than geostationary satellites. Originally feared to be on an impact trajectory; later radar passes ruled out a strike this century.",
    visualRadius: 0.045,
  },
  {
    name: "Eros",
    designation: "433 Eros",
    kind: "asteroid",
    aAU: 1.458,
    eccentricity: 0.223,
    inclDeg: 10.83,
    periodYears: 1.76,
    startPhase: 0.81,
    fact: "First near-Earth asteroid discovered (1898). The NEAR Shoemaker spacecraft orbited Eros for a year and soft-landed on its surface in 2001 — the first ever asteroid landing.",
    visualRadius: 0.05,
  },
  {
    name: "Chiron",
    designation: "2060 Chiron",
    kind: "asteroid",
    aAU: 13.7,
    eccentricity: 0.379,
    inclDeg: 6.93,
    periodYears: 50.4,
    startPhase: 0.27,
    fact: "Centaur — outer-solar-system body orbiting between Saturn and Uranus. Behaves like a hybrid: it has a tail and coma like a comet, but a large rocky/icy body like an asteroid. The discovery of Chiron in 1977 forced astronomers to invent a new category.",
    visualRadius: 0.05,
  },
  {
    name: "Vesta",
    designation: "4 Vesta",
    kind: "asteroid",
    aAU: 2.362,
    eccentricity: 0.089,
    inclDeg: 7.14,
    periodYears: 3.63,
    startPhase: 0.55,
    fact: "Brightest asteroid as seen from Earth — visible to the naked eye at opposition. Second-largest object in the asteroid belt after Ceres; visited by NASA's Dawn spacecraft 2011–2012.",
    visualRadius: 0.05,
  },
  {
    name: "Ceres",
    designation: "1 Ceres",
    kind: "asteroid",
    aAU: 2.77,
    eccentricity: 0.0758,
    inclDeg: 10.59,
    periodYears: 4.60,
    startPhase: 0.12,
    fact: "Largest object in the asteroid belt and the only dwarf planet in the inner solar system. Round enough to be in hydrostatic equilibrium. NASA's Dawn mission orbited it 2015–2018.",
    visualRadius: 0.06,
  },
  {
    name: "Pallas",
    designation: "2 Pallas",
    kind: "asteroid",
    aAU: 2.77,
    eccentricity: 0.231,
    inclDeg: 34.84,
    periodYears: 4.61,
    startPhase: 0.78,
    fact: "Third-largest asteroid, but with the most extreme inclination of any major body (~35°) — it cuts diagonally across the belt instead of riding the ecliptic.",
    visualRadius: 0.05,
  },
  {
    name: "Hygiea",
    designation: "10 Hygiea",
    kind: "asteroid",
    aAU: 3.14,
    eccentricity: 0.114,
    inclDeg: 3.84,
    periodYears: 5.57,
    startPhase: 0.41,
    fact: "Possibly the smallest dwarf planet — VLT imagery in 2019 revealed a near-spherical shape, making it a strong candidate for reclassification.",
    visualRadius: 0.05,
  },
  {
    name: "Bennu",
    designation: "101955 Bennu",
    kind: "asteroid",
    aAU: 1.126,
    eccentricity: 0.204,
    inclDeg: 6.03,
    periodYears: 1.20,
    startPhase: 0.93,
    fact: "Carbon-rich near-Earth asteroid. NASA's OSIRIS-REx scooped a 122 g sample in 2020; the capsule landed back on Earth in September 2023, the first US asteroid sample return.",
    visualRadius: 0.04,
  },
  {
    name: "Ryugu",
    designation: "162173 Ryugu",
    kind: "asteroid",
    aAU: 1.189,
    eccentricity: 0.190,
    inclDeg: 5.88,
    periodYears: 1.30,
    startPhase: 0.07,
    fact: "Diamond-shaped near-Earth asteroid sampled by JAXA's Hayabusa2 in 2019; 5.4 g returned to Earth in 2020. Pre-dates the solar system's planets — preserves grains from the molecular cloud our Sun formed in.",
    visualRadius: 0.04,
  },
  // ----- Interstellar visitors — one-way trajectories -----
  {
    name: "'Oumuamua",
    designation: "1I/2017 U1 ('Oumuamua)",
    kind: "interstellar",
    aAU: 0.255,            // perihelion distance (0.255 AU, inside Mercury's orbit)
    eccentricity: 1.20,     // hyperbolic
    inclDeg: 122.7,
    periodYears: Infinity,
    startPhase: 0.5,
    fact: "First confirmed interstellar object ever observed (October 2017). Cigar-shaped, ~100 m long, accelerating in ways comets don't quite explain. Now leaving the solar system forever at 26 km/s.",
    visualRadius: 0.04,
  },
  {
    name: "Comet Borisov",
    designation: "2I/Borisov",
    kind: "interstellar",
    aAU: 2.006,            // perihelion (2.006 AU, just outside Mars)
    eccentricity: 3.36,     // strongly hyperbolic
    inclDeg: 44.05,
    periodYears: Infinity,
    startPhase: 0.5,
    fact: "Second known interstellar visitor (August 2019). Unlike 'Oumuamua, Borisov was clearly a comet — visible coma and tail. Spectroscopy showed exotic chemistry hinting at an origin around a cool red-dwarf star.",
    visualRadius: 0.04,
  },
  // ----- Trans-Neptunian dwarf planets — Pluto's distant cousins -----
  {
    name: "Eris",
    designation: "136199 Eris",
    kind: "dwarf",
    aAU: 67.78,
    eccentricity: 0.434,
    inclDeg: 44.04,
    periodYears: 558,
    startPhase: 0.21,
    fact: "Slightly larger than Pluto and 27% more massive — its discovery in 2005 triggered the great planetary redefinition of 2006. Its highly inclined orbit takes it from 38 AU at perihelion to 97 AU at aphelion. Largest known dwarf planet.",
    visualRadius: 0.08,
  },
  {
    name: "Sedna",
    designation: "90377 Sedna",
    kind: "dwarf",
    aAU: 506,
    eccentricity: 0.851,
    inclDeg: 11.93,
    periodYears: 11400,
    startPhase: 0.5,
    fact: "Currently the third-most distant known body in the solar system — out near 84 AU at perihelion, but reaches 937 AU at aphelion. A single Sedna year is 11,400 Earth years. May be a member of the inner Oort Cloud.",
    visualRadius: 0.06,
  },
  {
    name: "Makemake",
    designation: "136472 Makemake",
    kind: "dwarf",
    aAU: 45.79,
    eccentricity: 0.156,
    inclDeg: 28.99,
    periodYears: 309,
    startPhase: 0.62,
    fact: "Third-largest dwarf planet, in the classical Kuiper Belt. Named for the creator god of Rapa Nui (Easter Island). Discovered Easter 2005. Surface coated in frozen methane and ethane.",
    visualRadius: 0.06,
  },
  {
    name: "Haumea",
    designation: "136108 Haumea",
    kind: "dwarf",
    aAU: 43.13,
    eccentricity: 0.196,
    inclDeg: 28.21,
    periodYears: 283,
    startPhase: 0.39,
    fact: "Spins so fast (one rotation every 3.9 hours) that it's been pulled into an elongated football shape — roughly 2,300 km long by 1,000 km wide. The first known TNO with confirmed rings, discovered 2017. Has two small moons, Hi'iaka and Namaka.",
    visualRadius: 0.06,
  },
  {
    name: "Gonggong",
    designation: "225088 Gonggong",
    kind: "dwarf",
    aAU: 67.38,
    eccentricity: 0.502,
    inclDeg: 30.66,
    periodYears: 553,
    startPhase: 0.85,
    fact: "Fifth-largest known dwarf planet, with a deep red surface from frozen methane irradiated by cosmic rays. Discovered in 2007, formally named in 2019 for the Chinese water god. Has a moon, Xiangliu.",
    visualRadius: 0.06,
  },
  // ----- Active spacecraft — human-built outposts at known positions -----
  // Orbital values here are conceptual approximations; spacecraft are
  // rendered as gently drifting points so the user can find each one even
  // though their real trajectories don't loop.
  {
    name: "Voyager 1",
    designation: "Voyager 1 · NASA · 1977",
    kind: "spacecraft",
    aAU: 166,              // current heliocentric distance (mid-2025)
    eccentricity: 1.00001,  // escape trajectory
    inclDeg: 35.7,
    periodYears: Infinity,
    startPhase: 0.0,
    fact: "Furthest human-made object — outside the heliopause as of August 2012. Still transmitting from ~166 AU on a 22.6-watt signal that takes 23 hours to reach Earth. Carrying the Golden Record toward Gliese 445 (encounter in ~40,000 years).",
    visualRadius: 0.05,
  },
  {
    name: "Voyager 2",
    designation: "Voyager 2 · NASA · 1977",
    kind: "spacecraft",
    aAU: 138,
    eccentricity: 1.00001,
    inclDeg: -78.8,         // dove south after Neptune flyby
    periodYears: Infinity,
    startPhase: 0.3,
    fact: "Only spacecraft to have flown by all four giant planets — Jupiter, Saturn, Uranus, Neptune. Crossed the heliopause November 2018, six years after Voyager 1, on the opposite side of the Sun.",
    visualRadius: 0.05,
  },
  {
    name: "New Horizons",
    designation: "New Horizons · NASA · 2006",
    kind: "spacecraft",
    aAU: 62,
    eccentricity: 1.00001,
    inclDeg: 2.3,
    periodYears: Infinity,
    startPhase: 0.55,
    fact: "Flew past Pluto in July 2015 — first close-up images of the dwarf planet ever taken. In 2019 it flew past Arrokoth, the most distant object ever visited (44 AU). Now drifting outward at 14 km/s toward the heliopause.",
    visualRadius: 0.045,
  },
  {
    name: "James Webb Space Telescope",
    designation: "JWST · NASA / ESA / CSA · 2021",
    kind: "spacecraft",
    aAU: 1.01,              // ~1 AU + 1.5M km (Sun-Earth L2)
    eccentricity: 0.0167,
    inclDeg: 0.0,
    periodYears: 1.0,
    startPhase: 0.65,
    fact: "Orbits the Sun-Earth L2 Lagrange point, 1.5 million km beyond Earth on the night side, kept cold by a tennis-court-sized sun shield. Looking deeper into the universe than any telescope before — first light January 2022.",
    // Visual radius kept tiny — JWST is washing-machine-sized in reality.
    // At its true L2 position (~0.01 AU past Earth) the inflated render
    // would otherwise visually clash with Earth on any close zoom.
    visualRadius: 0.022,
  },
  {
    name: "Parker Solar Probe",
    designation: "Parker Solar Probe · NASA · 2018",
    kind: "spacecraft",
    aAU: 0.39,              // semi-major axis
    eccentricity: 0.881,     // closest approach ~0.046 AU, just 9.86 solar radii
    inclDeg: 3.4,
    periodYears: 0.25,
    startPhase: 0.45,
    fact: "Closest object ever to the Sun — perihelion of 0.046 AU (6.9 million km / 9.86 solar radii) in December 2024, dipping inside the corona at 690,000 km/h. Carbon-composite heat shield protects the cold side from 1,400 °C.",
    visualRadius: 0.045,
  },
  {
    name: "Hayabusa2",
    designation: "Hayabusa2 · JAXA · 2014",
    kind: "spacecraft",
    aAU: 1.30,               // post-Ryugu extended-mission heliocentric orbit
    eccentricity: 0.18,
    inclDeg: 5.9,
    periodYears: 1.48,
    startPhase: 0.78,
    fact: "Returned asteroid Ryugu samples to Earth in December 2020 — second-ever asteroid sample return, after the original Hayabusa. Now on an 11-year extended cruise toward asteroid 1998 KY26 (rendezvous July 2031) with a 2026 Earth flyby and a 2027 flyby of asteroid 2001 CC21.",
    // Inner-system spacecraft (sub-2-AU) get a smaller visualRadius so
    // they read as probes, not planets, when they happen to cluster
    // near Earth at the current sim time. Real orbital positions are
    // preserved — only the render size shrinks.
    visualRadius: 0.018,
  },
  {
    name: "OSIRIS-APEX",
    designation: "OSIRIS-APEX · NASA · 2016",
    kind: "spacecraft",
    aAU: 1.14,               // post-Bennu trajectory toward Apophis
    eccentricity: 0.20,
    inclDeg: 6.0,
    periodYears: 1.22,
    startPhase: 0.85,
    fact: "Originally OSIRIS-REx — flew to asteroid Bennu and dropped the sample capsule on Utah in September 2023, then was redirected as OSIRIS-APEX to rendezvous with near-Earth asteroid 99942 Apophis on April 13, 2029, the day Apophis makes its closest flyby of Earth (~32,000 km).",
    visualRadius: 0.018,
  },
  {
    name: "Lucy",
    designation: "Lucy · NASA · 2021",
    kind: "spacecraft",
    aAU: 3.31,               // main-belt cruise toward Trojans
    eccentricity: 0.46,
    inclDeg: 2.7,
    periodYears: 6.0,
    startPhase: 0.20,
    fact: "First mission to the Jupiter Trojans — the two clouds of asteroids that share Jupiter's orbit, 60° ahead and behind it. Eleven-year tour visiting eight asteroids between 2025 and 2033, including Donaldjohanson (April 2025) and Eurybates with its tiny moon Queta.",
    visualRadius: 0.018,
  },
  {
    name: "BepiColombo",
    designation: "BepiColombo · ESA / JAXA · 2018",
    kind: "spacecraft",
    aAU: 0.65,               // cruising toward Mercury orbit insertion
    eccentricity: 0.24,
    inclDeg: 5.0,
    periodYears: 0.53,
    startPhase: 0.92,
    fact: "Joint ESA / JAXA Mercury mission — completing nine planetary flybys (Earth × 1, Venus × 2, Mercury × 6) before braking into Mercury orbit in November 2026. Two orbiters then separate: one mapping the surface, one studying the magnetosphere.",
    visualRadius: 0.018,
  },
]

/* --------------------------------------------------------------------------
 * Constellations
 *
 * Real RA/Dec coordinates (J2000) — projected onto a sky-shell around the
 * Sun. Each constellation carries its member stars + an `edges` graph that
 * names which star indices the asterism line connects. The scene draws each
 * edge as a line segment and highlights the whole constellation on hover.
 * ------------------------------------------------------------------------ */

export const constellations: Constellation[] = [
  {
    id: "ursa-major",
    name: "Big Dipper",
    designation: "Asterism in Ursa Major",
    fact: "Seven bright stars forming a saucepan. Dubhe and Merak — the outer two — point straight at Polaris ~28° away.",
    stars: [
      { name: "Dubhe",  designation: "α Ursae Majoris", raHours: 11.062, decDeg: 61.751, magnitude: 1.81 },
      { name: "Merak",  designation: "β Ursae Majoris", raHours: 11.030, decDeg: 56.382, magnitude: 2.37 },
      { name: "Phecda", designation: "γ Ursae Majoris", raHours: 11.897, decDeg: 53.694, magnitude: 2.44 },
      { name: "Megrez", designation: "δ Ursae Majoris", raHours: 12.257, decDeg: 57.032, magnitude: 3.31 },
      { name: "Alioth", designation: "ε Ursae Majoris", raHours: 12.900, decDeg: 55.960, magnitude: 1.76 },
      { name: "Mizar",  designation: "ζ Ursae Majoris", raHours: 13.398, decDeg: 54.925, magnitude: 2.23 },
      { name: "Alkaid", designation: "η Ursae Majoris", raHours: 13.792, decDeg: 49.313, magnitude: 1.85 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    id: "polaris",
    name: "Polaris",
    designation: "α Ursae Minoris · The North Star",
    fact: "The current pole star — Earth's rotation axis points within 0.74° of it. Click to reset the view.",
    stars: [
      { name: "Polaris", designation: "α Ursae Minoris (North Star)", raHours: 2.530, decDeg: 89.264, magnitude: 1.98 },
    ],
    edges: [],
    clickAction: "reset-view",
  },
  {
    id: "orion",
    name: "Orion",
    designation: "The Hunter — Northern winter sky",
    fact: "Three belt stars (Mintaka, Alnilam, Alnitak) align with the celestial equator. Betelgeuse (red supergiant) is the left shoulder; Rigel (blue supergiant) the right foot.",
    stars: [
      { name: "Betelgeuse", designation: "α Orionis · Red supergiant", raHours: 5.919, decDeg:  7.407, magnitude: 0.50 },
      { name: "Bellatrix",  designation: "γ Orionis · Blue giant",     raHours: 5.418, decDeg:  6.350, magnitude: 1.64 },
      { name: "Mintaka",    designation: "δ Orionis · Belt",           raHours: 5.533, decDeg: -0.299, magnitude: 2.23 },
      { name: "Alnilam",    designation: "ε Orionis · Belt",           raHours: 5.604, decDeg: -1.202, magnitude: 1.69 },
      { name: "Alnitak",    designation: "ζ Orionis · Belt",           raHours: 5.679, decDeg: -1.943, magnitude: 1.74 },
      { name: "Saiph",      designation: "κ Orionis",                  raHours: 5.796, decDeg: -9.670, magnitude: 2.06 },
      { name: "Rigel",      designation: "β Orionis · Blue supergiant", raHours: 5.242, decDeg: -8.202, magnitude: 0.13 },
    ],
    // Shoulders, belt, sides, feet
    edges: [
      [0, 1],   // shoulders
      [0, 4], [4, 5],     // left side → foot
      [1, 2], [2, 6],     // right side → foot
      [2, 3], [3, 4],     // belt
    ],
  },
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    designation: "The Queen — W-shaped asterism",
    fact: "Five bright stars forming a tilted W (or M, depending on rotation). Circumpolar from mid-northern latitudes — visible all year.",
    stars: [
      { name: "Caph",     designation: "β Cassiopeiae", raHours: 0.153, decDeg: 59.150, magnitude: 2.27 },
      { name: "Schedar",  designation: "α Cassiopeiae", raHours: 0.675, decDeg: 56.537, magnitude: 2.24 },
      { name: "Gamma Cas", designation: "γ Cassiopeiae", raHours: 0.945, decDeg: 60.717, magnitude: 2.47 },
      { name: "Ruchbah",  designation: "δ Cassiopeiae", raHours: 1.430, decDeg: 60.235, magnitude: 2.68 },
      { name: "Segin",    designation: "ε Cassiopeiae", raHours: 1.907, decDeg: 63.670, magnitude: 3.38 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: "leo",
    name: "Leo",
    designation: "The Lion — Spring zodiac",
    fact: "Regulus marks the heart, sitting almost exactly on the ecliptic — the Sun, Moon, and planets all pass close to it. The 'sickle' (head/mane) loops up from Regulus to Algieba.",
    stars: [
      { name: "Regulus",   designation: "α Leonis · Heart",  raHours: 10.139, decDeg: 11.967, magnitude: 1.40 },
      { name: "Algieba",   designation: "γ Leonis · Mane",   raHours: 10.333, decDeg: 19.842, magnitude: 2.21 },
      { name: "Denebola",  designation: "β Leonis · Tail",   raHours: 11.818, decDeg: 14.572, magnitude: 2.14 },
      { name: "Zosma",     designation: "δ Leonis · Hip",    raHours: 11.235, decDeg: 20.524, magnitude: 2.56 },
      { name: "Chertan",   designation: "θ Leonis",          raHours: 11.237, decDeg: 15.430, magnitude: 3.34 },
      { name: "Adhafera",  designation: "ζ Leonis · Mane",   raHours: 10.278, decDeg: 23.417, magnitude: 3.43 },
    ],
    edges: [[0, 4], [4, 2], [2, 3], [3, 1], [1, 5], [1, 0]],
  },
  {
    id: "lyra",
    name: "Lyra",
    designation: "The Lyre — Vega + the parallelogram",
    fact: "Vega is the 5th-brightest star in the night sky and one of the original three Summer Triangle anchors. Lyra contains the famous Ring Nebula (M57).",
    stars: [
      { name: "Vega",      designation: "α Lyrae · Summer Triangle anchor", raHours: 18.616, decDeg: 38.784, magnitude: 0.03 },
      { name: "Sheliak",   designation: "β Lyrae",                          raHours: 18.834, decDeg: 33.363, magnitude: 3.45 },
      { name: "Sulafat",   designation: "γ Lyrae",                          raHours: 18.985, decDeg: 32.690, magnitude: 3.25 },
      { name: "Delta Lyr", designation: "δ² Lyrae",                         raHours: 18.875, decDeg: 36.898, magnitude: 4.30 },
    ],
    // Vega → Delta → Sulafat → Sheliak → Vega — the parallelogram-with-Vega kite
    edges: [[0, 3], [3, 2], [2, 1], [1, 0]],
  },
  {
    id: "cygnus",
    name: "Cygnus",
    designation: "The Swan / Northern Cross",
    fact: "Deneb is the head of the cross and another Summer Triangle anchor. Albireo (the foot of the cross) is one of the most beautiful double stars — gold + sapphire — in a small telescope.",
    stars: [
      { name: "Deneb",    designation: "α Cygni · Summer Triangle anchor", raHours: 20.690, decDeg: 45.280, magnitude: 1.25 },
      { name: "Albireo",  designation: "β Cygni · Double star",            raHours: 19.512, decDeg: 27.960, magnitude: 3.08 },
      { name: "Sadr",     designation: "γ Cygni · Heart of the cross",     raHours: 20.371, decDeg: 40.257, magnitude: 2.20 },
      { name: "Gienah",   designation: "ε Cygni · East wing",              raHours: 20.770, decDeg: 33.970, magnitude: 2.48 },
      { name: "Fawaris",  designation: "δ Cygni · West wing",              raHours: 19.749, decDeg: 45.130, magnitude: 2.86 },
    ],
    // Spine: Deneb → Sadr → Albireo. Crossbar: Fawaris → Sadr → Gienah.
    edges: [[0, 2], [2, 1], [4, 2], [2, 3]],
  },
  {
    id: "scorpius",
    name: "Scorpius",
    designation: "The Scorpion — Summer zodiac",
    fact: "One of the few constellations that actually looks like its namesake. Antares (the red supergiant 'heart') will go supernova; when it does, it'll briefly outshine the full Moon. Lies right against the galactic centre, so the densest part of the Milky Way runs through its tail.",
    stars: [
      { name: "Antares",     designation: "α Scorpii · Heart · Red supergiant", raHours: 16.490, decDeg: -26.43, magnitude: 1.06 },
      { name: "Dschubba",    designation: "δ Scorpii · Head",                  raHours: 16.005, decDeg: -22.62, magnitude: 2.32 },
      { name: "Acrab",       designation: "β Scorpii · Head",                  raHours: 16.090, decDeg: -19.81, magnitude: 2.62 },
      { name: "Pi Scorpii",  designation: "π Scorpii · Head",                  raHours: 15.985, decDeg: -26.11, magnitude: 2.89 },
      { name: "Larawag",     designation: "ε Scorpii · Body",                  raHours: 16.836, decDeg: -34.29, magnitude: 2.31 },
      { name: "Sargas",      designation: "θ Scorpii · Tail",                  raHours: 17.622, decDeg: -42.998, magnitude: 1.86 },
      { name: "Shaula",      designation: "λ Scorpii · Tail tip · Sting",      raHours: 17.560, decDeg: -37.10, magnitude: 1.62 },
    ],
    // Head triangle (Dschubba-Acrab-Pi) → Antares → body → tail to sting
    edges: [[2, 1], [1, 3], [3, 0], [0, 4], [4, 5], [5, 6]],
  },
  {
    id: "crux",
    name: "Southern Cross",
    designation: "Crux · Smallest of the 88 constellations",
    fact: "The most iconic southern asterism, on the flags of Australia, New Zealand, Brazil, Papua New Guinea, and Samoa. Acrux is the 13th-brightest star in the sky; the cross's long axis points toward the south celestial pole — the southern equivalent of how the Big Dipper points to Polaris.",
    stars: [
      { name: "Acrux",   designation: "α Crucis · Foot of the cross", raHours: 12.443, decDeg: -63.10, magnitude: 0.77 },
      { name: "Gacrux",  designation: "γ Crucis · Top of the cross",  raHours: 12.519, decDeg: -57.11, magnitude: 1.59 },
      { name: "Mimosa",  designation: "β Crucis · Left arm",          raHours: 12.795, decDeg: -59.69, magnitude: 1.25 },
      { name: "Imai",    designation: "δ Crucis · Right arm",         raHours: 12.252, decDeg: -58.75, magnitude: 2.79 },
    ],
    // Vertical: Acrux ↔ Gacrux. Horizontal: Mimosa ↔ Imai.
    edges: [[0, 1], [2, 3]],
  },
  {
    id: "centaurus",
    name: "Centaurus",
    designation: "The Centaur · Southern sky",
    fact: "Hosts the closest star system to the Sun: α Centauri (Rigil Kentaurus), a triple system 4.37 ly away. The faintest member, Proxima Centauri, has at least one Earth-mass planet in its habitable zone. Also home to Omega Centauri — the largest globular cluster in the Milky Way, possibly the core of a digested dwarf galaxy.",
    stars: [
      { name: "Rigil Kentaurus", designation: "α Centauri · Closest star system", raHours: 14.660, decDeg: -60.83, magnitude: -0.27 },
      { name: "Hadar",           designation: "β Centauri",                       raHours: 14.064, decDeg: -60.37, magnitude: 0.61 },
      { name: "Muhlifain",       designation: "γ Centauri",                       raHours: 12.692, decDeg: -48.96, magnitude: 2.17 },
      { name: "Menkent",         designation: "θ Centauri",                       raHours: 14.111, decDeg: -36.37, magnitude: 2.06 },
    ],
    edges: [[0, 1], [1, 2], [2, 3]],
  },
  {
    id: "sagittarius",
    name: "Sagittarius",
    designation: "The Archer · 'Teapot' asterism",
    fact: "Marks the direction of the galactic centre — when you look at Sagittarius, you're looking through the densest part of the Milky Way toward Sgr A*, the 4-million-solar-mass black hole at the galactic core. The eight brightest stars form the famous Teapot, with the Milky Way as steam pouring from its spout.",
    stars: [
      { name: "Kaus Australis", designation: "ε Sagittarii",  raHours: 18.403, decDeg: -34.38, magnitude: 1.85 },
      { name: "Nunki",          designation: "σ Sagittarii",  raHours: 18.921, decDeg: -26.30, magnitude: 2.05 },
      { name: "Ascella",        designation: "ζ Sagittarii",  raHours: 19.045, decDeg: -29.88, magnitude: 2.59 },
      { name: "Kaus Media",     designation: "δ Sagittarii",  raHours: 18.349, decDeg: -29.83, magnitude: 2.70 },
      { name: "Kaus Borealis",  designation: "λ Sagittarii",  raHours: 18.466, decDeg: -25.42, magnitude: 2.81 },
      { name: "Phi Sgr",        designation: "φ Sagittarii",  raHours: 18.755, decDeg: -26.99, magnitude: 3.17 },
      { name: "Tau Sgr",        designation: "τ Sagittarii",  raHours: 19.115, decDeg: -27.67, magnitude: 3.32 },
    ],
    // Teapot: body (Kaus Media-Phi-Tau-Ascella) + handle (Phi-Nunki-Ascella) + spout (Kaus Australis-Kaus Media) + lid (Kaus Media-Kaus Borealis-Phi)
    edges: [[3, 5], [5, 6], [6, 2], [2, 1], [1, 5], [3, 0], [3, 4], [4, 5]],
  },
  {
    id: "pegasus",
    name: "Pegasus",
    designation: "The Winged Horse · Great Square",
    fact: "The Great Square of Pegasus is one of the easiest asterisms to find in the autumn northern sky. The fourth corner is technically Alpheratz — which the IAU assigned to neighbouring Andromeda. From Markab and Algenib, follow the line out to reach the Andromeda Galaxy.",
    stars: [
      { name: "Markab",   designation: "α Pegasi · SW corner",   raHours: 23.079, decDeg: 15.21, magnitude: 2.49 },
      { name: "Scheat",   designation: "β Pegasi · NW corner",   raHours: 23.063, decDeg: 28.08, magnitude: 2.42 },
      { name: "Algenib",  designation: "γ Pegasi · SE corner",   raHours: 0.220,  decDeg: 15.18, magnitude: 2.83 },
      { name: "Alpheratz", designation: "α Andromedae · NE corner (shared)", raHours: 0.140,  decDeg: 29.09, magnitude: 2.06 },
      { name: "Enif",     designation: "ε Pegasi · Nose",        raHours: 21.737, decDeg: 9.88,  magnitude: 2.39 },
    ],
    // Great Square: Markab-Scheat-Alpheratz-Algenib. Plus Enif extension out to the head.
    edges: [[0, 1], [1, 3], [3, 2], [2, 0], [0, 4]],
  },
]

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

/** Box-Muller — approximate standard-normal sample. Used for galaxy bulge density. */
export function gauss(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Convert RA (hours) + Dec (deg) → Cartesian, offset to sit around the Sun. */
export function raDecToScenePos(
  raHours: number,
  decDeg: number,
  distance: number,
): [number, number, number] {
  const raRad = (raHours / 24) * 2 * Math.PI
  const decRad = decDeg * (Math.PI / 180)
  const x = distance * Math.cos(decRad) * Math.cos(raRad)
  const y = distance * Math.sin(decRad)
  const z = distance * Math.cos(decRad) * Math.sin(raRad)
  return [SUN_OFFSET_SCENE + x, y, z]
}

/** Apparent magnitude → visual sphere radius (brighter = larger). */
export function magToVisualRadius(mag: number): number {
  return Math.max(0.05, 0.22 - mag * 0.04)
}

/* --------------------------------------------------------------------------
 * Sky points — galaxies, nebulae, star clusters, exoplanet host stars
 *
 * Far-field targets projected onto the same sky-shell that constellations
 * use, at real J2000 RA/Dec. Each kind renders differently (galaxies and
 * nebulae as diffuse halos, clusters as small point clouds, exoplanet
 * hosts as accent-coloured dots) but they all share the catalog so the
 * Data Engine has one place to grow.
 * ------------------------------------------------------------------------ */

export const skyPoints: SkyPoint[] = [
  // ----- Galaxies (Local Group + neighbours) -----
  {
    id: "m31",
    name: "Andromeda Galaxy",
    designation: "M31 · NGC 224",
    kind: "galaxy",
    raHours: 0.712,
    decDeg: 41.27,
    magnitude: 3.4,
    distance: "2.5 million ly",
    fact: "Closest major galaxy to the Milky Way. Visible to the naked eye from dark sites — the farthest object most humans will ever see without aid. On a collision course with the Milky Way; they'll merge in ~4.5 billion years.",
    visualSize: 5,
  },
  {
    id: "m33",
    name: "Triangulum Galaxy",
    designation: "M33 · NGC 598",
    kind: "galaxy",
    raHours: 1.566,
    decDeg: 30.66,
    magnitude: 5.7,
    distance: "2.7 million ly",
    fact: "Third-largest member of the Local Group. Naked-eye visible from very dark sites — one of the most distant objects visible without optical aid.",
    visualSize: 3.5,
  },
  {
    id: "lmc",
    name: "Large Magellanic Cloud",
    designation: "LMC · ESO 56-115",
    kind: "galaxy",
    raHours: 5.393,
    decDeg: -69.76,
    magnitude: 0.9,
    distance: "163,000 ly",
    fact: "Satellite galaxy of the Milky Way, visible only from the southern hemisphere. Host of SN 1987A — the closest supernova observed since 1604, and the first to have its progenitor star identified.",
    visualSize: 4.5,
  },
  {
    id: "smc",
    name: "Small Magellanic Cloud",
    designation: "SMC · NGC 292",
    kind: "galaxy",
    raHours: 0.878,
    decDeg: -72.83,
    magnitude: 2.7,
    distance: "200,000 ly",
    fact: "Dwarf irregular galaxy orbiting the Milky Way alongside the LMC. Edwin Hubble used Cepheid variables here to measure distances to other galaxies for the first time.",
    visualSize: 3.5,
  },
  // ----- Nebulae -----
  {
    id: "m42",
    name: "Orion Nebula",
    designation: "M42 · NGC 1976",
    kind: "nebula",
    raHours: 5.588,
    decDeg: -5.39,
    magnitude: 4.0,
    distance: "1,344 ly",
    fact: "Stellar nursery in Orion's sword, visible to the naked eye as the middle 'star' in the sword. Contains the Trapezium — four hot young stars actively ionising the surrounding gas. Closest region of massive star formation to Earth.",
    visualSize: 3,
  },
  {
    id: "m57",
    name: "Ring Nebula",
    designation: "M57 · NGC 6720",
    kind: "nebula",
    raHours: 18.893,
    decDeg: 33.03,
    magnitude: 8.8,
    distance: "2,300 ly",
    fact: "Famous planetary nebula in Lyra. A dying sun-like star puffed off its outer atmosphere ~6,000 years ago, leaving a glowing ring with a white dwarf core. A preview of our Sun's eventual fate.",
    visualSize: 2,
  },
  {
    id: "m1",
    name: "Crab Nebula",
    designation: "M1 · NGC 1952",
    kind: "nebula",
    raHours: 5.575,
    decDeg: 22.01,
    magnitude: 8.4,
    distance: "6,500 ly",
    fact: "Remnant of a supernova that exploded on 4 July 1054 — observed and recorded by Chinese, Arab, and Japanese astronomers as a 'guest star' bright enough to see by day for three weeks. Centre hosts the Crab Pulsar, spinning 30 times a second.",
    visualSize: 2.5,
  },
  // ----- Open + globular clusters -----
  {
    id: "m45",
    name: "Pleiades",
    designation: "M45 · The Seven Sisters",
    kind: "cluster",
    raHours: 3.792,
    decDeg: 24.12,
    magnitude: 1.6,
    distance: "444 ly",
    fact: "Most famous open star cluster in the sky. Six or seven stars are visible to the naked eye; binoculars reveal hundreds. The cluster's blue haze comes from a dust cloud the stars are currently passing through.",
    visualSize: 3.5,
  },
  {
    id: "m13",
    name: "Hercules Cluster",
    designation: "M13 · NGC 6205",
    kind: "cluster",
    raHours: 16.695,
    decDeg: 36.46,
    magnitude: 5.8,
    distance: "22,200 ly",
    fact: "Brightest globular cluster in the northern sky — half a million stars packed into a sphere ~145 ly across. The Arecibo Message (1974) was beamed in its direction as humanity's first intentional interstellar broadcast.",
    visualSize: 2,
  },
  // ----- Exoplanet host stars -----
  {
    id: "proxima-centauri",
    name: "Proxima Centauri",
    designation: "α Centauri C",
    kind: "exoplanet-host",
    raHours: 14.495,
    decDeg: -62.68,
    magnitude: 11.1,
    distance: "4.24 ly",
    fact: "Closest known star to the Sun. Hosts Proxima Centauri b — an Earth-mass planet in the habitable zone, discovered 2016. The closest potentially-habitable world we know of, and the likely first target for any future interstellar probe.",
    visualSize: 0.6,
  },
  {
    id: "51-peg",
    name: "51 Pegasi",
    designation: "51 Peg · HD 217014",
    kind: "exoplanet-host",
    raHours: 22.957,
    decDeg: 20.77,
    magnitude: 5.49,
    distance: "50.5 ly",
    fact: "Host of 51 Pegasi b (1995) — the first exoplanet ever discovered around a Sun-like star. Triggered the Nobel Prize in Physics 2019 and the entire exoplanet revolution. The planet orbits in just 4.2 days.",
    visualSize: 0.5,
  },
  {
    id: "trappist-1",
    name: "TRAPPIST-1",
    designation: "2MASS J23062928–0502285",
    kind: "exoplanet-host",
    raHours: 23.108,
    decDeg: -5.04,
    magnitude: 18.8,
    distance: "40.7 ly",
    fact: "Ultra-cool dwarf star hosting seven Earth-sized rocky planets, three or four in the habitable zone. Most planet-rich nearby system known. JWST observations are searching for atmospheres on TRAPPIST-1 b, c, d, e.",
    visualSize: 0.5,
  },
  {
    id: "kepler-186",
    name: "Kepler-186",
    designation: "Kepler-186 · KOI-571",
    kind: "exoplanet-host",
    raHours: 19.907,
    decDeg: 43.95,
    magnitude: 14.6,
    distance: "557 ly",
    fact: "Host of Kepler-186f (2014) — the first Earth-sized planet discovered in the habitable zone of another star. Orbits a cool red dwarf in 130 days.",
    visualSize: 0.45,
  },
  {
    id: "tau-ceti",
    name: "Tau Ceti",
    designation: "τ Ceti · HD 10700",
    kind: "exoplanet-host",
    raHours: 1.735,
    decDeg: -15.94,
    magnitude: 3.5,
    distance: "11.9 ly",
    fact: "Closest single sun-like star — same spectral type (G-class) as our Sun. At least four candidate planets detected. Long a favourite target in SETI searches; it's where 'Contact' set its alien signal.",
    visualSize: 0.6,
  },
  // ----- Black holes -----
  {
    id: "m87-star",
    name: "M87*",
    designation: "M87* · Pōwehi · 6.5 billion M☉",
    kind: "black-hole",
    raHours: 12.514,
    decDeg: 12.39,
    distance: "53.5 million ly",
    fact: "First black hole ever imaged — the Event Horizon Telescope unveiled it in April 2019, showing the iconic glowing donut around a dark shadow. Sits at the heart of galaxy Messier 87.",
    visualSize: 1.8,
    massSolar: 6.5e9,
    spin: 0.9,
    // M87 is the textbook jet AGN — Hubble's 5,000-light-year jet is one
    // of the most-photographed structures in extragalactic astronomy.
    // Strong asymmetry: real radio imaging shows the approaching jet
    // ~10× brighter than the receding side.
    jet: { axis: "y", lengthFactor: 14, brightness: 0.7, asymmetry: 0.75, color: "#bcd9ff" },
  },
  {
    id: "ton-618",
    name: "TON 618",
    designation: "TON 618 · 66 billion M☉ · Ultramassive",
    kind: "black-hole",
    raHours: 12.494,
    decDeg: 31.74,
    distance: "10.4 billion ly",
    fact: "Among the most massive black holes known. The event horizon alone is ~1,300 AU across, far wider than the Sun's heliosphere. Powers a hyperluminous quasar visible from a third of the way across the observable universe.",
    visualSize: 2.2,
    massSolar: 6.6e10,
    spin: 0.9,
    // TON 618 powers a hyperluminous quasar — radio-loud, observed jets,
    // even more massive than M87. Slightly longer + brighter than M87's
    // for visual differentiation between the two supermassive bodies.
    jet: { axis: "y", lengthFactor: 16, brightness: 0.65, asymmetry: 0.55, color: "#d8e6ff" },
  },
  {
    id: "cygnus-x1",
    name: "Cygnus X-1",
    designation: "Cygnus X-1 · 21 M☉ · Stellar-mass",
    kind: "black-hole",
    raHours: 19.973,
    decDeg: 35.20,
    magnitude: 8.95,        // its blue-supergiant companion's mag
    distance: "7,200 ly",
    fact: "First object widely accepted as a black hole (1971) — an X-ray binary in which a 21-solar-mass black hole accretes from a blue supergiant companion. Subject of the 1974 Hawking-Thorne wager — Hawking conceded in 1990.",
    visualSize: 1.2,
    massSolar: 21,
    spin: 0.95,
    // Cygnus X-1 is a microquasar — compact relativistic jets ejected
    // from the accreting stellar-mass BH. Shorter and dimmer than the
    // supermassive AGN jets above, in keeping with its scale.
    jet: { axis: "y", lengthFactor: 9, brightness: 0.5, asymmetry: 0.4, color: "#a8c5ff" },
  },
  {
    id: "v404-cygni",
    name: "V404 Cygni",
    designation: "V404 Cygni · 9 M☉ · X-ray nova",
    kind: "black-hole",
    raHours: 20.408,
    decDeg: 33.87,
    distance: "8,000 ly",
    fact: "A stellar-mass black hole in a binary system, also in Cygnus. Erupted into a bright X-ray nova in 1989 and again in 2015 — the 2015 outburst was bright enough to study the accretion physics in real time. 9 solar-mass BH accreting from a K-class companion.",
    visualSize: 1.0,
    massSolar: 9,
    spin: 0.92,
    jet: { axis: "y", lengthFactor: 7, brightness: 0.45, asymmetry: 0.35, color: "#a8c5ff" },
  },
  {
    id: "ngc1277-bh",
    name: "NGC 1277 BH",
    designation: "NGC 1277 · 17 billion M☉ · Overmassive",
    kind: "black-hole",
    raHours: 3.319,
    decDeg: 41.57,
    distance: "220 million ly",
    fact: "An overmassive black hole — 14% of its host galaxy's mass when most galaxies host BHs at 0.1%. The galaxy NGC 1277 is a relic galaxy that stopped forming stars 12 billion years ago. Suggests BH growth may decouple from galaxy growth.",
    visualSize: 1.6,
    massSolar: 1.7e10,
    spin: 0.85,
    jet: { axis: "y", lengthFactor: 13, brightness: 0.6, asymmetry: 0.55, color: "#c8defe" },
  },
  {
    id: "gw150914",
    name: "GW150914",
    designation: "GW150914 · 62 M☉ · LIGO merger remnant",
    kind: "black-hole",
    raHours: 6.7,
    decDeg: -70.0,
    distance: "1.3 billion ly",
    fact: "The remnant of the first directly detected gravitational-wave event (LIGO, September 14, 2015) — a merger of two black holes (~36 + ~29 M☉) into a single ~62 M☉ BH. The chirp was heard before any electromagnetic signal; localisation is approximate (a wide southern-sky banana).",
    visualSize: 1.0,
    massSolar: 62,
    spin: 0.67,
    jet: { axis: "y", lengthFactor: 8, brightness: 0.4, asymmetry: 0.3, color: "#b8d0ff" },
  },
]
