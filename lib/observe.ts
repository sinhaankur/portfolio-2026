/**
 * How we observe each object — the electromagnetic-spectrum teaching layer.
 *
 * Ankur's "radio waves and light rays and so on": humanity doesn't see the
 * universe in one way. A planet reflects visible sunlight; cold dust glows in
 * the infrared; a black hole is invisible itself but its superheated infalling
 * gas screams in X-rays; pulsars pulse in radio. This maps a body (by kind) to
 * the band(s) we actually observe it in + a one-line "why" — pure deterministic
 * data, no model, so the engine can teach how we SEE each thing at zero cost.
 *
 * Bands, short→long wavelength: gamma · X-ray · ultraviolet · visible ·
 * infrared · radio. Each entry names the primary band + a plain reason.
 */

export type ObserveBand = "radio" | "infrared" | "visible" | "ultraviolet" | "x-ray" | "gamma"

export type Observation = {
  /** Primary band(s) we observe this kind of object in, best-first. */
  bands: ObserveBand[]
  /** One-line plain-language explanation of HOW/WHY we see it this way. */
  how: string
}

/** A rough wavelength label for a band, for UI/teaching. */
export const BAND_WAVELENGTH: Record<ObserveBand, string> = {
  gamma: "< 0.01 nm",
  "x-ray": "0.01–10 nm",
  ultraviolet: "10–400 nm",
  visible: "400–700 nm",
  infrared: "0.7 µm – 1 mm",
  radio: "> 1 mm",
}

/**
 * Resolve how we observe a body. `kind` is the coarse category (planet, star,
 * comet, spacecraft, black-hole, nebula, galaxy, …); `name` lets a few specific
 * bodies override (e.g. the Sun, a pulsar). Returns null if we have nothing
 * honest to say — never guesses.
 */
export function howWeObserve(kind: string | undefined, name?: string): Observation | null {
  const n = (name ?? "").toLowerCase()

  // Specific overrides first.
  if (n.includes("sun")) return { bands: ["visible", "ultraviolet", "x-ray"], how: "The Sun floods every band — we watch it in visible light, ultraviolet, and X-rays to see its surface, flares, and million-degree corona." }
  if (n.includes("voyager") || n.includes("pioneer") || n.includes("new horizons")) return { bands: ["radio"], how: "Deep-space probes are found only by their faint radio signal — Voyager 1's 22-watt carrier takes 22+ hours to reach us and is picked up by giant dish antennas." }
  if (n.includes("pulsar") || n.includes("crab")) return { bands: ["radio", "x-ray"], how: "Pulsars are detected as clockwork radio pulses from a spinning neutron star; the youngest also flash in X-rays." }

  switch (kind) {
    case "planet":
    case "dwarf":
      return { bands: ["visible", "infrared"], how: "Planets shine by reflecting sunlight, so we see them in visible light; infrared reveals their heat and atmospheres." }
    case "moon":
      return { bands: ["visible"], how: "Moons reflect sunlight — we see them in visible light, the same way we see the planets." }
    case "comet":
      return { bands: ["visible", "infrared", "radio"], how: "A comet's coma and tails scatter sunlight (visible); infrared + radio reveal the water, dust and gas boiling off the nucleus." }
    case "asteroid":
    case "interstellar":
      return { bands: ["visible", "infrared"], how: "Small rocky bodies are seen by reflected sunlight; infrared measures their true size and how much heat they soak up." }
    case "spacecraft":
      return { bands: ["radio"], how: "Spacecraft are tracked by their radio downlink — we don't 'see' them, we listen to the signal they beam home." }
    case "star":
      return { bands: ["visible", "infrared", "ultraviolet"], how: "Stars are seen directly by their own light; the colour (blue-hot to red-cool) and spectrum tell us their temperature and makeup." }
    case "black-hole":
      return { bands: ["x-ray", "radio"], how: "A black hole emits nothing itself — we detect it by the X-rays from gas superheated as it spirals in, and radio jets blasted from the poles." }
    case "nebula":
      return { bands: ["infrared", "visible", "radio"], how: "Nebulae glow in visible light where young stars excite the gas; cold dust + molecular clouds show up in infrared and radio." }
    case "galaxy":
      return { bands: ["visible", "infrared", "radio"], how: "Galaxies are seen by the combined light of their stars (visible), their dust (infrared), and their hydrogen gas (radio)." }
    case "cluster":
      return { bands: ["visible", "x-ray"], how: "Star clusters shine in visible light; galaxy clusters also glow in X-rays from the hot gas trapped between the galaxies." }
    case "exoplanet-host":
      return { bands: ["visible", "infrared"], how: "We rarely see exoplanets directly — we detect them by the tiny dip in their star's visible light as they transit, and study their air in infrared." }
    default:
      return null
  }
}

/**
 * Infer the observe-kind from a body's free-text classification string (BodyInfo
 * only carries `classification`, not a machine kind). Deterministic keyword map —
 * covers the engine's real classification strings ("Terrestrial planet",
 * "Gas giant", "Supermassive black hole", "Barred spiral galaxy", …).
 */
export function kindFromClassification(classification: string | undefined): string | undefined {
  const c = (classification ?? "").toLowerCase()
  if (!c) return undefined
  if (c.includes("black hole")) return "black-hole"
  if (c.includes("galaxy")) return "galaxy"
  if (c.includes("nebula")) return "nebula"
  if (c.includes("cluster")) return "cluster"
  if (c.includes("comet")) return "comet"
  if (c.includes("asteroid") || c.includes("near-earth")) return "asteroid"
  if (c.includes("interstellar")) return "interstellar"
  if (c.includes("spacecraft") || c.includes("probe") || c.includes("nasa") || c.includes("esa")) return "spacecraft"
  if (c.includes("dwarf planet") || c.includes("trans-neptunian") || c.includes("kuiper")) return "dwarf"
  if (c.includes("moon") || c.includes("satellite of")) return "moon"
  // Planet BEFORE the star check so "Gas giant" / "Ice giant" (planets) don't
  // get caught by the "giant" (stellar) keyword. Note the engine labels the
  // outer worlds "Gas giant" / "Ice giant" WITHOUT the word "planet".
  if (c.includes("planet") || c.includes("gas giant") || c.includes("ice giant")) return "planet"
  if (c.includes("host")) return "exoplanet-host"
  // Stars: spectral class codes (G2V, M2Ib, O5…) or explicit stellar words.
  if (/\b[obafgkm]\d/i.test(c) || c.includes("supergiant") || c.includes("main sequence") || c.includes("neutron") || c.includes("white dwarf") || c.includes("red giant") || c.includes(" star")) return "star"
  return undefined
}

/** Convenience: resolve the observation for a body from its card fields. */
export function observationFor(classification: string | undefined, name?: string): Observation | null {
  return howWeObserve(kindFromClassification(classification), name)
}
