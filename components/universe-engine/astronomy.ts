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
  { name: "Mercury", aAU: 0.387, radiusEarth: 0.383, periodDays: 87.97,   tiltDeg: 0.03,   rotHours: 1407.6, inclDeg: 7.005, startPhase: 0.0, shade: "#7a7a7a", surfaceTempK: { min: 100, mean: 440, max: 700 }, classification: "Terrestrial planet", moons: 0, fact: "No atmosphere. Day side 700 K, night side 100 K — biggest swing in the solar system. A year on Mercury is just 88 Earth days; a single day is 176 Earth days. Two years pass for every day.", textureUrl: "/textures/mercury.webp", useDayNight: true, terminatorSoftness: 0.04, deep: { massEarth: 0.0553, densityGcc: 5.43, gravity: 3.70, escapeVelocityKms: 4.30, eccentricity: 0.206 } },
  { name: "Venus",   aAU: 0.723, radiusEarth: 0.949, periodDays: 224.70,  tiltDeg: 177.4,  rotHours: -5832.5, inclDeg: 3.395, startPhase: 2.1, shade: "#bdbdbd", surfaceTempK: { mean: 737 }, classification: "Terrestrial planet (retrograde)", moons: 0, fact: "Hottest surface — 737 K — runaway CO₂ greenhouse. Rotates backwards on a 243-day day. The 177° axial tilt means Venus is technically upside-down relative to the rest of the planets.", textureUrl: "/textures/venus.webp", deep: { massEarth: 0.815, densityGcc: 5.24, gravity: 8.87, escapeVelocityKms: 10.36, eccentricity: 0.007 } },
  { name: "Earth",   aAU: 1.000, radiusEarth: 1.000, periodDays: 365.25,  tiltDeg: 23.44,  rotHours: 23.93,  inclDeg: 0.000, startPhase: 4.5, shade: "#dcdcdc", surfaceTempK: { min: 184, mean: 288, max: 330 }, classification: "Terrestrial planet — life", moons: 1, fact: "Mean surface 288 K. Only known planet with liquid water and life.", textureUrl: "/textures/earth.webp", nightTextureUrl: "/textures/earth-night.webp", deep: { massEarth: 1.000, densityGcc: 5.51, gravity: 9.81, escapeVelocityKms: 11.19, eccentricity: 0.017 } },
  { name: "Mars",    aAU: 1.524, radiusEarth: 0.532, periodDays: 686.97,  tiltDeg: 25.19,  rotHours: 24.62,  inclDeg: 1.850, startPhase: 1.3, shade: "#c1623a", surfaceTempK: { min: 130, mean: 210, max: 308 }, classification: "Terrestrial planet", moons: 2, fact: "Thin CO₂ atmosphere, polar ice caps, evidence of ancient liquid water. Hosts the solar system's tallest mountain (Olympus Mons, 22 km) and longest canyon (Valles Marineris, 4,000 km). The 25° axial tilt gives Mars Earth-like seasons.", textureUrl: "/textures/mars.webp", useDayNight: true, terminatorSoftness: 0.10, deep: { massEarth: 0.107, densityGcc: 3.93, gravity: 3.71, escapeVelocityKms: 5.03, eccentricity: 0.094 }, surfaceFeatures: [
    { name: "Perseverance", lat: 18.44, lon: 77.45, date: "2021-02-18", status: "active", agency: "NASA", fact: "Mars 2020 mission — exploring Jezero Crater, an ancient river delta. Caching samples for future return to Earth. Carries the Ingenuity helicopter, first powered flight on another world." },
    { name: "Curiosity", lat: -4.59, lon: 137.44, date: "2012-08-06", status: "active", agency: "NASA", fact: "Mars Science Laboratory rover. Climbing Mount Sharp inside Gale Crater since 2014, drilling layered sedimentary rocks that recorded Mars's transition from wet to dry." },
    { name: "InSight", lat: 4.50, lon: 135.62, date: "2018-11-26", status: "completed", agency: "NASA", fact: "Stationary lander on Elysium Planitia. Recorded 1,300+ marsquakes with the SEIS seismometer before dust on its solar panels ended the mission in December 2022. Mapped the interior structure of a planet other than Earth for the first time." },
    { name: "Opportunity", lat: -1.95, lon: 354.47, date: "2004-01-25", status: "lost", agency: "NASA", fact: "MER-B. Designed for 90 days, lasted 14 years. Drove 45 km across Meridiani Planum before a planet-wide dust storm in 2018 ended communications. Final transmission: \"My battery is low and it's getting dark.\"" },
    { name: "Spirit", lat: -14.57, lon: 175.47, date: "2004-01-04", status: "lost", agency: "NASA", fact: "MER-A. Twin of Opportunity, landed three weeks earlier in Gusev Crater. Drove 7.7 km before getting stuck in soft sand in 2009; last contact March 2010. Found evidence of past hydrothermal activity." },
    { name: "Zhurong", lat: 25.06, lon: 109.93, date: "2021-05-14", status: "lost", agency: "CNSA", fact: "China's first Mars rover, named for a mythological fire god. Explored southern Utopia Planitia for 358 sols (~12× planned). Entered hibernation May 2022; never reawakened." },
    // Natural surface features — the iconic geography Mars is known for.
    // Shown as outline rings instead of dots so they read as "regions" not
    // "single points". Each spans hundreds of km on the real surface.
    { name: "Olympus Mons", lat: 18.65, lon: 226.20, date: "natural", status: "natural", agency: "—", fact: "Tallest volcano in the solar system — ~22 km high (~2.5× Mount Everest) and 600 km wide at the base, the size of France. Shield volcano formed by lava flows over billions of years on a non-moving crust (Mars has no plate tectonics, so the magma plume just kept building up the same mountain)." },
    { name: "Valles Marineris", lat: -13.9, lon: 301.50, date: "natural", status: "natural", agency: "—", fact: "Largest canyon system in the solar system. 4,000 km long (roughly Los Angeles to New York), up to 200 km wide, and 7 km deep — dwarfing the Grand Canyon. Not carved by water but cracked open by tectonic stress as the Tharsis bulge formed nearby." },
    { name: "Hellas Planitia", lat: -42.4, lon: 70.0, date: "natural", status: "natural", agency: "—", fact: "The largest visible impact crater in the solar system. 2,300 km wide and 7 km deep — so low that atmospheric pressure at its floor is ~89% higher than the planetary average, the only place on Mars where liquid water could briefly exist on the surface today." },
  ] },
  { name: "Jupiter", aAU: 5.203, radiusEarth: 11.21, periodDays: 4332.59, tiltDeg: 3.13,   rotHours: 9.92,   inclDeg: 1.303, startPhase: 5.8, shade: "#cfcfcf", surfaceTempK: { mean: 165 }, classification: "Gas giant", moons: 95, fact: "Largest planet. 10-hour day. Great Red Spot is a storm wider than Earth.", textureUrl: "/textures/jupiter.webp", deep: { massEarth: 317.8, densityGcc: 1.33, gravity: 24.79, escapeVelocityKms: 59.5, eccentricity: 0.049 } },
  { name: "Saturn",  aAU: 9.537, radiusEarth: 9.449, periodDays: 10759.22,tiltDeg: 26.73,  rotHours: 10.66,  inclDeg: 2.485, startPhase: 3.2, shade: "#bababa", surfaceTempK: { mean: 134 }, classification: "Gas giant", moons: 146, fact: "Ring system spans 282,000 km but is only ~10 m thick.", hasRings: true, textureUrl: "/textures/saturn.webp", deep: { massEarth: 95.16, densityGcc: 0.69, gravity: 10.44, escapeVelocityKms: 35.5, eccentricity: 0.057 } },
  { name: "Uranus",  aAU: 19.19, radiusEarth: 4.007, periodDays: 30688.50,tiltDeg: 97.77,  rotHours: -17.24, inclDeg: 0.773, startPhase: 0.7, shade: "#a5dad0", surfaceTempK: { mean: 76 }, classification: "Ice giant (sideways)", moons: 28, fact: "Rotates on its side at 98° tilt — likely from an ancient collision. Each pole experiences 42 years of sunlight followed by 42 years of darkness. Surface methane gives it that pale blue-green colour.", textureUrl: "/textures/uranus.webp", deep: { massEarth: 14.54, densityGcc: 1.27, gravity: 8.87, escapeVelocityKms: 21.3, eccentricity: 0.046, discoveredYear: 1781, discoveredBy: "William Herschel" } },
  { name: "Neptune", aAU: 30.07, radiusEarth: 3.883, periodDays: 60182.00,tiltDeg: 28.32,  rotHours: 16.11,  inclDeg: 1.770, startPhase: 2.9, shade: "#4a6db8", surfaceTempK: { mean: 72 }, classification: "Ice giant", moons: 16, fact: "Coldest planet. Fastest winds in the solar system — 2,100 km/h supersonic gales. 165-year orbit means it has completed only one orbit since its discovery in 1846.", textureUrl: "/textures/neptune.webp", deep: { massEarth: 17.15, densityGcc: 1.64, gravity: 11.15, escapeVelocityKms: 23.5, eccentricity: 0.011, discoveredYear: 1846, discoveredBy: "Le Verrier / Galle" } },
  // Pluto — reclassified to dwarf planet in 2006 but still part of the family.
  // 17.16° inclination really does tilt its ring above the ecliptic — Pluto
  // crosses inside Neptune's orbit for ~20 years every 248-year orbit.
  { name: "Pluto",   aAU: 39.48, radiusEarth: 0.186, periodDays: 90560.00,tiltDeg: 122.5,  rotHours: -153.3, inclDeg: 17.16, startPhase: 4.1, shade: "#c8a378", visualRadiusOverride: 0.26, surfaceTempK: { min: 33, mean: 44, max: 55 }, classification: "Dwarf planet · Kuiper Belt", moons: 5, fact: "Reclassified from planet to dwarf planet in 2006. 17° orbital inclination lifts it above the ecliptic. Charon is so massive (12% of Pluto's mass) they orbit a barycentre outside Pluto's surface — effectively a binary system. The famous heart-shaped Tombaugh Regio was photographed by New Horizons in 2015.", deep: { massEarth: 0.00220, densityGcc: 1.86, gravity: 0.62, escapeVelocityKms: 1.21, eccentricity: 0.244, discoveredYear: 1930, discoveredBy: "Clyde Tombaugh" } },
]

