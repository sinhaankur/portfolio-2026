/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/Portfolio/blob/main/LICENSE
 *
 * Universe Engine — public types.
 *
 * Anything a consumer of <UniverseEngine /> might need to read or pass through
 * the hover/info pipeline lives here. R3F-internal types (ScenePlanet etc.)
 * also live here so the data + scene files stay decoupled.
 */

/** A landing site or named feature pinned to a planet's surface — e.g.
 *  Mars rover landing sites or major geographic landmarks. Pinned at real
 *  lat / lon, rotates with the planet so the pin stays attached to the
 *  right spot. */
export type SurfaceFeature = {
  name: string
  /** Latitude in degrees, -90 (south pole) to +90 (north pole). */
  lat: number
  /** Longitude in degrees, 0–360 east-positive (planetographic convention). */
  lon: number
  /** Mission date or "—" / "natural" for geographic features. */
  date: string
  /** For missions: mission status. For naturals: always "natural" — drives
   *  pin colour + visual treatment (dot vs outline ring). */
  status: "active" | "completed" | "lost" | "natural"
  /** Agency / nation for missions; "—" for naturals. */
  agency: string
  /** Short fact for the hover label tooltip. */
  fact: string
}

/** Deeper per-body data sourced from NASA Planetary Fact Sheet. Surfaced
 *  via the InfoPanel's "More" disclosure so the default panel stays light
 *  but curious readers can pull up mass / density / gravity / etc. */
export type BodyDeepFacts = {
  /** Mass expressed in Earth-masses (Earth = 1). */
  massEarth?: number
  /** Mean density in g/cm³. */
  densityGcc?: number
  /** Surface (or 1-bar level, for gas giants) gravity in m/s². */
  gravity?: number
  /** Escape velocity in km/s. */
  escapeVelocityKms?: number
  /** Orbital eccentricity (0 = circle, 1 = parabola). */
  eccentricity?: number
  /** Year of formal discovery — present for outer planets + dwarf planets;
   *  omitted for the inner planets known since prehistory. */
  discoveredYear?: number
  /** Discoverer credit (e.g. "Herschel, 1781") — short label, not a full citation. */
  discoveredBy?: string
}

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
  /** Deeper NASA-sourced facts — surfaced behind a "More" disclosure. */
  deep?: BodyDeepFacts
  /** Orbital elements for spacecraft / comets / asteroids — surfaced in
   *  the InfoPanel when present. Lets curious users see the actual
   *  inclination / eccentricity / Ω / ω that drive the trajectory. */
  orbital?: {
    eccentricity?: number
    inclDeg?: number
    longNodeDeg?: number
    argPeriDeg?: number
    /** Snapshot date for the orbital elements (active spacecraft drift
     *  with every maneuver). Format "YYYY-MM" or similar. */
    elementsEpoch?: string
  }
  /** True if the body responds to a click (e.g. Polaris resets the view). */
  clickable?: boolean
  /** True if clicking the body engages follow mode (camera tracks it along
   *  its orbit). Surfaces a hint in the InfoPanel so the gesture is
   *  discoverable for fast-moving bodies like comets + spacecraft. */
  followable?: boolean
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
  /** Optional equirectangular city-lights / night-side texture URL. When
   *  set alongside textureUrl, the planet renders through a custom shader
   *  that blends day texture on the lit side and night texture on the
   *  shadow side, with a smoothed terminator. Currently only Earth uses
   *  this (Black Marble night-lights composite). */
  nightTextureUrl?: string
  /** When true, the planet uses the day/night shader even without a
   *  night texture — the shadow side falls to ambient dark. Lets
   *  airless / thin-atmosphere bodies (Mercury, Mars) show a real
   *  terminator instead of soft PBR ambient. Width of the terminator
   *  blend is controlled by terminatorSoftness. */
  useDayNight?: boolean
  /** Terminator width: 0.04 for airless bodies (Mercury, Moon), 0.1 for
   *  thin atmospheres (Mars), 0.18 for thick atmospheres (Earth, Venus).
   *  Only used when nightTextureUrl or useDayNight is set. */
  terminatorSoftness?: number
  /** Override the formula-derived visual radius. Useful for dwarf planets
   *  whose real radius (Pluto = 0.186 Earth-radii) would render as a
   *  pinprick that's impossible to find from the inner-system view. */
  visualRadiusOverride?: number
  /** Deeper NASA Planetary Fact Sheet data — surfaced via InfoPanel disclosure. */
  deep?: BodyDeepFacts
  /** Surface landing sites — e.g. Mars rovers. Renders as small pins on the
   *  planet's surface, rotating with the body. */
  surfaceFeatures?: SurfaceFeature[]
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

