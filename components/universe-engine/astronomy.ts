/**
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

export const DEG = Math.PI / 180

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
  { name: "Mercury", aAU: 0.387, radiusEarth: 0.383, periodDays: 87.97,   tiltDeg: 0.03,   rotHours: 1407.6, inclDeg: 7.005, startPhase: 0.0, shade: "#7a7a7a", surfaceTempK: { min: 100, mean: 440, max: 700 }, classification: "Terrestrial planet", moons: 0, fact: "No atmosphere. Day side 700 K, night side 100 K — biggest swing in the solar system. A year on Mercury is just 88 Earth days; a single day is 176 Earth days. Two years pass for every day.", textureUrl: "/textures/mercury.jpg" },
  { name: "Venus",   aAU: 0.723, radiusEarth: 0.949, periodDays: 224.70,  tiltDeg: 177.4,  rotHours: -5832.5, inclDeg: 3.395, startPhase: 2.1, shade: "#bdbdbd", surfaceTempK: { mean: 737 }, classification: "Terrestrial planet (retrograde)", moons: 0, fact: "Hottest surface — 737 K — runaway CO₂ greenhouse. Rotates backwards on a 243-day day. The 177° axial tilt means Venus is technically upside-down relative to the rest of the planets.", textureUrl: "/textures/venus.jpg" },
  { name: "Earth",   aAU: 1.000, radiusEarth: 1.000, periodDays: 365.25,  tiltDeg: 23.44,  rotHours: 23.93,  inclDeg: 0.000, startPhase: 4.5, shade: "#dcdcdc", surfaceTempK: { min: 184, mean: 288, max: 330 }, classification: "Terrestrial planet — life", moons: 1, fact: "Mean surface 288 K. Only known planet with liquid water and life.", textureUrl: "/textures/earth.jpg" },
  { name: "Mars",    aAU: 1.524, radiusEarth: 0.532, periodDays: 686.97,  tiltDeg: 25.19,  rotHours: 24.62,  inclDeg: 1.850, startPhase: 1.3, shade: "#c1623a", surfaceTempK: { min: 130, mean: 210, max: 308 }, classification: "Terrestrial planet", moons: 2, fact: "Thin CO₂ atmosphere, polar ice caps, evidence of ancient liquid water. Hosts the solar system's tallest mountain (Olympus Mons, 22 km) and longest canyon (Valles Marineris, 4,000 km). The 25° axial tilt gives Mars Earth-like seasons.", textureUrl: "/textures/mars.jpg" },
  { name: "Jupiter", aAU: 5.203, radiusEarth: 11.21, periodDays: 4332.59, tiltDeg: 3.13,   rotHours: 9.92,   inclDeg: 1.303, startPhase: 5.8, shade: "#cfcfcf", surfaceTempK: { mean: 165 }, classification: "Gas giant", moons: 95, fact: "Largest planet. 10-hour day. Great Red Spot is a storm wider than Earth.", textureUrl: "/textures/jupiter.jpg" },
  { name: "Saturn",  aAU: 9.537, radiusEarth: 9.449, periodDays: 10759.22,tiltDeg: 26.73,  rotHours: 10.66,  inclDeg: 2.485, startPhase: 3.2, shade: "#bababa", surfaceTempK: { mean: 134 }, classification: "Gas giant", moons: 146, fact: "Ring system spans 282,000 km but is only ~10 m thick.", hasRings: true, textureUrl: "/textures/saturn.jpg" },
  { name: "Uranus",  aAU: 19.19, radiusEarth: 4.007, periodDays: 30688.50,tiltDeg: 97.77,  rotHours: -17.24, inclDeg: 0.773, startPhase: 0.7, shade: "#a5dad0", surfaceTempK: { mean: 76 }, classification: "Ice giant (sideways)", moons: 28, fact: "Rotates on its side at 98° tilt — likely from an ancient collision. Each pole experiences 42 years of sunlight followed by 42 years of darkness. Surface methane gives it that pale blue-green colour.", textureUrl: "/textures/uranus.jpg" },
  { name: "Neptune", aAU: 30.07, radiusEarth: 3.883, periodDays: 60182.00,tiltDeg: 28.32,  rotHours: 16.11,  inclDeg: 1.770, startPhase: 2.9, shade: "#4a6db8", surfaceTempK: { mean: 72 }, classification: "Ice giant", moons: 16, fact: "Coldest planet. Fastest winds in the solar system — 2,100 km/h supersonic gales. 165-year orbit means it has completed only one orbit since its discovery in 1846.", textureUrl: "/textures/neptune.jpg" },
  // Pluto — reclassified to dwarf planet in 2006 but still part of the family.
  // 17.16° inclination really does tilt its ring above the ecliptic — Pluto
  // crosses inside Neptune's orbit for ~20 years every 248-year orbit.
  { name: "Pluto",   aAU: 39.48, radiusEarth: 0.186, periodDays: 90560.00,tiltDeg: 122.5,  rotHours: -153.3, inclDeg: 17.16, startPhase: 4.1, shade: "#a07b54", surfaceTempK: { min: 33, mean: 44, max: 55 }, classification: "Dwarf planet · Kuiper Belt", moons: 5, fact: "Reclassified from planet to dwarf planet in 2006. 17° orbital inclination lifts it above the ecliptic. Charon is so massive (12% of Pluto's mass) they orbit a barycentre outside Pluto's surface — effectively a binary system. The famous heart-shaped Tombaugh Regio was photographed by New Horizons in 2015." },
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
  }
}

/* --------------------------------------------------------------------------
 * Moons (real data)
 * ------------------------------------------------------------------------ */

export const moons: MoonData[] = [
  { name: "Moon (Luna)",     parent: "Earth",   visualRadius: 0.05,  orbitRadius: 0.42, periodDays: 27.32,  shade: "#bdbdbd", fact: "Earth's only natural satellite. Surface temp −173 to +127 °C. Tidally locked — same face always toward Earth." },
  { name: "Io",              parent: "Jupiter", visualRadius: 0.05,  orbitRadius: 0.95, periodDays: 1.77,   shade: "#cfcfcf", fact: "Most volcanically active body in the solar system — 400+ active volcanoes from tidal heating from Jupiter." },
  { name: "Europa",          parent: "Jupiter", visualRadius: 0.045, orbitRadius: 1.15, periodDays: 3.55,   shade: "#dcdcdc", fact: "Icy crust over a subsurface ocean. One of the best candidates for life beyond Earth." },
  { name: "Ganymede",        parent: "Jupiter", visualRadius: 0.07,  orbitRadius: 1.40, periodDays: 7.15,   shade: "#bababa", fact: "Largest moon in the solar system — bigger than Mercury. Has its own magnetic field." },
  { name: "Callisto",        parent: "Jupiter", visualRadius: 0.065, orbitRadius: 1.75, periodDays: 16.69,  shade: "#9a9a9a", fact: "Most heavily cratered body known. Outermost Galilean moon — sees least of Jupiter's radiation." },
  { name: "Titan",           parent: "Saturn",  visualRadius: 0.08,  orbitRadius: 1.85, periodDays: 15.95,  shade: "#d6c98c", fact: "Saturn's largest moon — bigger than Mercury. Only moon with a thick atmosphere (nitrogen + methane). Has lakes of liquid methane." },
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
]
