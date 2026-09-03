/**
 * Assistant tools — read + action surface for the LLM.
 *
 * Read tools query the static dataset (namedBodies, skyPoints,
 * planetsData) without side effects.
 *
 * Action tools mutate the module-scoped refs in astronomy.ts
 * (flyToRef, followRef, timeWarpRef, simTimeRef) — exactly the same
 * refs that the existing HUD controls use. The model's tool call
 * lands in the live engine.
 *
 * Tool *definitions* (name, description, JSON schema) are passed to
 * Claude. Tool *executors* are local — they run in the browser when
 * the model emits a tool_use block.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages"
import {
  cancelFollow,
  cancelFlyTo,
  constellations,
  daysSinceJ2000,
  J2000_MS,
  moons,
  namedBodies,
  planetsData,
  requestFlyTo,
  requestFollow,
  simTimeRef,
  skyPoints,
  timeWarpRef,
} from "@/components/universe-engine/astronomy"
import type { MoonData, NamedBody, Planet } from "@/components/universe-engine/types"
import {
  EXOPLANET_HOSTS_NEARBY,
  type ExoplanetHost,
} from "@/lib/data/exoplanet-hosts"
import { loadSatelliteCatalog } from "@/components/universe-engine/satellite-data"
import { selectedSatRef } from "@/components/universe-engine/satellite-refs"

/* ------------------------------------------------------------------
 * Tool definitions — sent to Claude in `tools`.
 *
 * Descriptions matter — the model picks tools by description. They
 * read like a panel-of-controls' operator manual, not marketing copy.
 * ------------------------------------------------------------------ */

export const ASSISTANT_TOOLS: Tool[] = [
  // ----- READ -----
  {
    name: "listBodies",
    description:
      "List named small bodies in the Universe Engine (comets, asteroids, interstellar visitors, dwarf planets, spacecraft). Optionally filter by kind. Returns a compact array of {name, designation, kind, aAU, periodYears}. Use to answer 'what comets are there?' or 'which spacecraft are escaping the solar system?'.",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["comet", "asteroid", "interstellar", "spacecraft", "dwarf"],
          description: "Filter by body kind. Omit for all bodies.",
        },
      },
    },
  },
  {
    name: "getBodyDetails",
    description:
      "Get the full record for one named body — orbital elements, period, fact, designation. Use after the user names a specific body, or after listBodies returns a candidate.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Exact name as it appears in the dataset (e.g. 'Halley's Comet', 'Voyager 1', 'Comet Hale-Bopp'). Use listBodies if unsure of the name.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "getBodyPosition",
    description:
      "Compute the current heliocentric scene position of a named body. Returns {xSceneUnits, ySceneUnits, zSceneUnits, distanceFromSunAU}. Useful for 'where is X right now' or to verify a body is on the inbound vs outbound leg of its orbit.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Body name as in the dataset." },
      },
      required: ["name"],
    },
  },
  {
    name: "findBodiesNear",
    description:
      "Find other named bodies within a radius of a reference body, sorted by distance. Use for 'what's near Mars?' or 'which comets are currently close to Earth?'. Returns up to 12 nearest matches.",
    input_schema: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Body name to search around (e.g. 'Earth', 'Halley's Comet').",
        },
        radiusAU: {
          type: "number",
          description: "Search radius in AU. Typical: 1.0 for neighbours, 5.0 for inner-system, 30+ for outer-system.",
        },
      },
      required: ["reference", "radiusAU"],
    },
  },
  {
    name: "getOrbitalState",
    description:
      "Get a body's Kepler elements with derived perihelion and aphelion (in AU). Use for 'when does X return', 'how eccentric is X's orbit', or to explain orbit shape.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Body name as in the dataset." },
      },
      required: ["name"],
    },
  },
  {
    name: "listExoplanetHosts",
    description:
      "List stars in the dataset that host confirmed exoplanets. Combines the engine's hand-curated set (Proxima Centauri, TRAPPIST-1, 51 Peg, etc. with rich per-planet detail) with the NASA Exoplanet Archive's broader catalog of hosts within ~50 ly (Kepler-186, K2-18, GJ 1214, WASP-12, etc.). Each entry returns name, designation, distance, fact. Use for 'closest exoplanet host', 'which habitable-zone systems', 'tell me about WASP-12', etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "listConstellations",
    description:
      "List the 7 constellations the engine projects from real J2000 coordinates. Returns name, RA hours, Dec degrees, star count.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getCurrentSimDate",
    description:
      "Get the current simulated date — what calendar date the engine is showing right now. Positions are a pure function of this instant. Returns the ISO date, the full ISO instant, days from the J2000 epoch, and the active time-warp multiplier.",
    input_schema: { type: "object", properties: {} },
  },

  // ----- ACTION -----
  {
    name: "flyToBody",
    description:
      "Fly the camera to a named body. The camera glides over ~2 seconds and frames the body in view. Use whenever the user asks 'show me', 'take me to', or 'fly to'. Prefer this over describing what the user would see — the visual is the answer.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Body name. Accepts named bodies (comets, asteroids, spacecraft, dwarfs, interstellars), planets, the Sun, and exoplanet hosts.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "flyToBodyAtPerihelion",
    description:
      "Jump the simulation to a body's perihelion (its closest approach to the Sun) AND fly the camera there in one step. Use for 'take me to Halley's Comet at perihelion', 'show me Comet X when it's closest to the Sun', or 'when does X reach perihelion'. Computes the real perihelion date from the body's orbit, sets sim time to it, then flies + follows. Prefer this over calling setSimTime and flyToBody separately.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Body name (e.g. 'Halley's Comet', 'Comet Hale-Bopp', 'Mars').",
        },
        which: {
          type: "string",
          enum: ["next", "previous", "nearest"],
          description:
            "Which perihelion relative to the current sim date: the next upcoming one (default), the previous one, or whichever is nearest in time.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "followBody",
    description:
      "Lock the camera to track a body as it orbits — useful for fast movers (comets near perihelion, the ISS, interstellar visitors). The camera stays attached until the user clicks elsewhere or resetView is called.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Body name to follow." },
      },
      required: ["name"],
    },
  },
  {
    name: "setTimeWarp",
    description:
      "Set the simulation time-warp multiplier. 1 = base rate (~10 days/sec at default), 60 = roughly a minute per real second, 365 = a year per real second. Negative values reverse time. Range: -10000 to 10000.",
    input_schema: {
      type: "object",
      properties: {
        value: {
          type: "number",
          description:
            "Time-warp multiplier. Use small values (1-20) for inner-planet motion, 60-300 for outer planets, 365+ for orbits longer than a year.",
        },
      },
      required: ["value"],
    },
  },
  {
    name: "setSimTime",
    description:
      "Jump the simulation to a specific calendar date. The whole scene is date-accurate, so this places every planet and comet where it really was/will be. Use for 'what was X doing on date Y' or 'take me to Halley's next perihelion'.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "ISO date or instant — e.g. \"2061-07-28\" or \"2061-07-28T12:00:00Z\". Past and future both work.",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "resetView",
    description:
      "Return the camera to the default solar-system overview and cancel any active follow. Use when the user says 'back', 'reset', or wants to see the whole system.",
    input_schema: { type: "object", properties: {} },
  },
]

