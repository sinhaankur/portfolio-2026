/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine — see ./index.tsx for the full notice.
 * https://github.com/sinhaankur/portfolio-2026/blob/main/LICENSE
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
  /** Real atmospheric composition, sourced (NASA) — e.g. "96.5% CO₂, 3.5% N₂".
   *  "None (exosphere)" for airless bodies. */
  atmosphere?: string
  /** Real bulk/interior composition — e.g. "Iron core, silicate mantle" or
   *  "Hydrogen + helium, metallic-hydrogen interior". */
  composition?: string
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
  /** Front-facing gravity readout used for planets, black holes, and small bodies. */
  gravityMeasurement?: {
    label: string
    value?: number
    unit?: string
    note?: string
  }
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
  /** Star-specific: apparent magnitude (V-band). */
  apparentMag?: number
  /** Star-specific: distance from the Sun in light-years. */
  distanceLy?: number
  /** Star-specific: spectral type (e.g. "A0V", "M2Ib"). */
  spectralType?: string
  /** Star-specific: catalog designations (HR, HD, Hipparcos, etc.). */
  catalogDesignation?: string
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
  /** Legacy arbitrary phase offset (radians). Used only as a fallback when
   *  m0Deg is absent — kept so non-anchored bodies still render plausibly. */
  startPhase: number
  /** Mean anomaly at the J2000.0 epoch (degrees), from JPL mean orbital
   *  elements. When present, the body's position becomes a true function of
   *  the simulation date: M(t) = m0 + 2π·(daysSinceJ2000 / periodDays).
   *  This is what makes the timeline date-accurate and scrubbable. */
  m0Deg?: number
  /** Longitude of perihelion at J2000 (degrees), ϖ = Ω + ω. Orients the
   *  apsidal line of eccentric orbits so perihelion points the real way.
   *  Combined with m0Deg + eccentricity this fixes both where the body is
   *  AND which direction it's heading on its ellipse. */
  periDeg?: number
  /** Longitude of the ascending node Ω at J2000 (degrees), from JPL mean
   *  orbital elements. The last element needed to fully orient the orbit
   *  plane in 3D — with i, ϖ and M₀ it yields a rigorous heliocentric
   *  position (and, differenced against Earth, a real geocentric RA/Dec
   *  for the "Tonight's Sky" companion). */
  longNodeDeg?: number
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
  /** Higher-res night-lights map, swapped in on the desktop deep-zoom explorer
   *  (same perf-budget gating as hiResTextureUrl) so city lights resolve into
   *  individual cities up close. Earth = 8K Black Marble. */
  hiResNightTextureUrl?: string
  /** KTX2 (GPU-compressed) night map — preferred over hiResNightTextureUrl when
   *  present, for the same no-decode / low-VRAM win as ktx2TextureUrl. */
  ktx2NightTextureUrl?: string
  /** Max-res night map on the CDN, Super Clear only (Earth = full Black Marble). */
  superClearNightTextureUrl?: string
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
  /** Clean polar-cap colour to fade the top/bottom texture rows toward, when the
   *  equirectangular map streaks at the poles (Mars). Absent = no polar fix. */
  polarTint?: string
  /** Optional high-resolution (4K) surface map, used on DESKTOP only. Mobile
   *  keeps the lighter `textureUrl` (2K) to honour the perf/texture budget —
   *  phones can't resolve 4K and shouldn't pay to download it. Absent = the
   *  base textureUrl is used everywhere. */
  hiResTextureUrl?: string
  /** Optional KTX2 (GPU-compressed, Basis ETC1S) version of the hi-res map.
   *  Preferred over hiResTextureUrl when present: uploads to the GPU with NO
   *  decode stall and ~1/8 the VRAM. Same desktop/tier gating. Decoded via the
   *  self-hosted Basis transcoder (public/basis/). */
  ktx2TextureUrl?: string
  /** Path (within the asset CDN) to a MAX-res map (e.g. 16K), used ONLY in Super
   *  Clear mode. Resolved via cdnAsset() with hiResTextureUrl as the local
   *  fallback, so the site never depends on the CDN to render. */
  superClearTextureUrl?: string
  /** Grayscale elevation/height map (e.g. Mars MOLA) that displaces the surface
   *  mesh for real terrain relief on deep-zoom. Absent = flat sphere. */
  elevationUrl?: string
  /** How far to push the relief along the normal (in visual-radius units).
   *  Small — enough to read Olympus Mons / Valles Marineris without shattering
   *  the mesh. Defaults to a gentle value when elevationUrl is set. */
  elevationScale?: number
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
  /** Optional 4K surface map, desktop-only (mobile keeps the 2K textureUrl).
   *  Same perf-budget gating as planets — see Planet.hiResTextureUrl. */
  hiResTextureUrl?: string
  /** KTX2 (GPU-compressed) hi-res map — preferred over hiResTextureUrl (no decode
   *  stall, ~1/8 VRAM). See Planet.ktx2TextureUrl. */
  ktx2TextureUrl?: string
  /** Max-res (16K) CDN map, Super Clear only — see Planet.superClearTextureUrl. */
  superClearTextureUrl?: string
  /** Grayscale elevation/height map (e.g. lunar LOLA) that displaces the moon's
   *  surface mesh for real terrain relief on deep-zoom. Absent = smooth sphere. */
  elevationUrl?: string
  /** Displacement scale along the normal (visual-radius units). Defaults gentle. */
  elevationScale?: number
  /** Surface landing sites / named features — same shape as planet
   *  features so the Moon can carry Apollo landing sites etc. */
  surfaceFeatures?: SurfaceFeature[]
  /** Real physical data (NASA) surfaced in the InfoPanel "Made of" + metrics —
   *  same shape planets use, so moons read with the same exactness. */
  deep?: BodyDeepFacts
}

