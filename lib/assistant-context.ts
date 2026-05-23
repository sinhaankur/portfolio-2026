/**
 * Assistant context — system prompt + condensed dataset injection.
 *
 * The full namedBodies + skyPoints + planetsData arrays are several
 * hundred KB if dumped raw. We condense them here into a structured
 * digest that's:
 *   - Small enough to inject as system context every request (~30KB)
 *   - Stable byte-for-byte across requests (so prompt caching hits)
 *   - Sufficient for the model to answer questions without hallucinating
 *
 * The dataset is the *contract* between the model and the engine —
 * it must only act on bodies the engine actually knows about.
 */

import {
  buildScenePlanets,
  constellations,
  namedBodies,
  planetsData,
  skyPoints,
} from "@/components/universe-engine/astronomy"
import { EXOPLANET_HOSTS_NEARBY } from "@/lib/data/exoplanet-hosts"

/* ------------------------------------------------------------------
 * Condensed body shapes — what we send to the model.
 *
 * We deliberately strip rendering-only fields (visualRadius, shade,
 * textureUrl, surfaceFeatures with pin geometry, etc.) and keep the
 * astronomically meaningful values. This keeps the dataset small AND
 * forces the model to ground answers in real data — if it wants to
 * talk about Halley's eccentricity, the value's right there.
 * ------------------------------------------------------------------ */

type CondensedPlanet = {
  name: string
  aAU: number
  radiusEarth: number
  periodDays: number
  inclDeg: number
  classification: string
  moons: number
  fact?: string
}

type CondensedNamedBody = {
  name: string
  designation: string
  kind: string
  aAU: number
  eccentricity: number
  inclDeg: number
  periodYears: number
  fact: string
}

type CondensedSkyPoint = {
  id: string
  name: string
  designation: string
  kind: string
  distance?: string
  fact?: string
}

type CondensedExoplanetHost = {
  name: string
  spectralType: string | null
  distance: string
  magnitude: number | null
  knownPlanets: number
  firstDiscoveryYear: number | null
  hasHabitableCandidate: boolean
  fact: string
}

type CondensedConstellation = {
  id: string
  name: string
  designation: string
  numStars: number
  fact: string
}

export type CondensedDataset = {
  planets: CondensedPlanet[]
  namedBodies: CondensedNamedBody[]
  skyPoints: CondensedSkyPoint[]
  constellations: CondensedConstellation[]
  /** Confirmed exoplanet host stars within 50 ly (NASA Exoplanet
   *  Archive). Surfaced to the assistant so it can answer about
   *  WASP-12, GJ 1214, K2-18, Trappist-1 etc. without needing the
   *  visitor to know the catalog name in advance. Not all of these
   *  are rendered on the sky shell — the curated `skyPoints` subset
   *  is the visual layer; this list is the lookup table. */
  nearbyExoplanetHosts: CondensedExoplanetHost[]
}

/**
 * Build the condensed dataset. Pure function — same input data, same
 * output bytes, so the JSON serialisation is cache-stable.
 */
export function buildDataset(): CondensedDataset {
  const planets: CondensedPlanet[] = planetsData.map((p) => ({
    name: p.name,
    aAU: p.aAU,
    radiusEarth: p.radiusEarth,
    periodDays: p.periodDays,
    inclDeg: p.inclDeg,
    classification: p.classification,
    moons: p.moons,
    fact: p.fact,
  }))

  const namedBodyList: CondensedNamedBody[] = namedBodies.map((b) => ({
    name: b.name,
    designation: b.designation,
    kind: b.kind,
    aAU: b.aAU,
    eccentricity: b.eccentricity,
    inclDeg: b.inclDeg,
    periodYears: isFinite(b.periodYears) ? b.periodYears : Number.POSITIVE_INFINITY,
    fact: b.fact,
  }))

  const skyPointList: CondensedSkyPoint[] = skyPoints.map((s) => ({
    id: s.id,
    name: s.name,
    designation: s.designation,
    kind: s.kind,
    distance: s.distance,
    fact: s.fact,
  }))

  const constellationList: CondensedConstellation[] = constellations.map((c) => ({
    id: c.id,
    name: c.name,
    designation: c.designation,
    numStars: c.stars.length,
    fact: c.fact,
  }))

  // Exoplanet hosts: deduped against the curated `skyPoints` entries
  // (where curated lookalikes carry richer per-planet fact text). We
  // keep the fetched list small + scoped to the unique-to-fetch
  // entries plus full coverage of catalog IDs the curated set may
  // not include (Kepler-* numerics, K2-*, TOI-*, etc.).
  const curatedHostNames = new Set(
    skyPoints
      .filter((s) => s.kind === "exoplanet-host")
      .map((s) => s.name.toLowerCase().trim()),
  )
  const nearbyExoplanetHosts: CondensedExoplanetHost[] = EXOPLANET_HOSTS_NEARBY
    .filter((h) => !curatedHostNames.has(h.name.toLowerCase().trim()))
    .map((h) => ({
      name: h.name,
      spectralType: h.spectralType,
      distance: h.distance,
      magnitude: h.magnitude,
      knownPlanets: h.knownPlanets,
      firstDiscoveryYear: h.firstDiscoveryYear,
      hasHabitableCandidate: h.hasHabitableCandidate,
      fact: h.fact,
    }))

  return {
    planets,
    namedBodies: namedBodyList,
    skyPoints: skyPointList,
    constellations: constellationList,
    nearbyExoplanetHosts,
  }
}