/* ------------------------------------------------------------------
 * Tool executors — run in the browser when Claude emits a tool_use.
 *
 * Each executor returns a string (the tool_result content). The model
 * sees this string verbatim, so it should be terse + structured.
 * JSON is fine; long prose is wasteful (every output token costs).
 * ------------------------------------------------------------------ */

type ToolInput = Record<string, unknown>

function findNamedBody(name: string): NamedBody | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  // Exact match first, then case-insensitive contains.
  return (
    namedBodies.find((b) => b.name.toLowerCase() === lower) ??
    namedBodies.find((b) => b.designation.toLowerCase() === lower) ??
    namedBodies.find((b) => b.name.toLowerCase().includes(lower))
  )
}

/** Exact-only variant — used to give named bodies priority over the satellite
 *  catalogue WITHOUT the fuzzy `.includes` stealing satellite names ("ISS"
 *  used to substring-match into the wrong body instead of the station). */
function findNamedBodyExact(name: string): NamedBody | undefined {
  const lower = name.toLowerCase().trim()
  if (!lower) return undefined
  return (
    namedBodies.find((b) => b.name.toLowerCase() === lower) ??
    namedBodies.find((b) => b.designation.toLowerCase() === lower)
  )
}

/** Household names → SATCAT designations. The machines people ask for aren't
 *  catalogued under the names they use (same aliases as the search box). */
const SAT_ALIASES: Record<string, string> = {
  "iss": "iss (zarya)",
  "the iss": "iss (zarya)",
  "international space station": "iss (zarya)",
  "space station": "iss (zarya)",
  "zarya": "iss (zarya)",
  "hubble": "hst",
  "the hubble": "hst",
  "hubble telescope": "hst",
  "hubble space telescope": "hst",
  "tiangong": "css (tianhe)",
  "chinese space station": "css (tianhe)",
}