export function buildScenePlanets(): ScenePlanet[] {
  return planetsData.map((p) => {
    const orbitRadius = Math.sqrt(p.aAU) * 3
    // Visual size is sqrt-scaled from real Earth-radii so the giants don't
    // visually dwarf the inner planets, then floored at 0.13 scene units so
    // tiny bodies like Pluto stay findable on their orbit ring instead of
    // shrinking to a pinprick. An explicit `visualRadiusOverride` wins —
    // useful for dwarf planets where even the floor lands too small to
    // spot from the inner-system view.
    const computedRadius = Math.max(0.13, Math.sqrt(p.radiusEarth) * 0.2)
    const visualRadius = p.visualRadiusOverride ?? computedRadius
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
  { name: "Moon (Luna)",     parent: "Earth",   visualRadius: 0.05,  orbitRadius: 0.42, periodDays: 27.32,  shade: "#bdbdbd", fact: "Earth's only natural satellite. Surface temp −173 to +127 °C. Tidally locked — same face always toward Earth.", textureUrl: "/textures/moon.webp", surfaceFeatures: [
    // Apollo crewed landings (1969–1972) — the only human boot-prints
    // off Earth. All six landed on the near side (so Earth was visible
    // from the surface) within ±5° of the lunar equator.
    { name: "Apollo 11", lat: 0.67, lon: 23.47, date: "1969-07-20", status: "completed", agency: "NASA", fact: "First crewed Moon landing. Neil Armstrong + Buzz Aldrin, Sea of Tranquility. 21.5 hours on the surface; brought back 21.5 kg of lunar material. \"That's one small step for [a] man, one giant leap for mankind.\"" },
    { name: "Apollo 12", lat: -3.01, lon: 336.58, date: "1969-11-19", status: "completed", agency: "NASA", fact: "Second crewed landing. Pete Conrad + Alan Bean, Ocean of Storms. Landed within 200 m of the Surveyor 3 probe (sent 1967), and returned pieces of it to Earth." },
    { name: "Apollo 14", lat: -3.65, lon: 342.53, date: "1971-02-05", status: "completed", agency: "NASA", fact: "Alan Shepard + Edgar Mitchell, Fra Mauro highlands. Shepard hit two golf balls on the surface; one travelled an estimated ~37 m." },
    { name: "Apollo 15", lat: 26.13, lon: 3.63, date: "1971-07-30", status: "completed", agency: "NASA", fact: "David Scott + James Irwin, Hadley Rille. First mission to use the Lunar Roving Vehicle — drove 27.9 km across the Apennine mountains." },
    { name: "Apollo 16", lat: -8.97, lon: 15.50, date: "1972-04-21", status: "completed", agency: "NASA", fact: "John Young + Charlie Duke, Descartes highlands. Only mission to explore the lunar highlands; collected 95 kg of samples." },
    { name: "Apollo 17", lat: 20.19, lon: 30.77, date: "1972-12-11", status: "completed", agency: "NASA", fact: "Eugene Cernan + Harrison Schmitt, Taurus-Littrow. Last crewed Moon landing — no human has been further than low Earth orbit since. Schmitt was the only geologist to walk on the Moon." },
    // Notable robotic landings
    { name: "Luna 9", lat: 7.13, lon: -64.37, date: "1966-02-03", status: "completed", agency: "USSR", fact: "First spacecraft to make a survivable soft landing on any extraterrestrial body, in Oceanus Procellarum. Beamed back the first photographs ever taken from the surface of the Moon." },
    { name: "Chang'e 4", lat: -45.5, lon: 177.6, date: "2019-01-03", status: "active", agency: "CNSA", fact: "First soft landing on the lunar far side, in Von Kármán crater. The Yutu-2 rover continues exploring — relays signals to Earth via the Queqiao satellite at L2 since the Moon itself blocks direct line of sight." },
  ] },
  // Mars's two tiny moons — both probably captured asteroids
  { name: "Phobos",          parent: "Mars",    visualRadius: 0.025, orbitRadius: 0.38, periodDays: 0.319,  shade: "#9a8b78", fact: "Closer to its planet than any other moon in the solar system — orbits Mars in just 7.6 hours. Spirals inward by ~1.8 m per century; will eventually crash or shatter into a ring." },
  { name: "Deimos",          parent: "Mars",    visualRadius: 0.020, orbitRadius: 0.55, periodDays: 1.263,  shade: "#a89a85", fact: "Smaller of Mars's two moons — only 12 km across. From the Martian surface, Deimos would look like a slightly brighter star, not a disc." },
  { name: "Io",              parent: "Jupiter", visualRadius: 0.05,  orbitRadius: 0.95, periodDays: 1.77,   shade: "#cfcfcf", fact: "Most volcanically active body in the solar system — 400+ active volcanoes from tidal heating from Jupiter." },
  { name: "Europa",          parent: "Jupiter", visualRadius: 0.045, orbitRadius: 1.15, periodDays: 3.55,   shade: "#dcdcdc", fact: "Icy crust over a subsurface ocean. One of the best candidates for life beyond Earth." },
  { name: "Ganymede",        parent: "Jupiter", visualRadius: 0.07,  orbitRadius: 1.40, periodDays: 7.15,   shade: "#bababa", fact: "Largest moon in the solar system — bigger than Mercury. Has its own magnetic field." },
  { name: "Callisto",        parent: "Jupiter", visualRadius: 0.065, orbitRadius: 1.75, periodDays: 16.69,  shade: "#9a9a9a", fact: "Most heavily cratered body known. Outermost Galilean moon — sees least of Jupiter's radiation." },
  // Saturn's notable moons — Titan + Enceladus + Mimas + Iapetus + Tethys + Dione + Rhea
  { name: "Mimas",           parent: "Saturn",  visualRadius: 0.030, orbitRadius: 1.45, periodDays: 0.942,  shade: "#cccccc", fact: "The 'Death Star moon' — a 130-km crater (Herschel) covers a third of its face, making it eerily resemble the Empire's battle station decades before Star Wars existed." },
  { name: "Enceladus",       parent: "Saturn",  visualRadius: 0.040, orbitRadius: 1.65, periodDays: 1.370,  shade: "#f5f5f5", fact: "Geysers of liquid water erupt through cracks at its south pole, feeding Saturn's E-ring. Cassini flew through the plumes and detected organic molecules — one of the strongest candidates for life beyond Earth." },
  { name: "Tethys",          parent: "Saturn",  visualRadius: 0.035, orbitRadius: 1.55, periodDays: 1.888,  shade: "#d8d4cc", fact: "Mostly water ice, with a density barely above water. Dominated by a 400-km crater (Odysseus) and the 2,000-km Ithaca Chasma canyon system that runs three-quarters around it — likely from the moon freezing solid after a once-liquid interior." },
  { name: "Dione",           parent: "Saturn",  visualRadius: 0.036, orbitRadius: 1.75, periodDays: 2.737,  shade: "#c8c4b8", fact: "Bright wispy streaks across its trailing hemisphere are tectonic ice cliffs, not surface deposits — Cassini revealed them as fault scarps hundreds of metres tall. May have a subsurface liquid ocean." },
  { name: "Rhea",            parent: "Saturn",  visualRadius: 0.045, orbitRadius: 1.95, periodDays: 4.518,  shade: "#d2cdc0", fact: "Saturn's second-largest moon. Heavily cratered ice ball with hints of a tenuous oxygen-CO₂ exosphere — detected by Cassini, the first 'atmosphere' ever found around an icy moon." },
  { name: "Titan",           parent: "Saturn",  visualRadius: 0.08,  orbitRadius: 2.20, periodDays: 15.95,  shade: "#d6c98c", fact: "Saturn's largest moon — bigger than Mercury. Only moon with a thick atmosphere (nitrogen + methane). Has lakes of liquid methane." },
  { name: "Iapetus",         parent: "Saturn",  visualRadius: 0.060, orbitRadius: 2.55, periodDays: 79.32,  shade: "#76695a", fact: "Two-faced moon — one hemisphere is bright water ice, the other is black as coal. The leading face sweeps up dust from outer moon Phoebe, painting it dark; the trailing face stays clean." },
  // Uranus's five major moons (Miranda + the classical four)
  { name: "Miranda",         parent: "Uranus",  visualRadius: 0.035, orbitRadius: 0.70, periodDays: 1.413,  shade: "#bcb8b0", fact: "The most geologically bizarre body in the solar system — sheer cliffs 20 km tall (taller than Everest), chevron-shaped features, and patchwork terrain that looks like the moon was smashed apart and put back together." },
  { name: "Ariel",           parent: "Uranus",  visualRadius: 0.045, orbitRadius: 0.95, periodDays: 2.520,  shade: "#c9c4ba", fact: "Brightest and one of the youngest surfaces in the Uranian system — extensive canyon and valley networks suggest cryovolcanism and recent tectonic activity, despite the cold." },
  { name: "Umbriel",         parent: "Uranus",  visualRadius: 0.045, orbitRadius: 1.20, periodDays: 4.144,  shade: "#7d7872", fact: "Darkest of Uranus's major moons. Heavily cratered with one bright spot — the Wunda crater on its equator — that may be carbonate exposed by an impact." },
  { name: "Titania",         parent: "Uranus",  visualRadius: 0.052, orbitRadius: 1.50, periodDays: 8.706,  shade: "#c5beae", fact: "Largest of Uranus's moons. Discovered by William Herschel in 1787, the same year as Oberon. Crossed by a 1,500-km canyon system (Messina Chasmata) — evidence its interior once expanded as a subsurface ocean froze." },
  { name: "Oberon",          parent: "Uranus",  visualRadius: 0.050, orbitRadius: 1.80, periodDays: 13.46,  shade: "#b3a89c", fact: "Outermost of Uranus's major moons. Surface dotted with bright impact craters whose centres reveal darker material — likely organic-rich slush from below." },
  { name: "Triton",          parent: "Neptune", visualRadius: 0.055, orbitRadius: 0.95, periodDays: -5.88,  shade: "#d8c6b8", fact: "Neptune's largest moon. Orbits BACKWARDS (retrograde) — likely a captured Kuiper Belt object." },
  { name: "Nereid",          parent: "Neptune", visualRadius: 0.022, orbitRadius: 2.40, periodDays: 360.13, shade: "#a8a298", fact: "Most eccentric orbit of any moon in the solar system (e=0.75) — swings between 1.4 million km and 9.6 million km from Neptune. Likely scattered into this strange orbit when Triton was captured." },
  // Charon — Pluto's largest moon. Real diameter is 53% of Pluto's, so
  // visualRadius scales accordingly (Pluto 0.26 × 0.53 ≈ 0.14). The
  // Pluto-Charon system is the only true binary planet-system: their
  // mutual barycenter sits ~960 km outside Pluto's surface, and both
  // bodies are tidally locked to each other.
  { name: "Charon",          parent: "Pluto",   visualRadius: 0.14,  orbitRadius: 0.95,  periodDays: 6.39,   shade: "#9e958a", fact: "Half the diameter of Pluto and 12% of its mass — the largest moon relative to its parent in the solar system. Mutually tidally locked: the two bodies present the same face to each other forever. Their barycenter sits outside Pluto's surface, so they technically orbit each other rather than Pluto being stationary. Discovered in 1978 from a smudge on a photographic plate." },
  // Pluto's four small outer moons — Styx, Nix, Kerberos, Hydra, all
  // discovered by Hubble between 2005 and 2012. Irregular, captured
  // remnants of the original Pluto-Charon-forming collision. Tiny
  // relative to Charon (radii under 25 km) so they render as small
  // accents at increasing distances from the barycenter.
  { name: "Styx",            parent: "Pluto",   visualRadius: 0.018, orbitRadius: 1.40,  periodDays: 20.16,  shade: "#a59b8f", fact: "Discovered 2012. ~16 km × 9 km, the smallest known moon of Pluto. Orbits between Charon and Nix; chaotic rotation, like all four small Pluto moons." },
  { name: "Nix",             parent: "Pluto",   visualRadius: 0.024, orbitRadius: 1.65,  periodDays: 24.85,  shade: "#bcb1a4", fact: "Discovered 2005 by Hubble. ~50 km long, irregular shape. Named for the Greek goddess of darkness, mother of Charon." },
  { name: "Kerberos",        parent: "Pluto",   visualRadius: 0.020, orbitRadius: 1.95,  periodDays: 32.17,  shade: "#a89c8e", fact: "Discovered 2011. ~19 km × 10 km, the second-darkest body in the Pluto system. Bilobed peanut shape — two lumps fused together." },
  { name: "Hydra",           parent: "Pluto",   visualRadius: 0.026, orbitRadius: 2.30,  periodDays: 38.20,  shade: "#c9bcab", fact: "Discovered 2005 alongside Nix. ~50 km × 30 km, the outermost confirmed Pluto moon. Bright water-ice surface — most reflective body in the system after Charon." },
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
    longNodeDeg: 59.4,
    argPeriDeg: 112.3,
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
    longNodeDeg: 139.4,
    argPeriDeg: 153.0,
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
    longNodeDeg: 235.2,
    argPeriDeg: 172.5,
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
    longNodeDeg: 334.6,
    argPeriDeg: 186.5,
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
    longNodeDeg: 195.4,
    argPeriDeg: 173.0,
    periodYears: 6.6,
    startPhase: 0.05,
    fact: "Parent of the Draconids meteor shower (peaks October 8). Visited by the ICE spacecraft in 1985 — the first ever direct flyby of a comet's tail.",
    visualRadius: 0.05,
  },
  {
    name: "Comet Hale-Bopp",
    designation: "C/1995 O1 (Hale–Bopp)",
    kind: "comet",
    aAU: 186,
    eccentricity: 0.995,
    inclDeg: 89.4,           // almost perpendicular to the ecliptic
    longNodeDeg: 282.9,
    argPeriDeg: 130.6,
    periodYears: 2533,       // returns ~4385 CE
    startPhase: 0.30,
    fact: "The Great Comet of 1997 — visible to the naked eye for 18 months, the longest period of unaided visibility of any comet in modern history. Bright enough to see from city centres. Won't return until around the year 4385.",
    visualRadius: 0.075,
  },
  {
    name: "Comet 67P",
    designation: "67P/Churyumov–Gerasimenko · Rosetta target",
    kind: "comet",
    aAU: 3.46,
    eccentricity: 0.641,
    inclDeg: 7.04,
    longNodeDeg: 50.1,
    argPeriDeg: 12.8,
    periodYears: 6.44,
    startPhase: 0.65,
    fact: "Famous as the first comet humanity ever landed on — ESA's Philae touched down on 67P's surface November 12, 2014. Rubber-duck shaped (two lobes fused), only 4.3 × 4.1 km. Mother ship Rosetta tracked it through perihelion in August 2015, watching jets of gas erupt as the comet warmed.",
    visualRadius: 0.06,
  },
  {
    name: "Comet Hyakutake",
    designation: "C/1996 B2 (Hyakutake)",
    kind: "comet",
    aAU: 1705,                // (0.23 + 3410)/2
    eccentricity: 0.9999,
    inclDeg: 124.92,          // retrograde
    longNodeDeg: 188.0,
    argPeriDeg: 130.2,
    periodYears: 70000,
    startPhase: 0.42,
    fact: "The 'Great Comet of 1996.' Famously passed just 0.10 AU from Earth (~15 million km, ~40× the Moon's distance) on March 25, 1996 — a once-in-200-years close approach. The Ulysses spacecraft flew through its 570-million-km tail by accident, the longest comet tail ever directly measured. Won't return for 70,000 years.",
    visualRadius: 0.075,
  },
  {
    name: "Comet Tsuchinshan-ATLAS",
    designation: "C/2023 A3 (Tsuchinshan–ATLAS)",
    kind: "comet",
    aAU: 1750,                // (0.39 + 3500)/2
    eccentricity: 0.9999,
    inclDeg: 139.1,
    longNodeDeg: 21.6,
    argPeriDeg: 308.5,
    periodYears: 80000,
    startPhase: 0.48,
    fact: "Late 2024's spectacular naked-eye comet — discovered by China's Tsuchinshan Observatory + NASA's ATLAS survey in early 2023. Crossed the inner solar system in October 2024 with a remarkable anti-tail visible against perihelion glow. Won't return for ~80,000 years.",
    visualRadius: 0.075,
  },
  {
    name: "Comet Ikeya-Seki",
    designation: "C/1965 S1 (Ikeya–Seki) · Kreutz sungrazer",
    kind: "comet",
    aAU: 91.6,                // (0.0078 + 183.2)/2
    eccentricity: 0.9999,
    inclDeg: 141.86,          // retrograde, Kreutz group
    longNodeDeg: 346.3,
    argPeriDeg: 69.0,
    periodYears: 880,
    startPhase: 0.81,
    fact: "Most famous Kreutz sungrazer of the 20th century. Passed just 450,000 km above the Sun's photosphere on October 21, 1965 — bright enough to see in broad daylight. Split into three pieces during the close pass from solar tidal forces. Returns ~2845 CE.",
    visualRadius: 0.06,
  },
  {
    name: "Comet NEOWISE",
    designation: "C/2020 F3 (NEOWISE)",
    kind: "comet",
    aAU: 358,
    eccentricity: 0.999,     // essentially parabolic
    inclDeg: 128.9,          // retrograde — handled by inclination > 90 rule
    longNodeDeg: 61.0,
    argPeriDeg: 37.3,
    periodYears: 6800,
    startPhase: 0.55,
    fact: "The brightest naked-eye comet in the northern hemisphere since Hale-Bopp 23 years earlier. Discovered by the NEOWISE space telescope on March 27, 2020 and visible to millions during the early COVID lockdowns. Won't return for nearly seven millennia.",
    visualRadius: 0.07,
  },
  // ----- Named near-Earth + main-belt asteroids -----
  {
    name: "Apophis",
    designation: "99942 Apophis",
    kind: "asteroid",
    aAU: 0.922,
    eccentricity: 0.191,
    inclDeg: 3.34,
    longNodeDeg: 204.0,
    argPeriDeg: 126.4,
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
    longNodeDeg: 304.3,
    argPeriDeg: 178.8,
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
    longNodeDeg: 209.4,
    argPeriDeg: 339.3,
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
    longNodeDeg: 103.8,
    argPeriDeg: 151.2,
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
    longNodeDeg: 80.3,
    argPeriDeg: 73.6,
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
    longNodeDeg: 173.1,
    argPeriDeg: 310.5,
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
    longNodeDeg: 283.4,
    argPeriDeg: 312.2,
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
    longNodeDeg: 2.1,
    argPeriDeg: 66.2,
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
    longNodeDeg: 251.6,
    argPeriDeg: 211.4,
    periodYears: 1.30,
    startPhase: 0.07,
    fact: "Diamond-shaped near-Earth asteroid sampled by JAXA's Hayabusa2 in 2019; 5.4 g returned to Earth in 2020. Pre-dates the solar system's planets — preserves grains from the molecular cloud our Sun formed in.",
    visualRadius: 0.04,
  },
  {
    name: "Didymos / Dimorphos",
    designation: "65803 Didymos · DART target",
    kind: "asteroid",
    aAU: 1.644,
    eccentricity: 0.384,
    inclDeg: 3.41,
    longNodeDeg: 73.2,
    argPeriDeg: 319.4,
    periodYears: 2.11,
    startPhase: 0.50,
    fact: "Binary near-Earth asteroid. NASA's DART spacecraft slammed into the smaller body Dimorphos on September 26, 2022 at 6.6 km/s — the first ever test of planetary defence by kinetic impact. Successfully shortened Dimorphos's orbit around Didymos by 33 minutes, proving humanity can deflect an asteroid.",
    visualRadius: 0.04,
  },
  {
    name: "16 Psyche",
    designation: "16 Psyche · M-type metallic",
    kind: "asteroid",
    aAU: 2.923,
    eccentricity: 0.134,
    inclDeg: 3.10,
    longNodeDeg: 150.0,
    argPeriDeg: 228.0,
    periodYears: 4.99,
    startPhase: 0.34,
    fact: "Metal-rich M-type asteroid in the main belt, possibly the exposed iron-nickel core of a destroyed protoplanet. Target of NASA's Psyche mission (arrives August 2029). If the core hypothesis holds, it'll give the first direct look at what the interiors of Mercury, Venus, Earth, and Mars are made of.",
    visualRadius: 0.05,
  },
  {
    name: "Arrokoth",
    designation: "486958 Arrokoth · 2014 MU69",
    kind: "asteroid",
    aAU: 44.6,
    eccentricity: 0.039,
    inclDeg: 2.45,
    longNodeDeg: 158.9,
    argPeriDeg: 174.4,
    periodYears: 297.5,
    startPhase: 0.62,
    fact: "Cold Classical Kuiper Belt object — flown by NASA's New Horizons on January 1, 2019, the most distant object ever visited (44 AU). Contact-binary 'snowman' shape (two lobes fused), preserves a 4.5-billion-year-old record of how planetesimals first stuck together.",
    visualRadius: 0.045,
  },
  // ----- Interstellar visitors — one-way trajectories -----
  {
    name: "'Oumuamua",
    designation: "1I/2017 U1 ('Oumuamua)",
    kind: "interstellar",
    aAU: 0.255,            // perihelion distance (0.255 AU, inside Mercury's orbit)
    eccentricity: 1.20,     // hyperbolic
    inclDeg: 122.7,
    longNodeDeg: 24.6,
    argPeriDeg: 241.8,
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
    longNodeDeg: 308.2,
    argPeriDeg: 209.1,
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
    longNodeDeg: 36.0,
    argPeriDeg: 151.6,
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
    longNodeDeg: 144.4,
    argPeriDeg: 311.4,
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
    longNodeDeg: 79.3,
    argPeriDeg: 295.7,
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
    longNodeDeg: 122.1,
    argPeriDeg: 239.1,
    periodYears: 283,
    startPhase: 0.39,
    fact: "Spins so fast (one rotation every 3.9 hours) that it's been pulled into an elongated football shape — roughly 2,300 km long by 1,000 km wide. The first known TNO with confirmed rings, discovered 2017. Has two small moons, Hi'iaka and Namaka.",
    visualRadius: 0.06,
  },
  {
    name: "Quaoar",
    designation: "50000 Quaoar · TNO with rings",
    kind: "dwarf",
    aAU: 43.69,
    eccentricity: 0.039,
    inclDeg: 7.99,
    longNodeDeg: 188.9,
    argPeriDeg: 161.2,
    periodYears: 289,
    startPhase: 0.42,
    fact: "Trans-Neptunian dwarf, ~1,110 km across, discovered 2002. Surprised astronomers in 2023: it has rings. They orbit at twice the Roche limit — where conventional theory says rings shouldn't exist; they should have coalesced into a moon by now. Quaoar already has one moon, Weywot.",
    visualRadius: 0.055,
  },
  {
    name: "Gonggong",
    designation: "225088 Gonggong",
    kind: "dwarf",
    aAU: 67.38,
    eccentricity: 0.502,
    inclDeg: 30.66,
    longNodeDeg: 336.8,
    argPeriDeg: 207.7,
    periodYears: 553,
    startPhase: 0.85,
    fact: "Fifth-largest known dwarf planet, with a deep red surface from frozen methane irradiated by cosmic rays. Discovered in 2007, formally named in 2019 for the Chinese water god. Has a moon, Xiangliu.",
    visualRadius: 0.06,
  },
  // ----- Active spacecraft — human-built outposts at known positions -----
  // Orbital values here are conceptual approximations; spacecraft are
  // rendered as gently drifting points so the user can find each one even
  // though their real trajectories don't loop.
  // Orbital elements for escape trajectories: longNodeDeg + argPeriDeg
  // orient the orbital plane in 3D so the spacecraft's outbound direction
  // points toward its real-world target constellation. Without these the
  // direction would be arbitrary (just inclination, no rotation about Ω).
  {
    name: "Voyager 1",
    designation: "Voyager 1 · NASA · 1977",
    kind: "spacecraft",
    aAU: 161,              // ~24 billion km / 1 AU ≈ 160 AU as of mid-2025
    eccentricity: 1.00001,  // escape trajectory
    inclDeg: 35.7,
    longNodeDeg: 178.9,    // post-Saturn-flyby ascending node
    argPeriDeg: 338.2,     // perihelion direction inside the orbital plane
    elementsEpoch: "2025-01",
    periodYears: Infinity,
    startPhase: 0.0,
    fact: "Furthest human-made object — over 24 billion km (~161 AU) from Earth, beyond the heliopause since August 2012. Travelling at ~17 km/s (38,000 mph / 61,000 km/h) through the interstellar medium. Still transmitting on a 22.6-watt signal that takes 22+ hours to reach us. Carrying the Golden Record toward Gliese 445 (encounter in ~40,000 years). Escape direction roughly RA 17h Dec +12° (Ophiuchus / Hercules border).",
    visualRadius: 0.05,
  },
  {
    name: "Voyager 2",
    designation: "Voyager 2 · NASA · 1977",
    kind: "spacecraft",
    aAU: 143,              // 21+ billion km / 1 AU ≈ 143 AU as of mid-2025
    eccentricity: 1.00001,
    inclDeg: 78.8,         // post-Neptune flyby — dove south steeply
    longNodeDeg: 101.7,
    argPeriDeg: 130.0,
    elementsEpoch: "2025-01",
    periodYears: Infinity,
    startPhase: 0.3,
    fact: "Only spacecraft to have flown by all four giant planets — Jupiter, Saturn, Uranus, Neptune. Crossed the heliopause November 5, 2018, six years after Voyager 1, on the opposite side of the Sun. Now over 21 billion km (143+ AU) from Earth, travelling at 15.3 km/s into the interstellar medium. Escape direction roughly RA 20h Dec -57° (Telescopium / Pavo).",
    visualRadius: 0.05,
  },
  {
    name: "New Horizons",
    designation: "New Horizons · NASA · 2006",
    kind: "spacecraft",
    aAU: 62,
    eccentricity: 1.00001,
    inclDeg: 2.3,
    longNodeDeg: 224.9,
    argPeriDeg: 104.0,
    periodYears: Infinity,
    startPhase: 0.55,
    fact: "Flew past Pluto in July 2015 — first close-up images of the dwarf planet ever taken. In 2019 it flew past Arrokoth, the most distant object ever visited (44 AU). Now drifting outward at 14 km/s toward the heliopause, heading roughly toward Sagittarius (RA 19h Dec -23°).",
    visualRadius: 0.045,
  },
  {
    name: "James Webb Space Telescope",
    designation: "JWST · NASA / ESA / CSA · 2021",
    kind: "spacecraft",
    aAU: 1.01,              // ~1 AU + 1.5M km (Sun-Earth L2)
    eccentricity: 0.0167,    // tracks Earth's heliocentric ellipse
    inclDeg: 0.0,
    longNodeDeg: 0.0,
    argPeriDeg: 283.0,       // matches Earth's perihelion direction
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
    longNodeDeg: 151.0,      // post-2024 Venus assist
    argPeriDeg: 89.0,
    elementsEpoch: "2025-01",
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
    longNodeDeg: 251.0,
    argPeriDeg: 171.0,
    elementsEpoch: "2025-01",
    periodYears: 1.48,
    startPhase: 0.78,
    fact: "Returned asteroid Ryugu samples to Earth in December 2020 — second-ever asteroid sample return, after the original Hayabusa. Now on an 11-year extended cruise toward asteroid 1998 KY26 (rendezvous July 2031) with a 2026 Earth flyby and a 2027 flyby of asteroid 2001 CC21.",
    // Inner-system spacecraft (sub-2-AU) get a smaller visualRadius so
    // they read as probes, not planets, when they happen to cluster
    // near Earth at the current sim time. Real orbital positions are
    // preserved — only the render size shrinks.
    visualRadius: 0.028,
  },
  {
    name: "OSIRIS-APEX",
    designation: "OSIRIS-APEX · NASA · 2016",
    kind: "spacecraft",
    aAU: 1.14,               // post-Bennu trajectory toward Apophis
    eccentricity: 0.20,
    inclDeg: 6.0,
    longNodeDeg: 78.0,
    argPeriDeg: 88.0,
    elementsEpoch: "2025-01",
    periodYears: 1.22,
    startPhase: 0.85,
    fact: "Originally OSIRIS-REx — flew to asteroid Bennu and dropped the sample capsule on Utah in September 2023, then was redirected as OSIRIS-APEX to rendezvous with near-Earth asteroid 99942 Apophis on April 13, 2029, the day Apophis makes its closest flyby of Earth (~32,000 km).",
    visualRadius: 0.028,
  },
  {
    name: "Lucy",
    designation: "Lucy · NASA · 2021",
    kind: "spacecraft",
    aAU: 3.31,               // main-belt cruise toward Trojans
    eccentricity: 0.46,
    inclDeg: 2.7,
    longNodeDeg: 121.0,
    argPeriDeg: 84.0,
    elementsEpoch: "2025-01",
    periodYears: 6.0,
    startPhase: 0.20,
    fact: "First mission to the Jupiter Trojans — the two clouds of asteroids that share Jupiter's orbit, 60° ahead and behind it. Eleven-year tour visiting eight asteroids between 2025 and 2033, including Donaldjohanson (April 2025) and Eurybates with its tiny moon Queta.",
    visualRadius: 0.028,
  },
  {
    name: "BepiColombo",
    designation: "BepiColombo · ESA / JAXA · 2018",
    kind: "spacecraft",
    aAU: 0.65,               // cruising toward Mercury orbit insertion
    eccentricity: 0.24,
    inclDeg: 5.0,
    longNodeDeg: 87.0,
    argPeriDeg: 273.0,
    elementsEpoch: "2025-01",
    periodYears: 0.53,
    startPhase: 0.92,
    fact: "Joint ESA / JAXA Mercury mission — completing nine planetary flybys (Earth × 1, Venus × 2, Mercury × 6) before braking into Mercury orbit in November 2026. Two orbiters then separate: one mapping the surface, one studying the magnetosphere.",
    visualRadius: 0.028,
  },
  // ----- Recent / in-flight outer-solar-system missions -----
  {
    name: "Europa Clipper",
    designation: "Europa Clipper · NASA · 2024",
    kind: "spacecraft",
    aAU: 3.2,                // mid-cruise toward Jupiter (snapshot)
    eccentricity: 0.55,
    inclDeg: 4.0,
    longNodeDeg: 30.0,
    argPeriDeg: 184.0,
    elementsEpoch: "2025-01",
    periodYears: 5.5,
    startPhase: 0.62,
    fact: "Largest planetary spacecraft NASA has ever built — launched October 14, 2024. Will arrive at Jupiter April 2030, then make ~49 close flybys of Europa to study its subsurface ocean, the most promising place in the solar system to look for present-day life beyond Earth.",
    visualRadius: 0.032,
  },
  {
    name: "JUICE",
    designation: "JUICE · ESA · 2023",
    kind: "spacecraft",
    aAU: 2.6,                // cruise + flybys toward Jupiter
    eccentricity: 0.42,
    inclDeg: 3.6,
    longNodeDeg: 88.0,
    argPeriDeg: 215.0,
    elementsEpoch: "2025-01",
    periodYears: 4.5,
    startPhase: 0.40,
    fact: "ESA's Jupiter Icy Moons Explorer — launched April 14, 2023, arrives at Jupiter July 2031. Will study Ganymede, Callisto, and Europa over four years, then enter orbit around Ganymede in 2034 — the first time any spacecraft will orbit a moon other than Earth's.",
    visualRadius: 0.030,
  },
  {
    name: "Psyche",
    designation: "Psyche · NASA · 2023",
    kind: "spacecraft",
    aAU: 2.4,                // cruise toward asteroid 16 Psyche
    eccentricity: 0.30,
    inclDeg: 7.0,
    longNodeDeg: 162.0,
    argPeriDeg: 41.0,
    elementsEpoch: "2025-01",
    periodYears: 3.9,
    startPhase: 0.18,
    fact: "First mission to a metal-rich M-type asteroid — launched October 13, 2023, arrives at 16 Psyche in August 2029. The asteroid may be an exposed planetary core from the early solar system, giving the first direct look at what the cores of Mercury, Venus, Earth and Mars are made of.",
    visualRadius: 0.030,
  },
  {
    name: "Solar Orbiter",
    designation: "Solar Orbiter · ESA / NASA · 2020",
    kind: "spacecraft",
    aAU: 0.72,
    eccentricity: 0.293,
    inclDeg: 17.0,           // tilting steeper with each Venus flyby
    longNodeDeg: 142.0,
    argPeriDeg: 28.0,
    elementsEpoch: "2025-01",
    periodYears: 0.61,
    startPhase: 0.34,
    fact: "Returned the first ever direct images of the Sun's poles in 2024 — impossible from Earth's near-ecliptic vantage. Uses Venus gravity assists to climb out of the ecliptic, eventually reaching ~33° solar latitude.",
    visualRadius: 0.030,
  },
  // ----- Historical / mission-completed legacy spacecraft. Frozen at
  // last known position so users can find them and read their stories.
  // Marked elementsEpoch with the mission-end year for honesty. -----
  {
    name: "Cassini",
    designation: "Cassini · NASA / ESA / ASI · 1997–2017",
    kind: "spacecraft",
    aAU: 9.537,              // frozen in Saturn orbit at mission end
    eccentricity: 0.0,        // approximating final Saturn-orbit position
    inclDeg: 2.485,
    longNodeDeg: 113.6,
    argPeriDeg: 339.4,
    elementsEpoch: "2017-09",
    periodYears: 29.46,       // Saturn's orbital period — we render it
                              //  co-orbiting at Saturn's heliocentric path
    startPhase: 0.50,
    fact: "Studied Saturn for 13 years (2004–2017) — discovered Enceladus's water-ice plumes, mapped Titan's methane lakes, watched a hurricane churn in Saturn's north-polar hexagon. Deliberately deorbited into Saturn's atmosphere on September 15, 2017 to protect any possible Enceladus / Titan life from contamination.",
    visualRadius: 0.035,
  },
  {
    name: "DART",
    designation: "DART · NASA · 2021–2022",
    kind: "spacecraft",
    aAU: 1.644,               // co-orbits Didymos at impact location
    eccentricity: 0.384,
    inclDeg: 3.41,
    longNodeDeg: 73.2,
    argPeriDeg: 319.4,
    elementsEpoch: "2022-09",
    periodYears: 2.11,
    startPhase: 0.50,
    fact: "Double Asteroid Redirection Test — first ever planetary-defence demonstration. NASA deliberately crashed the 570-kg spacecraft into Dimorphos (moonlet of Didymos) on September 26, 2022 at 6.6 km/s, shortening the moonlet's orbital period by 33 minutes. Proved that humanity can deflect an incoming asteroid. The spacecraft itself was destroyed on impact; its trajectory is frozen here at the impact point.",
    visualRadius: 0.025,
  },
  {
    name: "Galileo",
    designation: "Galileo · NASA · 1989–2003",
    kind: "spacecraft",
    aAU: 5.203,              // frozen at Jupiter at mission end
    eccentricity: 0.049,
    inclDeg: 1.303,
    longNodeDeg: 100.5,
    argPeriDeg: 273.9,
    elementsEpoch: "2003-09",
    periodYears: 11.86,
    startPhase: 0.20,
    fact: "First spacecraft to orbit Jupiter (1995-2003). Discovered Europa's evidence of a subsurface ocean and witnessed Comet Shoemaker-Levy 9's impact on Jupiter in 1994. Deliberately deorbited into Jupiter on September 21, 2003 to protect Europa from contamination — the first asteroid flyby (Gaspra 1991, Ida 1993, found Ida's moon Dactyl) en route.",
    visualRadius: 0.034,
  },
  {
    name: "Mariner 10",
    designation: "Mariner 10 · NASA · 1973–1975",
    kind: "spacecraft",
    aAU: 0.59,                // frozen approximate heliocentric orbit
    eccentricity: 0.45,
    inclDeg: 0.85,
    longNodeDeg: 30.0,
    argPeriDeg: 65.0,
    elementsEpoch: "1975-03",
    periodYears: 0.43,
    startPhase: 0.30,
    fact: "First spacecraft to use a gravitational slingshot (Venus, 1974) to reach another planet — Mercury. Also first to visit two planets. Imaged ~45% of Mercury's surface across three flybys before running out of attitude-control gas in 1975. Spacecraft still orbits the Sun, electronics long dead.",
    visualRadius: 0.030,
  },
  {
    name: "Rosetta",
    designation: "Rosetta · ESA · 2004–2016",
    kind: "spacecraft",
    aAU: 3.46,                // 67P's semi-major axis — Rosetta tracked
                              //  the comet through its perihelion + back
    eccentricity: 0.641,
    inclDeg: 7.0,
    longNodeDeg: 50.1,
    argPeriDeg: 12.8,
    elementsEpoch: "2016-09",
    periodYears: 6.45,
    startPhase: 0.65,
    fact: "First spacecraft to orbit a comet (67P/Churyumov-Gerasimenko, 2014–2016) and the first to soft-land on one (the Philae lander, November 2014). Returned the most detailed comet science in history — water-vapour isotopes, organic molecules on the surface. Ended September 30, 2016 with a controlled descent onto 67P itself.",
    visualRadius: 0.028,
  },
  // ----- Dormant interstellar probes — still on their escape trajectories
  // even though communications ended decades ago. Worth carrying for
  // completeness: they're the only human-made objects on hyperbolic
  // paths besides the Voyagers + New Horizons. -----
  {
    name: "Pioneer 10",
    designation: "Pioneer 10 · NASA · 1972",
    kind: "spacecraft",
    aAU: 134,                // estimated current heliocentric distance
    eccentricity: 1.00001,
    inclDeg: 26.2,           // post-Jupiter flyby
    longNodeDeg: 6.0,
    argPeriDeg: 161.0,
    periodYears: Infinity,
    startPhase: 0.15,
    fact: "First spacecraft to cross the asteroid belt and the first to fly by Jupiter (December 1973). Last signal received January 2003 at 12.05 billion km. Coasting on toward the red giant star Aldebaran in Taurus — a 2-million-year journey.",
    visualRadius: 0.04,
  },
  {
    name: "Pioneer 11",
    designation: "Pioneer 11 · NASA · 1973",
    kind: "spacecraft",
    aAU: 113,
    eccentricity: 1.00001,
    inclDeg: 16.5,
    longNodeDeg: 326.0,
    argPeriDeg: 30.0,
    periodYears: Infinity,
    startPhase: 0.45,
    fact: "First spacecraft to fly past Saturn (September 1979), using Jupiter's gravity to whip up to the ringed planet. Last contact November 1995. Heading toward the constellation Scutum / Aquila area; will pass within ~4 light years of a star in Sagittarius in ~4 million years.",
    visualRadius: 0.04,
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
  {
    id: "gn-z11",
    name: "GN-z11",
    designation: "GN-z11 · among the oldest galaxies known",
    kind: "galaxy",
    raHours: 12.617,
    decDeg: 62.24,
    magnitude: 26.0,
    distance: "13.4 billion ly (light-travel)",
    fact: "One of the most distant galaxies ever spectroscopically confirmed — its light reaches us from just ~430 million years after the Big Bang. JWST detected an unexpectedly high nitrogen-to-oxygen ratio in 2023 + possible signature of a supermassive black hole, challenging models of how the very first galaxies formed.",
    visualSize: 1.6,
  },
  {
    id: "stephans-quintet",
    name: "Stephan's Quintet",
    designation: "HCG 92 · JWST first-light target",
    kind: "galaxy",
    raHours: 22.598,
    decDeg: 33.97,
    magnitude: 12.6,
    distance: "290 million ly",
    fact: "Compact group of five galaxies caught in a slow-motion gravitational dance. Four of them are physically interacting — the fifth (NGC 7320) is a foreground galaxy that just appears nearby. JWST's first-released image (July 12, 2022) revealed shock waves between them in unprecedented infrared detail.",
    visualSize: 3.2,
  },
  {
    id: "ngc-1300",
    name: "NGC 1300",
    designation: "NGC 1300 · barred spiral exemplar",
    kind: "galaxy",
    raHours: 3.331,
    decDeg: -19.41,
    magnitude: 10.4,
    distance: "61 million ly",
    fact: "Textbook barred spiral — the central bar of stars is so prominent it's the canonical example used in astronomy courses. Hubble's 2005 portrait revealed a second smaller spiral structure in the very centre, a galaxy-within-a-galaxy. About the same size as the Milky Way.",
    visualSize: 3.4,
  },
  {
    id: "cartwheel-galaxy",
    name: "Cartwheel Galaxy",
    designation: "ESO 350-40 · ring galaxy",
    kind: "galaxy",
    raHours: 0.628,
    decDeg: -33.72,
    magnitude: 15.2,
    distance: "500 million ly",
    fact: "Formed when a smaller galaxy plunged through this larger spiral 200 million years ago, sending out a circular shockwave that triggered massive star formation in a ring. JWST's August 2022 image revealed the wagon-wheel structure in unprecedented infrared detail — bright pink star-forming regions trace the outer ring.",
    visualSize: 2.6,
  },
  {
    id: "sombrero-galaxy",
    name: "Sombrero Galaxy",
    designation: "M104 · NGC 4594",
    kind: "galaxy",
    raHours: 12.665,
    decDeg: -11.62,
    magnitude: 8.0,
    distance: "31 million ly",
    fact: "Iconic edge-on spiral, named for its distinctive hat-shaped silhouette: a bright central bulge encircled by a dark dust lane. Hosts a billion-solar-mass supermassive black hole at its core, one of the most massive yet measured in a nearby galaxy.",
    visualSize: 3.2,
  },
  {
    id: "whirlpool-galaxy",
    name: "Whirlpool Galaxy",
    designation: "M51 · NGC 5194 + NGC 5195",
    kind: "galaxy",
    raHours: 13.498,
    decDeg: 47.20,
    magnitude: 8.4,
    distance: "31 million ly",
    fact: "First galaxy ever identified as a spiral (Lord Rosse, 1845). Interacting with a smaller companion (NGC 5195) that's tugging on the larger galaxy's arms. The spiral arms are textbook examples of density-wave traffic-jam structure.",
    visualSize: 3.4,
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
  {
    id: "m16",
    name: "Eagle Nebula",
    designation: "M16 · NGC 6611 · Pillars of Creation",
    kind: "nebula",
    raHours: 18.313,
    decDeg: -13.79,
    magnitude: 6.0,
    distance: "5,700 ly",
    fact: "Home of the iconic Pillars of Creation — 4-light-year-tall fingers of cold gas being sculpted by ultraviolet radiation from nearby hot young stars. Hubble photographed them in 1995; JWST returned the closest infrared portrait in 2022, revealing newborn stars hidden inside the columns.",
    visualSize: 2.8,
  },
  {
    id: "carina",
    name: "Carina Nebula",
    designation: "NGC 3372 · Eta Carinae's home",
    kind: "nebula",
    raHours: 10.733,
    decDeg: -59.87,
    magnitude: 1.0,
    distance: "8,500 ly",
    fact: "One of the largest emission nebulae in the sky, hosting Eta Carinae + WR 25 (one of the most luminous known stars) + the Mystic Mountain pillar JWST imaged for its 'Cosmic Cliffs' showcase in 2022. Five times the apparent size of the full Moon.",
    visualSize: 3.5,
  },
  {
    id: "cas-a",
    name: "Cassiopeia A",
    designation: "Cas A · SNR G111.7-2.1",
    kind: "nebula",
    raHours: 23.391,
    decDeg: 58.81,
    magnitude: 6.0,
    distance: "11,000 ly",
    fact: "Youngest known supernova remnant in the Milky Way — the star exploded ~340 years ago (light reached Earth around 1680), but no one definitively recorded the original event. Strongest radio source in the sky outside our solar system. JWST's spectacular 2023 mid-infrared image revealed an inner 'Green Monster' filament structure no one expected.",
    visualSize: 2.4,
  },
  {
    id: "sn-1604",
    name: "Kepler's Supernova",
    designation: "SN 1604 · last naked-eye Milky Way supernova",
    kind: "nebula",
    raHours: 17.503,
    decDeg: -21.49,
    magnitude: 8.0,
    distance: "20,000 ly",
    fact: "Observed October 1604 by Johannes Kepler and others — the LAST supernova in the Milky Way visible to the naked eye, 420+ years ago. Outshone every star in the sky except Venus for three weeks. Helped overturn the ancient belief in unchanging heavens. The remnant is now a hot 14-light-year shell expanding at 4 million mph.",
    visualSize: 1.9,
  },
  {
    id: "tychos-sn",
    name: "Tycho's Supernova",
    designation: "SN 1572 · Tycho Brahe's stella nova",
    kind: "nebula",
    raHours: 0.421,
    decDeg: 64.13,
    magnitude: 7.5,
    distance: "8,000 ly",
    fact: "Observed November 1572 by Tycho Brahe. As bright as Venus at peak, visible during the day for two weeks. Tycho's book 'De nova stella' coined the term 'nova' and was crucial evidence against the ancient idea that the heavens were unchanging. The expanding remnant is now studied as a Type Ia supernova reference.",
    visualSize: 1.8,
  },
  {
    id: "sn-1987a",
    name: "SN 1987A",
    designation: "SN 1987A remnant · LMC supernova",
    kind: "nebula",
    raHours: 5.594,
    decDeg: -69.27,
    magnitude: 3.0,
    distance: "168,000 ly",
    fact: "Closest naked-eye supernova since Kepler's in 1604, exploded February 23 1987 in the Large Magellanic Cloud. The first supernova where neutrinos were detected before the visible light — confirming theory that the gravitational collapse produces a neutrino burst. The expanding shock front is still studied today by Hubble + JWST; the predicted neutron-star remnant was finally detected hiding behind dust in 2024.",
    visualSize: 1.8,
  },
  {
    id: "helix",
    name: "Helix Nebula",
    designation: "NGC 7293 · Eye of God",
    kind: "nebula",
    raHours: 22.494,
    decDeg: -20.84,
    magnitude: 7.6,
    distance: "655 ly",
    fact: "Closest planetary nebula to Earth — a Sun-like star that shed its outer layers ~10,600 years ago, leaving a white dwarf surrounded by glowing concentric shells. Spitzer infrared imagery revealed a dusty disc around the central white dwarf, possibly the surviving inner planets of the dead star.",
    visualSize: 2.6,
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
  {
    id: "omega-cen",
    name: "Omega Centauri",
    designation: "NGC 5139 · largest Milky Way globular",
    kind: "cluster",
    raHours: 13.447,
    decDeg: -47.48,
    magnitude: 3.9,
    distance: "17,090 ly",
    fact: "Largest and brightest globular cluster orbiting the Milky Way — 10 million stars packed into a sphere ~150 ly across. Probably the surviving nucleus of a dwarf galaxy the Milky Way digested billions of years ago. Hosts multiple stellar generations, which a normal globular shouldn't, supporting the digested-galaxy origin.",
    visualSize: 2.6,
  },
  {
    id: "47-tuc",
    name: "47 Tucanae",
    designation: "NGC 104 · second-brightest globular",
    kind: "cluster",
    raHours: 0.402,
    decDeg: -72.08,
    magnitude: 4.1,
    distance: "13,000 ly",
    fact: "Second-brightest globular cluster after Omega Centauri, visible to the naked eye next to the SMC. Hosts 25+ millisecond pulsars in its dense core. Dense enough that black-hole star encounters likely happen on million-year timescales.",
    visualSize: 2.2,
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
    planets: [
      { name: "Proxima d", aAU: 0.029, radiusEarth: 0.81, periodDays: 5.12, type: "Sub-Earth, hot",                                  fact: "Recently confirmed (2022). Smallest known exoplanet around Proxima — ~0.26 Earth-mass, orbiting inside the habitable zone but probably too irradiated for liquid water." },
      { name: "Proxima b", aAU: 0.0485, radiusEarth: 1.07, periodDays: 11.19, type: "Earth-mass, habitable zone", habitableZone: true, fact: "Closest potentially-habitable exoplanet to Earth. Discovered 2016. Tidally locked; flare bursts from the red dwarf may strip its atmosphere, but a thick CO₂ layer could still allow liquid water on the day side." },
      { name: "Proxima c", aAU: 1.489, radiusEarth: 2.0, periodDays: 1928, type: "Cold super-Earth",                                 fact: "Discovered 2019. Super-Earth on a 5.3-year orbit, far outside the habitable zone (-235 °C). One of the targets where direct imaging may eventually be feasible." },
    ],
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
    planets: [
      { name: "51 Pegasi b", aAU: 0.0527, radiusEarth: 13.7, periodDays: 4.23, type: "Hot Jupiter",                                  fact: "Dimidium — the first exoplanet ever discovered around a Sun-like star (Mayor & Queloz, 1995). Hot Jupiter at 0.053 AU; its existence broke every textbook model of where gas giants could form. Won the 2019 Nobel Prize in Physics." },
    ],
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
    // Seven Earth-sized planets — actual orbital data. b/c are too hot,
    // e/f/g are in the habitable zone, h is too cold. All in a 1:2:4:8
    // mean-motion resonance chain.
    planets: [
      { name: "TRAPPIST-1 b", aAU: 0.0115, radiusEarth: 1.116, periodDays: 1.51,  type: "Rocky, hot",                                              fact: "Hottest of the seven; tidally locked, possibly bare rock. JWST 2023 found no thick atmosphere." },
      { name: "TRAPPIST-1 c", aAU: 0.0158, radiusEarth: 1.097, periodDays: 2.42,  type: "Rocky, hot",                                              fact: "Earth-sized, Venus-like surface temperature. JWST detected little atmosphere." },
      { name: "TRAPPIST-1 d", aAU: 0.0223, radiusEarth: 0.788, periodDays: 4.05,  type: "Rocky, warm",                                             fact: "Smallest of the seven; just inside the habitable zone's inner edge." },
      { name: "TRAPPIST-1 e", aAU: 0.0293, radiusEarth: 0.920, periodDays: 6.10,  type: "Rocky, habitable zone", habitableZone: true,             fact: "Strongest candidate for habitability — Earth-sized, in the heart of the liquid-water zone, density consistent with a rocky world." },
      { name: "TRAPPIST-1 f", aAU: 0.0385, radiusEarth: 1.045, periodDays: 9.21,  type: "Rocky, habitable zone", habitableZone: true,             fact: "Earth-sized, in the habitable zone, possibly with a water-rich composition." },
      { name: "TRAPPIST-1 g", aAU: 0.0469, radiusEarth: 1.129, periodDays: 12.35, type: "Rocky, habitable zone", habitableZone: true,             fact: "Largest of the seven, outer edge of the habitable zone — likely an icy or volatile-rich world." },
      { name: "TRAPPIST-1 h", aAU: 0.0619, radiusEarth: 0.755, periodDays: 18.77, type: "Rocky, cold",                                            fact: "Outermost known planet — surface temperatures of a 'snowball' world, but possibly with subsurface ocean under ice." },
    ],
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
    planets: [
      { name: "Kepler-186 b", aAU: 0.034, radiusEarth: 1.07, periodDays: 3.89,  type: "Rocky, hot",                                fact: "Innermost — far too hot for liquid water." },
      { name: "Kepler-186 c", aAU: 0.045, radiusEarth: 1.25, periodDays: 7.27,  type: "Rocky, hot",                                fact: "Hot rocky world, Venus-like environment." },
      { name: "Kepler-186 d", aAU: 0.078, radiusEarth: 1.40, periodDays: 13.34, type: "Rocky, warm",                               fact: "Warm super-Earth just inside the habitable zone." },
      { name: "Kepler-186 e", aAU: 0.110, radiusEarth: 1.27, periodDays: 22.41, type: "Rocky, edge of habitable zone",             fact: "Near the inner edge of the habitable zone." },
      { name: "Kepler-186 f", aAU: 0.432, radiusEarth: 1.17, periodDays: 129.95, type: "Rocky, habitable zone", habitableZone: true, fact: "First Earth-sized planet ever found in another star's habitable zone (2014). 1.17× Earth's radius, 130-day year around a red dwarf." },
    ],
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
    planets: [
      { name: "Tau Ceti g", aAU: 0.133, radiusEarth: 1.86, periodDays: 20.0,  type: "Super-Earth, hot",                                          fact: "Innermost candidate. Hot — well inside the habitable zone's inner edge." },
      { name: "Tau Ceti h", aAU: 0.243, radiusEarth: 1.91, periodDays: 49.4,  type: "Super-Earth, warm",                                         fact: "Warm super-Earth, near the inner edge of the habitable zone." },
      { name: "Tau Ceti e", aAU: 0.538, radiusEarth: 1.81, periodDays: 162.9, type: "Super-Earth, habitable zone", habitableZone: true,           fact: "In Tau Ceti's habitable zone. Confirmed by radial-velocity in 2017 — one of the closest unconfirmed-rocky planets to Earth." },
      { name: "Tau Ceti f", aAU: 1.334, radiusEarth: 1.83, periodDays: 636.1, type: "Super-Earth, outer habitable zone", habitableZone: true,     fact: "Sits near the outer habitable-zone edge — potentially cold but in a Mars-like temperature regime where a thick CO₂ atmosphere could support liquid water." },
    ],
  },
  {
    id: "hd-209458",
    name: "HD 209458",
    designation: "HD 209458 · Osiris's host",
    kind: "exoplanet-host",
    raHours: 22.052,
    decDeg: 18.88,
    magnitude: 7.65,
    distance: "159 ly",
    fact: "Host of HD 209458 b ('Osiris') — the first exoplanet observed transiting its star (1999), and the first found to have a detected atmosphere. Hot Jupiter at 0.047 AU; the atmosphere is evaporating into a comet-like tail.",
    visualSize: 0.5,
    planets: [
      { name: "HD 209458 b (Osiris)", aAU: 0.047, radiusEarth: 15.46, periodDays: 3.52, type: "Hot Jupiter — evaporating", fact: "Osiris — first exoplanet observed transiting (1999), first with a detected atmosphere (Hubble 2001), first found to be evaporating into a comet-like hydrogen tail. The transit method launched the modern era of exoplanet discovery." },
    ],
  },
  {
    id: "hr-8799",
    name: "HR 8799",
    designation: "HR 8799 · Four-planet direct image",
    kind: "exoplanet-host",
    raHours: 23.119,
    decDeg: 21.13,
    magnitude: 5.96,
    distance: "133 ly",
    fact: "First exoplanetary system ever directly imaged (2008) — four massive gas giants visible against the parent star. Subsequent observations have actually shown the planets moving along their orbits in time-lapse, the first photograph of another solar system in motion.",
    visualSize: 0.55,
    planets: [
      { name: "HR 8799 e", aAU: 14.5, radiusEarth: 12.0, periodDays: 17600,  type: "Gas giant (directly imaged)", fact: "Innermost directly-imaged planet. 5–7 Jupiter masses, ~1000 K — hot and young (~30 million years old)." },
      { name: "HR 8799 d", aAU: 24.0, radiusEarth: 12.4, periodDays: 39000,  type: "Gas giant (directly imaged)", fact: "~7 Jupiter-masses. Part of the four-planet directly-imaged system." },
      { name: "HR 8799 c", aAU: 38.0, radiusEarth: 12.5, periodDays: 79000,  type: "Gas giant (directly imaged)", fact: "~7 Jupiter-masses; methane and water detected in its atmosphere via direct spectroscopy." },
      { name: "HR 8799 b", aAU: 68.0, radiusEarth: 12.0, periodDays: 175000, type: "Gas giant (directly imaged)", fact: "Outermost. ~5 Jupiter-masses. Orbits beyond Pluto-distance from its star — first planet of the system directly imaged." },
    ],
  },
  {
    id: "55-cancri",
    name: "55 Cancri",
    designation: "55 Cnc · ρ¹ Cancri · Diamond planet host",
    kind: "exoplanet-host",
    raHours: 8.892,
    decDeg: 28.33,
    magnitude: 5.95,
    distance: "41 ly",
    fact: "Hosts five known planets including 55 Cancri e — a super-Earth so hot (2,400 K dayside) that early models suggested a carbon-rich composition with surface diamond. Later observations point to a lava-ocean world, but the diamond-planet nickname stuck.",
    visualSize: 0.55,
    planets: [
      { name: "55 Cnc e", aAU: 0.0154, radiusEarth: 1.88,  periodDays: 0.74,  type: "Super-Earth, lava world",   fact: "'Diamond planet' — 2,400 K dayside, possibly a lava ocean or a carbon-rich super-Earth. Orbits in just 18 hours." },
      { name: "55 Cnc b", aAU: 0.114,  radiusEarth: 13.4,  periodDays: 14.65, type: "Hot Jupiter",               fact: "Discovered 1996; one of the first Jupiter-mass exoplanets ever found. 4× more massive than Jupiter." },
      { name: "55 Cnc c", aAU: 0.241,  radiusEarth: 6.5,   periodDays: 44.34, type: "Warm Neptune",              fact: "Warm Neptune-mass — orbits inside the inner habitable-zone edge." },
      { name: "55 Cnc f", aAU: 0.781,  radiusEarth: 5.5,   periodDays: 261,   type: "Warm Neptune, habitable zone", habitableZone: true, fact: "Sits in 55 Cnc's habitable zone — likely a gas dwarf, not a rocky world, but if it has a large moon, that moon could be habitable." },
      { name: "55 Cnc d", aAU: 5.957,  radiusEarth: 12.0,  periodDays: 5285,  type: "Cold gas giant",            fact: "Outermost — a long-period Jupiter-analog at ~6 AU. The most 'Jupiter-like' exoplanet in the system." },
    ],
  },
  {
    id: "toi-700",
    name: "TOI-700",
    designation: "TOI-700 · first TESS habitable-zone Earth-size planet",
    kind: "exoplanet-host",
    raHours: 6.466,
    decDeg: -65.58,
    magnitude: 13.1,
    distance: "100 ly",
    fact: "Red dwarf hosting the first Earth-size planet TESS found in a habitable zone (TOI-700 d, January 2020). Later joined by TOI-700 e — a second Earth-sized planet just inside d's orbit. Both are in the habitable zone. Among the most accessible nearby systems for future atmospheric characterisation.",
    visualSize: 0.5,
    planets: [
      { name: "TOI-700 b", aAU: 0.0680, radiusEarth: 0.93, periodDays: 9.98,  type: "Rocky, hot",                                              fact: "Innermost. Earth-sized, far inside the habitable zone." },
      { name: "TOI-700 c", aAU: 0.0925, radiusEarth: 2.65, periodDays: 16.05, type: "Sub-Neptune",                                             fact: "Mini-Neptune in between the rocky worlds. ~2.5 Earth-radii." },
      { name: "TOI-700 d", aAU: 0.1633, radiusEarth: 1.05, periodDays: 37.43, type: "Earth-size, habitable zone", habitableZone: true, fact: "First Earth-sized HZ planet ever found by TESS (Jan 2020). Receives 86% of the energy Earth gets from the Sun." },
      { name: "TOI-700 e", aAU: 0.1340, radiusEarth: 0.95, periodDays: 27.81, type: "Earth-size, habitable zone", habitableZone: true, fact: "Discovered 2023; sits just inside TOI-700 d. Second Earth-sized HZ planet in the same system." },
    ],
  },
  {
    id: "k2-18",
    name: "K2-18",
    designation: "K2-18 · EMILY 1 host · JWST atmosphere candidate",
    kind: "exoplanet-host",
    raHours: 11.512,
    decDeg: 7.59,
    magnitude: 13.5,
    distance: "124 ly",
    fact: "Red dwarf hosting K2-18 b — a sub-Neptune in the habitable zone whose atmosphere JWST detected methane + carbon dioxide in (2023). Hint of dimethyl sulphide (a possible biosignature on Earth) tentatively reported — being followed up. One of the most intensely-studied potentially-habitable exoplanets right now.",
    visualSize: 0.5,
    planets: [
      { name: "K2-18 c", aAU: 0.0598, radiusEarth: 0.74, periodDays: 9.0,    type: "Sub-Earth, hot",                                fact: "Inner companion to K2-18 b. Too hot for liquid water on the surface." },
      { name: "K2-18 b", aAU: 0.143, radiusEarth: 2.61, periodDays: 32.94,   type: "Sub-Neptune, habitable zone", habitableZone: true, fact: "JWST detected methane + CO₂ in its atmosphere (Sep 2023) with a tentative hint of dimethyl sulphide — a possible biosignature on Earth. May be a 'Hycean' world with a hydrogen atmosphere over a liquid-water ocean." },
    ],
  },
  {
    id: "wasp-12",
    name: "WASP-12",
    designation: "WASP-12 · disintegrating-planet host",
    kind: "exoplanet-host",
    raHours: 6.508,
    decDeg: 29.67,
    magnitude: 11.7,
    distance: "1,410 ly",
    fact: "Yellow dwarf hosting WASP-12 b, a hot Jupiter so close to its star (0.023 AU) that its atmosphere is being shredded into a comet-like cloud trailing the planet. The host's tidal forces are dragging the planet inward — it'll be destroyed within ~10 million years.",
    visualSize: 0.5,
    planets: [
      { name: "WASP-12 b", aAU: 0.023, radiusEarth: 21.4, periodDays: 1.09, type: "Doomed hot Jupiter", fact: "1.5 Jupiter-masses, surface 2,800 K. Being torn apart — tidal forces drag the atmosphere off in a comet-like cloud, and the planet itself is spiralling inward; will be destroyed within ~10 million years." },
    ],
  },
  {
    id: "psr-b1257-12",
    name: "PSR B1257+12",
    designation: "Lich · first confirmed exoplanet host (1992)",
    kind: "exoplanet-host",
    raHours: 13.000,
    decDeg: 12.68,
    magnitude: 18.0,
    distance: "2,300 ly",
    fact: "Millisecond pulsar — a spinning neutron star, the dead core of a supernova. Hosts the first exoplanets ever confirmed (1992, three years before 51 Pegasi b), three rocky worlds orbiting through the lethal radiation of the pulsar. The planets are likely a second generation, formed from the debris of the supernova that birthed the pulsar.",
    visualSize: 0.55,
    planets: [
      { name: "Draugr (PSR B1257+12 A)", aAU: 0.19, radiusEarth: 0.5, periodDays: 25.26,  type: "Pulsar planet, sub-Mercury",         fact: "Innermost pulsar planet. Only ~0.02 Earth-masses — about the mass of the Moon. Named for an undead creature from Norse mythology." },
      { name: "Poltergeist (PSR B1257+12 B)", aAU: 0.36, radiusEarth: 1.2, periodDays: 66.5419, type: "Pulsar planet, super-Earth",     fact: "Discovered 1992 alongside Phobetor — the first two exoplanets ever confirmed. ~4.3 Earth-masses." },
      { name: "Phobetor (PSR B1257+12 C)", aAU: 0.46, radiusEarth: 1.4, periodDays: 98.2114, type: "Pulsar planet, super-Earth",       fact: "Outermost. ~3.9 Earth-masses. Like its siblings, blasted continuously by the pulsar's lethal beam of radiation." },
    ],
  },
  {
    id: "lhs-1140",
    name: "LHS 1140",
    designation: "LHS 1140 · habitable-zone super-Earth host",
    kind: "exoplanet-host",
    raHours: 0.713,
    decDeg: -15.27,
    magnitude: 14.2,
    distance: "49 ly",
    fact: "Red dwarf hosting LHS 1140 b — a super-Earth in the habitable zone, recently confirmed via JWST to have a steam atmosphere (water vapour over a possible ocean world). One of the most accessible targets for atmospheric biosignature searches in the 2020s.",
    visualSize: 0.5,
    planets: [
      { name: "LHS 1140 c", aAU: 0.027, radiusEarth: 1.28, periodDays: 3.78,  type: "Rocky, hot",                                          fact: "Inner super-Earth, too hot for surface liquid water." },
      { name: "LHS 1140 b", aAU: 0.0936, radiusEarth: 1.73, periodDays: 24.7, type: "Super-Earth, habitable zone", habitableZone: true, fact: "JWST 2024 hinted at water vapour in its atmosphere — possibly a 'Hycean' world or full ocean. Density consistent with ~10–20% water by mass. One of the strongest current candidates for liquid-water habitability." },
    ],
  },
  {
    id: "tabbys-star",
    name: "Tabby's Star",
    designation: "KIC 8462852 · Boyajian's Star",
    kind: "exoplanet-host",
    raHours: 20.107,
    decDeg: 44.45,
    magnitude: 11.7,
    distance: "1,470 ly",
    fact: "Famous for unprecedented and unexplained dimming events — drops of up to 22% over irregular intervals. Briefly suggested as a candidate for alien megastructures (a Dyson swarm); now most likely caused by an uneven dust ring or planetary debris. Still not fully understood.",
    visualSize: 0.5,
  },
  // ----- Famous individual stars — bright enough to be naked-eye
  // recognised, placed at real J2000 coordinates. Colours encode
  // spectral class (B blue, A white, F/G yellow, K orange, M red).
  // -----
  {
    id: "sirius",
    name: "Sirius",
    designation: "α Canis Majoris · brightest star in the night sky",
    kind: "star",
    raHours: 6.752,
    decDeg: -16.72,
    magnitude: -1.46,
    distance: "8.6 ly",
    fact: "Brightest star in Earth's night sky. A1V main-sequence star with a white-dwarf companion (Sirius B) discovered in 1862. Ancient Egyptians timed the Nile flood by Sirius's heliacal rising; the Romans called the hot late summer 'dog days' after it.",
    visualSize: 1.1,
    shade: "#e8f0ff",     // A-class blue-white
  },
  {
    id: "betelgeuse",
    name: "Betelgeuse",
    designation: "α Orionis · M-class red supergiant",
    kind: "star",
    raHours: 5.919,
    decDeg: 7.41,
    magnitude: 0.50,
    distance: "640 ly",
    fact: "Red supergiant in Orion. Pulsates between magnitude 0.0 and 1.6; dimmed dramatically in 2019–2020 (the 'Great Dimming') triggering supernova speculation. Will end its life as a supernova within ~100,000 years — close enough to outshine the full Moon when it does.",
    visualSize: 1.0,
    shade: "#ff7a3c",     // M-class red-orange
  },
  {
    id: "rigel",
    name: "Rigel",
    designation: "β Orionis · B-class blue supergiant",
    kind: "star",
    raHours: 5.242,
    decDeg: -8.20,
    magnitude: 0.13,
    distance: "860 ly",
    fact: "Brightest star in Orion (despite the β designation). Blue supergiant 120,000× more luminous than the Sun; will end as either a neutron star or a supernova. Part of a quadruple system — three of its companions are also blue stars.",
    visualSize: 0.95,
    shade: "#a8c8ff",     // B-class blue-white
  },
  {
    id: "vega",
    name: "Vega",
    designation: "α Lyrae · Summer Triangle anchor",
    kind: "star",
    raHours: 18.616,
    decDeg: 38.78,
    magnitude: 0.03,
    distance: "25 ly",
    fact: "Fifth-brightest star in the night sky. A0V main-sequence — the original photometric standard star (defined as magnitude 0 by definition until 1980). Surrounded by a debris disc that may host planets. Was the pole star ~12,000 BC and will be again ~13,727 AD.",
    visualSize: 1.0,
    shade: "#f0f4ff",     // A-class white
  },
  {
    id: "antares",
    name: "Antares",
    designation: "α Scorpii · heart of the Scorpion",
    kind: "star",
    raHours: 16.490,
    decDeg: -26.43,
    magnitude: 1.06,
    distance: "550 ly",
    fact: "Red supergiant ~700× the Sun's radius — if placed at the Sun's position, its surface would extend past Mars. Name means 'rival of Mars' in Greek; its colour is almost identical to the Red Planet's. Will go supernova within the next million years.",
    visualSize: 0.95,
    shade: "#ff6633",     // M-class red-orange
  },
  {
    id: "aldebaran",
    name: "Aldebaran",
    designation: "α Tauri · eye of the bull",
    kind: "star",
    raHours: 4.599,
    decDeg: 16.51,
    magnitude: 0.86,
    distance: "65 ly",
    fact: "Orange giant marking the eye of Taurus. Roughly 44× the Sun's radius. Pioneer 10, launched 1972, is heading toward Aldebaran's neighbourhood — flyby in ~2 million years.",
    visualSize: 0.85,
    shade: "#ff9d4a",     // K-class orange
  },
  {
    id: "vy-cma",
    name: "VY Canis Majoris",
    designation: "VY CMa · M-class hypergiant, one of the largest known stars",
    kind: "star",
    raHours: 7.380,
    decDeg: -25.77,
    magnitude: 8.0,
    distance: "3,820 ly",
    fact: "One of the largest known stars — ~1,420× the Sun's radius. If placed where the Sun is, it would extend past Saturn's orbit. Variable red hypergiant in its death throes; expected to collapse directly to a black hole rather than supernova within a few hundred thousand years.",
    visualSize: 0.8,
    shade: "#e85522",     // M-class deep red
  },
  {
    id: "eta-carinae",
    name: "Eta Carinae",
    designation: "η Car · luminous blue variable, supernova candidate",
    kind: "star",
    raHours: 10.751,
    decDeg: -59.69,
    magnitude: 4.5,
    distance: "7,500 ly",
    fact: "Massive binary system with the primary star ~100× the Sun's mass. Underwent the 'Great Eruption' in 1843 — briefly the second-brightest star in the sky despite its distance, ejecting the bipolar Homunculus Nebula seen around it today. Considered the closest plausible supernova candidate in the next million years.",
    visualSize: 0.9,
    shade: "#b0c8ff",     // luminous blue
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
    id: "phoenix-a",
    name: "Phoenix A*",
    designation: "Phoenix A · ~100 billion M☉ ultramassive",
    kind: "black-hole",
    raHours: 23.722,
    decDeg: -42.72,
    distance: "5.7 billion ly",
    fact: "Possibly the largest known black hole in the universe — ~100 billion solar masses, measured 2023. Sits at the centre of the Phoenix Cluster's central galaxy, surrounded by the most extreme star-forming region in any known central cluster galaxy. Just below the theoretical upper-mass limit for stable accretion.",
    visualSize: 2.4,
    massSolar: 1.0e11,
    spin: 0.9,
    jet: { axis: "y", lengthFactor: 18, brightness: 0.6, asymmetry: 0.55, color: "#e0ecff" },
  },
  {
    id: "oj-287",
    name: "OJ 287",
    designation: "OJ 287 · 18 + 0.15 billion M☉ binary",
    kind: "black-hole",
    raHours: 8.918,
    decDeg: 20.11,
    distance: "5 billion ly",
    fact: "Best-known supermassive binary black hole. The primary (18 billion M☉) hosts an accretion disk; a secondary BH (~150 million M☉) plunges through that disk twice every ~12-year orbit, producing predictable optical flare bursts. Each flare confirms general relativity to higher precision.",
    visualSize: 1.7,
    massSolar: 1.8e10,
    spin: 0.95,
    jet: { axis: "y", lengthFactor: 15, brightness: 0.65, asymmetry: 0.6, color: "#c8d8ff" },
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
