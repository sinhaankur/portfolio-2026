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
  buildScenePlanets,
  cancelFollow,
  cancelFlyTo,
  constellations,
  flyToRef,
  followRef,
  namedBodies,
  planetsData,
  requestFlyTo,
  requestFollow,
  simTimeRef,
  skyPoints,
  timeWarpRef,
} from "@/components/universe-engine/astronomy"
import type { NamedBody, Planet } from "@/components/universe-engine/types"
import {
  EXOPLANET_HOSTS_NEARBY,
  type ExoplanetHost,
} from "@/lib/data/exoplanet-hosts"

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
      "Get the current simulated date — what calendar date the engine is showing right now. The simulation advances at TIME_WARP_DAYS_PER_SEC × timeWarp; this returns the accumulated result as an ISO date string.",
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
      "Jump the simulation to a specific date by setting days from the page-load epoch. Use for 'what was X doing on date Y' — call getCurrentSimDate first to know the current offset.",
    input_schema: {
      type: "object",
      properties: {
        daysFromEpoch: {
          type: "number",
          description:
            "Days from the simulation's start epoch. 0 = scene start time. Positive = future, negative = past.",
        },
      },
      required: ["daysFromEpoch"],
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

function findPlanet(name: string): Planet | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  return planetsData.find((p) => p.name.toLowerCase() === lower)
}

function findExoplanetHost(name: string): ExoplanetHost | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  return (
    EXOPLANET_HOSTS_NEARBY.find((h) => h.name.toLowerCase() === lower) ??
    EXOPLANET_HOSTS_NEARBY.find((h) => h.name.toLowerCase().includes(lower))
  )
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
  // Same time math as NamedBodyMesh's useFrame.
  const TIME_WARP_DAYS_PER_SEC_LOCAL = 10
  const simDays = simTimeRef.current.days
  const periodDays = isFinite(body.periodYears) ? body.periodYears * 365.25 : 73000
  const phaseFraction = body.startPhase + (simDays / periodDays)
  const phase = (phaseFraction % 1) * Math.PI * 2

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
  let yOut = yi
  let zOut = zi
  if (longNode !== 0) {
    const cO = Math.cos(longNode)
    const sO = Math.sin(longNode)
    xOut = xp * cO - zi * sO
    zOut = xp * sO + zi * cO
  }
  void TIME_WARP_DAYS_PER_SEC_LOCAL
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
    const result = runTool(toolName, input)
    return { content: typeof result === "string" ? result : JSON.stringify(result), isError: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { content: `Tool ${toolName} failed: ${msg}`, isError: true }
  }
}

function runTool(toolName: string, input: ToolInput): unknown {
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
      const days = simTimeRef.current.days
      const epoch = simTimeRef.current.epochMs
      const ms = epoch + days * 86_400_000
      return {
        simDate: new Date(ms).toISOString().slice(0, 10),
        daysFromEpoch: Number(days.toFixed(3)),
        timeWarp: timeWarpRef.current,
      }
    }

    case "flyToBody": {
      const name = String(input.name ?? "")
      // The fly-to function takes (target, distance, label).
      // We compute a target in scene-local coords (origin = Sun).
      const body = findNamedBody(name)
      if (body) {
        const pos = computeBodyPosition(body)
        requestFlyTo({ x: pos.xSceneUnits, y: pos.ySceneUnits, z: pos.zSceneUnits }, 1.6, body.name)
        return `Flying to ${body.name}.`
      }
      const planet = findPlanet(name)
      if (planet) {
        const r = planetSceneRadius(planet)
        requestFlyTo({ x: r, y: 0, z: 0 }, 1.6, planet.name)
        return `Flying to ${planet.name}.`
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
      return `Body "${name}" not found. Use listBodies or listExoplanetHosts to see what's available.`
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
      const days = Number(input.daysFromEpoch ?? 0)
      simTimeRef.current.days = days
      return `Simulation time set to day ${days} from epoch.`
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
  followBody: "Locking camera",
  setTimeWarp: "Adjusting time warp",
  setSimTime: "Jumping in time",
  resetView: "Resetting view",
}