/** Resolve an Earth-orbit satellite from the live catalogue and select it —
 *  the field then runs its real chase-follow (orbit line, ground track, full
 *  record card), exactly as if the user had picked it in the search box.
 *  Returns the confirmation line, or null when nothing matches. */
async function flyToSatellite(name: string): Promise<string | null> {
  const q = name.toLowerCase().trim()
  if (!q) return null
  const target = SAT_ALIASES[q] ?? q
  const catalog = await loadSatelliteCatalog().catch(() => null)
  if (!catalog || !catalog.length) return null
  const exact = catalog.find((s) => s.name.toLowerCase() === target)
  const starts = exact ?? catalog.find((s) => s.name.toLowerCase().startsWith(target))
  let hit = starts
  if (!hit && target.length >= 4) {
    // Word-anchored contains — "starlink-32501" or "NOAA 19" style queries;
    // ≥4 chars so short tokens can't land on arbitrary debris entries.
    const re = new RegExp(`(^|[^a-z0-9])${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    hit = catalog.find((s) => re.test(s.name.toLowerCase()))
  }
  if (!hit) return null
  selectedSatRef.current = hit.id
  window.dispatchEvent(new CustomEvent("universe:sky-focus", { detail: { pointId: "planet:Earth" } }))
  return `Flying to ${hit.name} — selecting it in the live swarm and locking the chase camera on its real orbit.`
}

function findPlanet(name: string): Planet | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  return planetsData.find((p) => p.name.toLowerCase() === lower)
}

function findMoon(name: string): MoonData | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  // Exact, then contains ("Luna" ↔ "Moon (Luna)", "Titan" etc.).
  return (
    moons.find((m) => m.name.toLowerCase() === lower) ??
    moons.find((m) => m.name.toLowerCase().includes(lower))
  )
}

/**
 * Compute a perihelion date (ms) for a named body relative to a reference time.
 *
 * Two sources, in order of fidelity:
 *   1. A stored reference perihelion epoch (`perihelionTT`) + the period — exact
 *      for the comets that carry it (Halley, Hale-Bopp, …). Step by whole periods
 *      to the perihelion next/previous/nearest the reference.
 *   2. Otherwise derive it from the mean-anomaly anchor: perihelion is M = 0, so
 *      from `m0Deg` + `periodDays` we solve for the time M crosses zero.
 *
 * Returns null when the body has no usable period (hyperbolic / interstellar —
 * a single perihelion that the caller can still read from perihelionTT directly).
 */
function perihelionMsFor(
  body: NamedBody,
  refMs: number,
  which: "next" | "previous" | "nearest",
): number | null {
  const periodDays = isFinite(body.periodYears) ? body.periodYears * 365.25 : Infinity
  if (!isFinite(periodDays) || periodDays <= 0) {
    // Non-periodic: the one known perihelion, if stored.
    return body.perihelionTT ? Date.parse(body.perihelionTT) : null
  }
  const periodMs = periodDays * 86_400_000

  // Reference perihelion instant.
  let baseMs: number
  if (body.perihelionTT) {
    baseMs = Date.parse(body.perihelionTT)
  } else {
    // No stored epoch: derive from the mean-anomaly anchor. computeBodyPosition
    // treats `startPhase` (turns, 0..1) as the mean anomaly M at J2000; perihelion
    // is M ≡ 0, so the perihelion just before J2000 is startPhase·period days back.
    const m0Turns = ((body.startPhase % 1) + 1) % 1
    const daysToPeri = -m0Turns * periodDays
    baseMs = J2000_MS + daysToPeri * 86_400_000
  }

  // Step by whole periods to bracket the reference time.
  const k = Math.floor((refMs - baseMs) / periodMs)
  const prevMs = baseMs + k * periodMs
  const nextMs = baseMs + (k + 1) * periodMs
  if (which === "previous") return prevMs
  if (which === "next") return nextMs
  // nearest
  return Math.abs(refMs - prevMs) <= Math.abs(nextMs - refMs) ? prevMs : nextMs
}

function findExoplanetHost(name: string): ExoplanetHost | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  return (
    EXOPLANET_HOSTS_NEARBY.find((h) => h.name.toLowerCase() === lower) ??
    EXOPLANET_HOSTS_NEARBY.find((h) => h.name.toLowerCase().includes(lower))
  )
}

export type UniverseSearchHit = {
  name: string
  kind: string
  source: "sun" | "planet" | "moon" | "named-body" | "sky-point" | "exoplanet-host"
  subtitle?: string
}

function scoreSearchValue(query: string, haystack: string): number {
  if (!haystack) return -1
  const q = query.toLowerCase().trim()
  const value = haystack.toLowerCase().trim()
  if (!q || !value) return -1
  if (value === q) return 100
  if (value.startsWith(q)) return 80
  if (value.includes(` ${q}`)) return 65
  if (value.includes(q)) return 50
  return -1
}

export function searchUniverseCatalog(query: string, limit = 12): UniverseSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored: Array<{ hit: UniverseSearchHit; score: number }> = []
  const pushScored = (hit: UniverseSearchHit, aliases: string[] = []) => {
    const values = [hit.name, ...aliases]
    const best = values.reduce((max, value) => {
      const score = scoreSearchValue(q, value)
      return score > max ? score : max
    }, -1)
    if (best >= 0) scored.push({ hit, score: best })
  }

  pushScored(
    {
      name: "Sun",
      kind: "star",
      source: "sun",
      subtitle: "Solar system anchor",
    },
    ["sol"],
  )

  planetsData.forEach((planet) => {
    pushScored(
      {
        name: planet.name,
        kind: "planet",
        source: "planet",
        subtitle: `${planet.classification} planet`,
      },
      [planet.classification],
    )
  })

  namedBodies.forEach((body) => {
    pushScored(
      {
        name: body.name,
        kind: body.kind,
        source: "named-body",
        subtitle: body.designation,
      },
      [body.designation, body.kind],
    )
  })

  moons.forEach((moon) => {
    pushScored(
      {
        name: moon.name,
        kind: "moon",
        source: "moon",
        subtitle: `Moon of ${moon.parent}`,
      },
      [moon.parent, "moon", "satellite"],
    )
  })

  skyPoints.forEach((point) => {
    pushScored(
      {
        name: point.name,
        kind: point.kind,
        source: "sky-point",
        subtitle: point.designation,
      },
      [point.designation, point.kind],
    )
  })

  EXOPLANET_HOSTS_NEARBY.forEach((host) => {
    pushScored(
      {
        name: host.name,
        kind: host.kind,
        source: "exoplanet-host",
        subtitle: host.designation,
      },
      [host.designation, host.kind],
    )
  })

  const deduped = new Map<string, { hit: UniverseSearchHit; score: number }>()
  for (const row of scored) {
    const key = row.hit.name.toLowerCase()
    const prev = deduped.get(key)
    if (!prev || row.score > prev.score) deduped.set(key, row)
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.hit.name.localeCompare(b.hit.name)
    })
    .slice(0, limit)
    .map((row) => row.hit)
}

/** Project a host's RA/Dec onto the engine's sky shell. Matches
 *  raDecToScenePos in the engine: spherical → Cartesian with radius
 *  150 (SKY_SHELL_DISTANCE). */
function exoplanetHostScenePos(host: ExoplanetHost): { x: number; y: number; z: number } {
  const SKY_SHELL = 150
  const raRad = (host.raHours / 24) * 2 * Math.PI
  const decRad = (host.decDeg / 180) * Math.PI
  const cosDec = Math.cos(decRad)
  return {
    x: SKY_SHELL * cosDec * Math.cos(raRad),
    y: SKY_SHELL * Math.sin(decRad),
    z: SKY_SHELL * cosDec * Math.sin(raRad),
  }
}

/** Solve Kepler's equation for elliptical orbits — same approach the
 *  scene uses. Returns eccentric anomaly E from mean anomaly M. */
function solveKepler(M: number, e: number): number {
  if (e >= 1) return M
  let E = M + e * Math.sin(M)
  for (let i = 0; i < 8; i++) {
    const f = E - e * Math.sin(E) - M
    const fp = 1 - e * Math.cos(E)
    const dE = f / fp
    E -= dE
    if (Math.abs(dE) < 1e-8) break
  }
  return E
}

/** Compute heliocentric position of a named body at the current sim time.
 *  Returns x/y/z in scene units (matching the scene's sqrt-compression)
 *  and distanceFromSunAU in real AU. */
function computeBodyPosition(body: NamedBody) {
  // Date-driven mean anomaly — mirrors NamedBodyMesh's useFrame so the
  // assistant's flyTo/follow lands the body where the scene draws it.
  // Inclinations > 90° encode retrograde orbits; reverse the increment.
  const simMs = simTimeRef.current.simMs
  const direction = body.inclDeg > 90 ? -1 : 1
  const periodDaysReal = isFinite(body.periodYears) ? body.periodYears * 365.25 : 73000
  const perihelionMs = body.perihelionTT ? Date.parse(body.perihelionTT) : null
  let phase: number
  if (perihelionMs != null) {
    // Real anchor: M = 0 exactly at perihelion, growing with days since it.
    const daysSincePeri = (simMs - perihelionMs) / 86_400_000
    phase = direction * 2 * Math.PI * daysSincePeri / periodDaysReal
  } else {
    // Approximate anchor off J2000 + a fixed startPhase offset.
    const baseMeanAnomaly = body.startPhase * Math.PI * 2
    phase =
      baseMeanAnomaly +
      direction * 2 * Math.PI * daysSinceJ2000(simMs) / periodDaysReal
  }
  phase = phase % (Math.PI * 2)

  const aAU = body.aAU
  const e = body.eccentricity
  const inclination = (body.inclDeg * Math.PI) / 180
  const longNode = ((body.longNodeDeg ?? 0) * Math.PI) / 180
  const argPeri = ((body.argPeriDeg ?? 0) * Math.PI) / 180

  let rAU: number
  let trueAnom: number
  if (e >= 1) {
    rAU = aAU
    trueAnom = 0
  } else {
    const E = solveKepler(phase, e)
    trueAnom = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    )
    rAU = (aAU * (1 - e * e)) / (1 + e * Math.cos(trueAnom))
  }

  // Apply orbital-plane orientation (same as orbitalElementsToCartesian).
  const r = Math.sqrt(Math.max(rAU, 0)) * 3 // scene units
  let xp = r * Math.cos(trueAnom)
  let zp = r * Math.sin(trueAnom)
  if (argPeri !== 0) {
    const cw = Math.cos(argPeri)
    const sw = Math.sin(argPeri)
    const xRot = xp * cw - zp * sw
    const zRot = xp * sw + zp * cw
    xp = xRot
    zp = zRot
  }
  const yi = zp * Math.sin(inclination)
  const zi = zp * Math.cos(inclination)
  let xOut = xp
  const yOut = yi
  let zOut = zi
  if (longNode !== 0) {
    const cO = Math.cos(longNode)
    const sO = Math.sin(longNode)
    xOut = xp * cO - zi * sO
    zOut = xp * sO + zi * cO
  }
  return {
    xSceneUnits: Number(xOut.toFixed(3)),
    ySceneUnits: Number(yOut.toFixed(3)),
    zSceneUnits: Number(zOut.toFixed(3)),
    distanceFromSunAU: Number(rAU.toFixed(3)),
  }
}

function planetSceneRadius(planet: Planet): number {
  return Math.sqrt(planet.aAU) * 3
}

/**
 * Execute a tool call. Returns a string the model will see as the
 * tool_result. Errors are returned as `is_error: true` content so the
 * model can recover or apologise.
 */
export async function executeAssistantTool(
  toolName: string,
  rawInput: unknown,
): Promise<{ content: string; isError: boolean }> {
  try {
    const input = (rawInput ?? {}) as ToolInput
    const result = await runTool(toolName, input)
    return { content: typeof result === "string" ? result : JSON.stringify(result), isError: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { content: `Tool ${toolName} failed: ${msg}`, isError: true }
  }
}

// Async because the satellite fly-to resolves against the shared catalogue
// (a cached fetch); every other tool stays synchronous inside.
async function runTool(toolName: string, input: ToolInput): Promise<unknown> {
  switch (toolName) {
    case "listBodies": {
      const kind = input.kind as string | undefined
      const filtered = kind
        ? namedBodies.filter((b) => b.kind === kind)
        : namedBodies
      return filtered.map((b) => ({
        name: b.name,
        designation: b.designation,
        kind: b.kind,
        aAU: b.aAU,
        eccentricity: b.eccentricity,
        periodYears: isFinite(b.periodYears) ? b.periodYears : "hyperbolic",
      }))
    }

    case "getBodyDetails": {
      const name = String(input.name ?? "")
      const body = findNamedBody(name)
      if (body) {
        return {
          name: body.name,
          designation: body.designation,
          kind: body.kind,
          aAU: body.aAU,
          eccentricity: body.eccentricity,
          inclDeg: body.inclDeg,
          periodYears: isFinite(body.periodYears) ? body.periodYears : "hyperbolic",
          fact: body.fact,
        }
      }
      const planet = findPlanet(name)
      if (planet) {
        return {
          name: planet.name,
          type: "planet",
          aAU: planet.aAU,
          radiusEarth: planet.radiusEarth,
          periodDays: planet.periodDays,
          classification: planet.classification,
          moons: planet.moons,
          fact: planet.fact,
        }
      }
      const moon = findMoon(name)
      if (moon) {
        return {
          name: moon.name,
          type: "moon",
          parent: moon.parent,
          orbitalPeriodDays: moon.periodDays,
          fact: moon.fact,
          ...(moon.deep ? { detail: moon.deep } : {}),
        }
      }
      // Curated sky points (galaxies, nebulae, exoplanet hosts with
      // rich per-planet detail). These take precedence over the
      // fetched catalog because the curated entries carry hand-written
      // facts the fetched ones don't.
      const skyPoint = skyPoints.find(
        (s) => s.name.toLowerCase() === name.toLowerCase().trim(),
      )
      if (skyPoint) {
        return {
          name: skyPoint.name,
          designation: skyPoint.designation,
          kind: skyPoint.kind,
          raHours: skyPoint.raHours,
          decDeg: skyPoint.decDeg,
          distance: skyPoint.distance,
          magnitude: skyPoint.magnitude,
          fact: skyPoint.fact,
        }
      }
      // Fetched exoplanet hosts (NASA Exoplanet Archive). Surfaced for
      // catalog-name queries like "WASP-12", "Kepler-186", "GJ 1214".
      const exoHost = findExoplanetHost(name)
      if (exoHost) {
        return {
          name: exoHost.name,
          designation: exoHost.designation,
          kind: exoHost.kind,
          raHours: exoHost.raHours,
          decDeg: exoHost.decDeg,
          distance: exoHost.distance,
          magnitude: exoHost.magnitude,
          knownPlanets: exoHost.knownPlanets,
          firstDiscoveryYear: exoHost.firstDiscoveryYear,
          spectralType: exoHost.spectralType,
          hasHabitableCandidate: exoHost.hasHabitableCandidate,
          fact: exoHost.fact,
        }
      }
      return { error: `No body matching "${name}" in the dataset.` }
    }

    case "getBodyPosition": {
      const name = String(input.name ?? "")
      const body = findNamedBody(name)
      if (body) return computeBodyPosition(body)
      const planet = findPlanet(name)
      if (planet) {
        return {
          // Planets are approximated as circular for this lookup —
          // accurate enough for "where is Mars right now" level questions.
          distanceFromSunAU: planet.aAU,
          xSceneUnits: "varies — orbits the Sun on the ecliptic",
          ySceneUnits: 0,
          zSceneUnits: 0,
        }
      }
      return { error: `No body matching "${name}".` }
    }

    case "findBodiesNear": {
      const reference = String(input.reference ?? "")
      const radiusAU = Number(input.radiusAU ?? 1)
      const refBody = findNamedBody(reference)
      const refPlanet = findPlanet(reference)
      const refAU = refBody?.aAU ?? refPlanet?.aAU
      if (refAU == null) {
        return { error: `Reference body "${reference}" not found.` }
      }
      const nearby = namedBodies
        .filter((b) => b.name.toLowerCase() !== reference.toLowerCase())
        .map((b) => ({ body: b, delta: Math.abs(b.aAU - refAU) }))
        .filter((entry) => entry.delta <= radiusAU)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 12)
      return nearby.map((entry) => ({
        name: entry.body.name,
        kind: entry.body.kind,
        aAU: entry.body.aAU,
        deltaAU: Number(entry.delta.toFixed(3)),
      }))
    }

    case "getOrbitalState": {
      const name = String(input.name ?? "")
      const body = findNamedBody(name)
      if (!body) return { error: `Body "${name}" not found.` }
      const perihelion = body.eccentricity < 1
        ? body.aAU * (1 - body.eccentricity)
        : body.aAU
      const aphelion = body.eccentricity < 1
        ? body.aAU * (1 + body.eccentricity)
        : "hyperbolic — body escapes"
      return {
        name: body.name,
        aAU: body.aAU,
        eccentricity: body.eccentricity,
        inclDeg: body.inclDeg,
        periodYears: isFinite(body.periodYears) ? body.periodYears : "hyperbolic",
        perihelionAU: typeof perihelion === "number" ? Number(perihelion.toFixed(4)) : perihelion,
        aphelionAU: typeof aphelion === "number" ? Number(aphelion.toFixed(4)) : aphelion,
      }
    }

    case "listExoplanetHosts": {
      // Merge curated (rich per-planet facts) + fetched (NASA Exoplanet
      // Archive, ≤ 50 ly). Curated take precedence by name so the
      // model sees the richer entry for Proxima Centauri, TRAPPIST-1,
      // 51 Peg etc. while still getting Kepler-186, K2-18, GJ 1214,
      // WASP-12, and the rest of the neighbourhood.
      const curated = skyPoints
        .filter((s) => s.kind === "exoplanet-host")
        .map((s) => ({
          name: s.name,
          designation: s.designation,
          distance: s.distance,
          fact: s.fact?.split(". ")[0],
          source: "curated" as const,
        }))
      const curatedNames = new Set(curated.map((c) => c.name.toLowerCase()))
      const fetched = EXOPLANET_HOSTS_NEARBY
        .filter((h) => !curatedNames.has(h.name.toLowerCase()))
        .map((h) => ({
          name: h.name,
          designation: h.designation,
          distance: h.distance,
          fact: h.fact,
          knownPlanets: h.knownPlanets,
          hasHabitableCandidate: h.hasHabitableCandidate,
          source: "nasa-exoplanet-archive" as const,
        }))
      return [...curated, ...fetched]
    }

    case "listConstellations": {
      return constellations.map((c) => ({
        id: c.id,
        name: c.name,
        designation: c.designation,
        numStars: c.stars.length,
        fact: c.fact.split(". ").slice(0, 2).join(". "),
      }))
    }

    case "getCurrentSimDate": {
      const ms = simTimeRef.current.simMs
      return {
        simDate: new Date(ms).toISOString().slice(0, 10),
        simInstant: new Date(ms).toISOString(),
        daysFromJ2000: Number(daysSinceJ2000(ms).toFixed(3)),
        timeWarp: timeWarpRef.current,
      }
    }

    case "flyToBody": {
      const name = String(input.name ?? "")
      // The fly-to function takes (target, distance, label).
      // We compute a target in scene-local coords (origin = Sun).
      // Exact named-body matches win outright; then the SATELLITE catalogue
      // (18k+ real craft — "ISS", "Hubble", "Starlink-…", "NOAA 19"), and only
      // then the fuzzy named-body fallback. Fuzzy used to run first and
      // substring-steal satellite names, so "fly to the ISS" never reached
      // the actual station.
      const exactBody = findNamedBodyExact(name)
      if (exactBody) {
        const pos = computeBodyPosition(exactBody)
        requestFlyTo({ x: pos.xSceneUnits, y: pos.ySceneUnits, z: pos.zSceneUnits }, 1.6, exactBody.name)
        return `Flying to ${exactBody.name}.`
      }
      const planet = findPlanet(name)
      if (planet) {
        const r = planetSceneRadius(planet)
        requestFlyTo({ x: r, y: 0, z: 0 }, 1.6, planet.name)
        return `Flying to ${planet.name}.`
      }
      // Moons: a moon sits beside its parent planet at scene scale, so we frame
      // the parent (which draws the moon in view) and name the moon. Closer
      // framing than a bare planet so the moon reads.
      const moon = findMoon(name)
      if (moon) {
        const parent = findPlanet(moon.parent)
        const r = parent ? planetSceneRadius(parent) : 0
        requestFlyTo({ x: r, y: 0, z: 0 }, 1.1, moon.name)
        return `Flying to ${moon.name}, orbiting ${moon.parent}.`
      }
      if (name.toLowerCase() === "sun") {
        requestFlyTo({ x: 0, y: 0, z: 0 }, 3.2, "Sun")
        return "Flying to the Sun."
      }
      // Curated sky points — project to the engine's sky shell at
      // SKY_SHELL_DISTANCE (150). Same math the engine itself uses in
      // raDecToScenePos, just inlined so the tool doesn't need a
      // dependency on R3F components.
      const skyPoint = skyPoints.find(
        (s) => s.name.toLowerCase() === name.toLowerCase().trim(),
      )
      if (skyPoint) {
        const SKY_SHELL = 150
        const raRad = (skyPoint.raHours / 24) * 2 * Math.PI
        const decRad = (skyPoint.decDeg / 180) * Math.PI
        const cosDec = Math.cos(decRad)
        requestFlyTo(
          {
            x: SKY_SHELL * cosDec * Math.cos(raRad),
            y: SKY_SHELL * Math.sin(decRad),
            z: SKY_SHELL * cosDec * Math.sin(raRad),
          },
          12, // back off so a far-field sky point frames in view
          skyPoint.name,
        )
        return `Flying to ${skyPoint.name}.`
      }
      // Fetched exoplanet hosts (NASA Exoplanet Archive). Same sky-shell
      // projection as curated sky points; the only difference is the
      // dataset they came from.
      const exoHost = findExoplanetHost(name)
      if (exoHost) {
        const pos = exoplanetHostScenePos(exoHost)
        requestFlyTo(pos, 12, exoHost.name)
        return `Flying to ${exoHost.name}.`
      }
      // Earth-orbit satellites — the 18k+ live catalogue ("the ISS", "Hubble",
      // "Starlink-32501", "NOAA 19"). After every exact curated match so a
      // star like Sirius beats the SIRIUS radio satellites, but BEFORE the
      // fuzzy named-body fallback, whose substring match used to swallow
      // satellite names and leave "fly to the ISS" going nowhere.
      const satResult = await flyToSatellite(name)
      if (satResult) return satResult
      // Loose named-body fallback (case-insensitive contains) — last resort.
      const fuzzyBody = findNamedBody(name)
      if (fuzzyBody) {
        const pos = computeBodyPosition(fuzzyBody)
        requestFlyTo({ x: pos.xSceneUnits, y: pos.ySceneUnits, z: pos.zSceneUnits }, 1.6, fuzzyBody.name)
        return `Flying to ${fuzzyBody.name}.`
      }
      return `Body "${name}" not found. Use listBodies or listExoplanetHosts to see what's available.`
    }

    case "flyToBodyAtPerihelion": {
      const name = String(input.name ?? "")
      const which = (["next", "previous", "nearest"].includes(String(input.which))
        ? String(input.which)
        : "next") as "next" | "previous" | "nearest"
      const body = findNamedBody(name)
      if (!body) {
        return `Body "${name}" not found. Use listBodies to see available comets, asteroids, and spacecraft.`
      }
      const periMs = perihelionMsFor(body, simTimeRef.current.simMs, which)
      if (periMs == null || Number.isNaN(periMs)) {
        return `${body.name} has no computable perihelion (its orbit isn't periodic or lacks a reference epoch).`
      }
      // 1) jump the clock to perihelion, 2) fly there, 3) follow through it.
      simTimeRef.current.simMs = periMs
      const pos = computeBodyPosition(body)
      requestFlyTo({ x: pos.xSceneUnits, y: pos.ySceneUnits, z: pos.zSceneUnits }, 1.6, body.name)
      requestFollow(
        () => {
          const p = computeBodyPosition(body)
          return { x: p.xSceneUnits, y: p.ySceneUnits, z: p.zSceneUnits }
        },
        body.kind === "dwarf" ? 2.4 : 1.6,
        body.name,
      )
      const dateStr = new Date(periMs).toISOString().slice(0, 10)
      const q = body.eccentricity < 1 ? body.aAU * (1 - body.eccentricity) : body.aAU
      return `At perihelion, ${body.name} is ${q.toFixed(3)} AU from the Sun on ${dateStr}. Jumped the clock there and following it through closest approach.`
    }

    case "followBody": {
      const name = String(input.name ?? "")
      const body = findNamedBody(name)
      if (!body) return `Body "${name}" not found.`
      // Follow needs a getter that returns the current world position;
      // we approximate with a closure that recomputes from sim time.
      requestFollow(
        () => {
          const pos = computeBodyPosition(body)
          return { x: pos.xSceneUnits, y: pos.ySceneUnits, z: pos.zSceneUnits }
        },
        body.kind === "dwarf" ? 2.4 : 1.6,
        body.name,
      )
      return `Following ${body.name}.`
    }

    case "setTimeWarp": {
      const value = Number(input.value ?? 1)
      const clamped = Math.max(-10000, Math.min(10000, value))
      timeWarpRef.current = clamped
      return `Time warp set to ${clamped}.`
    }

    case "setSimTime": {
      const iso = String(input.date ?? "").trim()
      const ms = Date.parse(iso)
      if (!iso || Number.isNaN(ms)) {
        throw new Error(
          `Invalid date "${iso}". Pass an ISO date like "2061-07-28" or a full ISO instant.`,
        )
      }
      simTimeRef.current.simMs = ms
      return `Simulation time set to ${new Date(ms).toISOString().slice(0, 10)}.`
    }

    case "resetView": {
      cancelFollow()
      cancelFlyTo()
      // Fly back to the default overview (matches the resetView button).
      requestFlyTo({ x: 0, y: 0, z: 0 }, 13, "Solar System")
      return "View reset."
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

// Reused by the UI to render a friendly "tool in progress" indicator.
export const TOOL_LABELS: Record<string, string> = {
  listBodies: "Listing bodies",
  getBodyDetails: "Looking up details",
  getBodyPosition: "Computing position",
  findBodiesNear: "Searching nearby",
  getOrbitalState: "Reading orbital elements",
  listExoplanetHosts: "Listing exoplanet hosts",
  listConstellations: "Listing constellations",
  getCurrentSimDate: "Checking sim time",
  flyToBody: "Flying camera",
  flyToBodyAtPerihelion: "Flying to perihelion",
  followBody: "Locking camera",
  setTimeWarp: "Adjusting time warp",
  setSimTime: "Jumping in time",
  resetView: "Resetting view",
}