export type ConstellationStar = {
  name: string
  designation: string
  raHours: number
  decDeg: number
  magnitude: number
}

/**
 * Constellation ID — was a closed union of the 7 originally
 * hand-curated entries. Widened to `string` so the engine can
 * carry all 88 IAU constellations generated from
 * lib/data/constellations-iau.ts (`pnpm data:constellations`).
 * The hand-curated subset still uses the same kebab-case form
 * ("ursa-major", "orion", etc.); generated entries use the
 * lowercase 3-letter IAU code ("and", "lyr", "uma", …).
 */
export type ConstellationId = string

export type Constellation = {
  id: ConstellationId
  /** IAU 3-letter code (e.g. "And", "Ori"). Present on the 88 generated
   *  entries; the 7 hand-curated originals omit it. */
  iauCode?: string
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
  /** ISO date (UTC) of a known perihelion passage — the true epoch anchor
   *  for a periodic body. When present, mean anomaly becomes a real
   *  function of date: M(t) = 2π·((simMs − perihelionMs) / periodMs), which
   *  is 0 at perihelion. This is what makes "jump to Halley's 2061
   *  perihelion" actually put the comet at perihelion. Without it the body
   *  falls back to the approximate startPhase offset. */
  perihelionTT?: string
  /** 0–1 phase along the orbit at scene start (jitters body positions). */
  startPhase: number
  /** Short fact shown in the info panel. */
  fact: string
  /** Real mean diameter in km (NASA/JPL). When present, the render size is
   *  derived from this via a compressed-but-truthful curve, so relative sizes
   *  reflect reality (Ceres visibly dwarfs a sub-km NEO) rather than a flat
   *  default. Absent = falls back to visualRadius / the 0.05 default. */
  diameterKm?: number
  /** Visual sphere radius in scene units (default 0.05). Overridden by the
   *  diameterKm-derived size when that's present. */
  visualRadius?: number
  /** Optional hex colour override. Defaults derived from `kind`. */
  shade?: string
  /** Optional equirectangular surface map (in /public/textures). When present
   *  the body renders a properly-lit textured sphere instead of a plain glowing
   *  ball — used for dwarf planets we have real maps for (Pluto = New Horizons).
   *  Absent = procedural surface. */
  textureUrl?: string
  /** Triaxial shape (a:b:c relative radii) for irregular bodies. Real asteroids
   *  are rarely round — Eros is a 34×11×11 km peanut, Apophis is elongated, Ida
   *  is a lumpy 60×25×19 shard. When set, the rock is scaled non-uniformly so
   *  its silhouette matches the real body instead of a generic ball. Default
   *  [1,1,1] (round). Values are normalised, only the ratio matters. */
  triaxial?: [number, number, number]
  /** Real physical data (NASA) — composition/atmosphere surfaced in the
   *  InfoPanel "Made of" section, same as planets + moons. */
  deep?: BodyDeepFacts
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
   * Galaxy morphology — the raw Hubble type string from OpenNGC ("Sb",
   * "SBbc", "E2", "S0", "IB(s)m"…). Drives the procedural galaxy model
   * (spiral / barred / elliptical / lenticular / irregular). Absent when
   * OpenNGC has no classification — the renderer then keeps the plain halo
   * rather than inventing a shape.
   */
  morphology?: string
  /** Apparent minor/major axis ratio (0–1) — cos-inclination proxy for discs. */
  axisRatio?: number
  /** On-sky position angle of the major axis, degrees E of N (OpenNGC). */
  posAngDeg?: number
  /**
   * Nebula sub-type from the OpenNGC object class — drives per-type
   * procedural rendering (planetary shell, SNR filaments, red emission
   * cloud, blue reflection wisps, dark silhouette).
   */
  nebulaType?: "planetary" | "snr" | "emission" | "reflection" | "dark"
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