/** Same data structure as planetary moons — separated only so the renderer
 *  knows which parent body each one orbits. */
export type MoonData = {
  name: string
  parent: "Earth" | "Mars" | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  visualRadius: number
  orbitRadius: number
  periodDays: number
  shade: string
  fact: string
  /** Optional equirectangular surface texture URL — used for Luna so the
   *  tidally-locked near-side reads on Earth deep-zoom. Loaded lazily when
   *  the parent planet enters its focused/hovered state. */
  textureUrl?: string
  /** Surface landing sites / named features — same shape as planet
   *  features so the Moon can carry Apollo landing sites etc. */
  surfaceFeatures?: SurfaceFeature[]
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
  /** Longitude of ascending node (Ω), degrees, measured from vernal equinox.
   *  Together with inclDeg, fully orients the orbital plane in 3D space.
   *  Without it, the body's escape direction (Voyagers etc.) doesn't point
   *  toward the right constellation. Default 0 for bodies where we don't
   *  care about exact sky direction (most comets / asteroids). */
  longNodeDeg?: number
  /** Argument of periapsis (ω), degrees, measured in the orbital plane from
   *  the ascending node to the perihelion. Sets which direction perihelion
   *  points within the orbital plane. Default 0. */
  argPeriDeg?: number
  /** Snapshot date for the orbital elements above, when they drift with
   *  every maneuver (active spacecraft cruising with gravity assists).
   *  Format "YYYY-MM" or similar. Omit for stable trajectories (planets,
   *  long-period comets, escape-trajectory probes). */
  elementsEpoch?: string
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
  kind: "galaxy" | "nebula" | "cluster" | "exoplanet-host" | "black-hole" | "star"
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
  /**
   * Mass in solar masses (M☉). Currently only used by black-hole points —
   * feeds the Schwarzschild-radius calculation that drives the per-BH
   * visualisation scale + the physics readout overlay.
   */
  massSolar?: number
  /**
   * Optional spin parameter (Kerr `a`, dimensionless, 0–1). Affects ISCO
   * for the accretion disk's inner edge. Defaults to 0 (Schwarzschild)
   * when omitted; supermassive BHs are typically near-extremal (~0.9).
   */
  spin?: number
  /**
   * Optional colour override (hex). Currently used for individual stars
   * so spectral class drives the visible colour (blue O/B, white A,
   * yellow F/G, orange K, red M).
   */
  shade?: string
  /**
   * Optional exoplanet system — child worlds rendered around an
   * exoplanet-host star when focused. Each one is a tiny dot at its
   * orbital distance (heavily scene-scale-compressed). Real orbital
   * periods drive animation; real lit/shadow if the host has a Sun.
   */
  planets?: Array<{
    name: string
    /** Orbit semi-major axis in AU. */
    aAU: number
    /** Planet radius in Earth-radii. Drives the rendered dot size. */
    radiusEarth: number
    /** Orbital period in Earth days. */
    periodDays: number
    /** Surface description: rocky / gas / ice etc. Shows in tooltip. */
    type: string
    /** Whether the planet lies in the host's habitable zone. */
    habitableZone?: boolean
    /** Short fact for the tooltip. */
    fact: string
  }>
  /**
   * Bipolar relativistic jet config. Many real black holes (M87*, Cygnus X-1,
   * Sgr A*, AGN cores) eject collimated jets perpendicular to their accretion
   * disk along the spin axis. Setting this renders two emissive cones from
   * the horizon outward inside <BlackHoleDetail>.
   */
  jet?: {
    /**
     * Local axis (in the rendered model's own frame) the jet emerges along.
     * Default "y" because the Sketchfab mesh's disk sits in xz with y up.
     * If the visual ends up sideways after first deploy, flip to "x" or "z".
     */
    axis?: "x" | "y" | "z"
    /**
     * Length factor relative to the BH's computed detailScale. ~12 puts the
     * jet tip well beyond the disk's visible extent.
     */
    lengthFactor?: number
    /** Bright side opacity 0–1 (Doppler-beamed near side). Default 0.55. */
    brightness?: number
    /** Asymmetry 0–1: 0 = symmetric, 1 = far side fully suppressed. Default 0.6. */
    asymmetry?: number
    /** CSS hex colour for the jet. Default `#bcd9ff` (synchrotron blue-white). */
    color?: string
  }
}