/* ------------------------------------------------------------------
 * System prompt.
 *
 * Sets the assistant's stance, lists the tools by category, names the
 * dataset constraints, and embeds the condensed dataset as the
 * single source of truth.
 *
 * Stable across requests — written once at module load, baked into
 * the system prompt with `cache_control: ephemeral` so every call
 * after the first reads it from the prompt cache (~90% cheaper).
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT_HEADER = `You are the Universe Engine Assistant — a natural-language guide to a real-astronomy 3D solar system simulation built by Ankur Sinha. Visitors explore the engine through conversation with you.

## What you know about

- 30+ named small bodies (comets, asteroids, spacecraft, interstellars, dwarf planets) — Kepler orbits, real elements
- 8 planets + the Sun
- 7 hand-curated constellations projected from real J2000 coordinates
- ~60 hand-curated deep-sky objects (galaxies, nebulae, exoplanet hosts, stars) with rich per-body facts
- 100+ additional confirmed exoplanet host stars within 50 light-years from the NASA Exoplanet Archive — Kepler-*, K2-*, TOI-*, GJ *, HD *, WASP-*, all addressable by name via getBodyDetails or flyToBody

## Your stance

Reverent over theatrical. The engine models real astronomical state at the current epoch (May 2026). Don't invent collisions, manufacture drama, or describe events that don't actually happen. The Universe Engine's litmus test is fidelity, not spectacle — yours is the same.

Action-oriented. When a visitor asks "show me X", call \`flyToBody\` — don't just describe what they'd see. When they ask "when does Halley return", call \`getOrbitalState\` for the real number.

Grounded. Every astronomical fact you state must trace back to the dataset injected below. If a body isn't in the dataset, say so — don't make up a position or fact for it.

Concise. The simulation is the primary medium; you're the operator at the panel, not the lecturer. Two to four sentences per answer is usually the right length. Use markdown sparingly — no headers, no bullet-list overuse.

## Your tools

Read tools (look things up without changing the scene):
- \`listBodies(kind?)\` — list all named bodies, optionally filtered by kind ("comet", "asteroid", "interstellar", "spacecraft", "dwarf")
- \`getBodyDetails(name)\` — full data for one body
- \`getBodyPosition(name)\` — current heliocentric position of a body
- \`findBodiesNear(reference, radiusAU)\` — other bodies within radiusAU of the reference
- \`getOrbitalState(name)\` — Kepler elements + derived perihelion / aphelion
- \`listExoplanetHosts()\` — stars in the dataset that host known exoplanets
- \`listConstellations()\` — the 7 constellations projected from J2000 coordinates
- \`getCurrentSimDate()\` — what date the simulation is currently showing

Action tools (change the scene the visitor is looking at):
- \`flyToBody(name)\` — fly the camera to a named body
- \`followBody(name)\` — lock the camera to follow a body as it orbits
- \`setTimeWarp(value)\` — speed up or slow down time (1 = real-time-ish, 60 = a minute per second, etc.)
- \`setSimTime(daysFromEpoch)\` — jump the simulation to a specific date (days from J2000)
- \`resetView()\` — return the camera to the default solar-system overview

## How to act

1. If the visitor names a body or asks a "where / when / how big" question, USE A TOOL. Don't answer from memory if the dataset has the answer.
2. If they ask for an action ("show me", "take me to", "fly to"), call the action tool. The visual is the answer; your words are commentary.
3. If they ask something off-topic (your name, who built this, etc.), answer briefly and steer back to the engine.
4. If a name is ambiguous ("Comet Tempel" → Tempel 2 or Tempel-Tuttle?), ask one clarifying question rather than guessing.
5. If the request is impossible (no exoplanet host within 2 AU of the Sun, for example), say so honestly. The engine is a fidelity model — gaps in the dataset are real gaps.

## Dataset (cached)

This is the complete list of bodies, sky points, and constellations the engine knows about. Every action tool must reference a body that exists here.

`

/**
 * Build the full system prompt with embedded dataset. The result is
 * stable for the lifetime of the page — re-rendering doesn't change
 * the bytes, so prompt caching applies.
 *
 * Returns a single string suitable for `system` in messages.create()
 * with `cache_control: { type: "ephemeral" }`.
 */
export function buildSystemPrompt(): string {
  const dataset = buildDataset()
  return SYSTEM_PROMPT_HEADER + JSON.stringify(dataset, null, 2)
}

/**
 * Cheap helper for the UI's empty state — a few suggested prompts
 * that show what the assistant can do.
 */
export const SUGGESTED_PROMPTS = [
  "Show me every comet whose orbit crosses Earth's",
  "Take me to Halley's Comet at perihelion",
  "What's the closest exoplanet host star?",
  "Speed up time and follow Mercury",
  "What was 3I/ATLAS doing last October?",
]

/**
 * Dataset counts — exposed for UI cost displays + "the assistant
 * knows about N bodies" type copy without re-serialising.
 */
export function getDatasetCounts() {
  return {
    planets: planetsData.length,
    scenePlanets: buildScenePlanets().length,
    namedBodies: namedBodies.length,
    skyPoints: skyPoints.length,
    constellations: constellations.length,
  }
}
