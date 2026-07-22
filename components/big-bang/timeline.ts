/**
 * The cosmic timeline — the scientific spine of the Big Bang scene.
 *
 * Real epochs of the universe, with their actual timestamps and the physics of
 * each. The scene scrubs across `tLog` (log10 of time-since-Big-Bang in seconds),
 * because the history spans ~60 orders of magnitude — from the Planck time
 * (10^-43 s) to today (~4.35 × 10^17 s) — so only a logarithmic axis can show it.
 *
 * Values follow the standard ΛCDM / hot-Big-Bang chronology (Planck-era physics,
 * inflation, the quark epoch, recombination at ~380,000 yr giving the CMB, the
 * cosmic dark ages, first stars/reionization, galaxies, and today). Where the
 * science is genuinely unknown (the singularity itself, pre-inflation), the epoch
 * is marked `speculative` so the UI can say so honestly.
 *
 * No React / no Three here — pure data + helpers.
 */

export type Epoch = {
  id: string
  name: string
  /** seconds after the Big Bang (representative start of the epoch) */
  timeSeconds: number
  /** human label for the moment, e.g. "10⁻³² s" or "380,000 years" */
  timeLabel: string
  /** representative temperature of the universe (Kelvin) */
  tempK: number
  tempLabel: string
  /** one-line headline */
  headline: string
  /** the physics, in plain words (2–3 sentences) */
  detail: string
  /** parts of this epoch that are genuinely unknown / theoretical */
  speculative?: boolean
  /** visual hint for the renderer (drives palette + density) */
  visual: {
    palette: [string, string, string] // hot → mid → cool
    density: number                    // 0..1 particle/structure density
    chaos: number                      // 0..1 turbulence
  }
}

// log10(seconds). Planck time ≈ 10^-43.27 s; today ≈ 13.79 Gyr ≈ 4.35e17 s.
export const T_LOG_MIN = -43
export const T_LOG_MAX = 17.64

export function secToLog(sec: number): number {
  return Math.log10(Math.max(sec, 1e-44))
}

/** The epochs, in order. timeSeconds is each epoch's representative start. */
export const EPOCHS: Epoch[] = [
  {
    id: "planck",
    name: "Planck Epoch",
    timeSeconds: 1e-43,
    timeLabel: "0 – 10⁻⁴³ s",
    tempK: 1.4e32,
    tempLabel: "~10³² K",
    headline: "Before time as we know it.",
    detail:
      "The universe is smaller than a particle and hotter than anything since. " +
      "All four forces — gravity, electromagnetism, the strong and weak nuclear " +
      "forces — are unified. Known physics breaks down here; we have no tested " +
      "theory of quantum gravity to describe it.",
    speculative: true,
    visual: { palette: ["#ffffff", "#ffd9a0", "#9b6bff"], density: 1, chaos: 1 },
  },
  {
    id: "inflation",
    name: "Inflation",
    timeSeconds: 1e-36,
    timeLabel: "10⁻³⁶ – 10⁻³² s",
    tempK: 1e28,
    tempLabel: "~10²⁸ K",
    headline: "Space itself expands faster than light.",
    detail:
      "In a fraction of a fraction of a second, the universe balloons by a factor " +
      "of ~10²⁶. This 'inflation' smooths the cosmos flat and stretches quantum " +
      "fluctuations into the seeds of all future galaxies — the pattern later " +
      "frozen into the cosmic microwave background.",
    visual: { palette: ["#fff3d6", "#ff9d5c", "#6f4cf0"], density: 0.9, chaos: 0.9 },
  },
  {
    id: "quark",
    name: "Quark Epoch",
    timeSeconds: 1e-12,
    timeLabel: "10⁻¹² – 10⁻⁶ s",
    tempK: 1e15,
    tempLabel: "~10¹⁵ K",
    headline: "A boiling soup of quarks and gluons.",
    detail:
      "The forces have split apart. The universe is a quark–gluon plasma — far too " +
      "hot for quarks to bind into protons or neutrons. Matter and antimatter " +
      "annihilate; a tiny asymmetry leaves the sliver of matter that everything " +
      "is made of today.",
    visual: { palette: ["#ffe08a", "#ff7a3c", "#c23bd8"], density: 0.95, chaos: 0.8 },
  },
  {
    id: "nucleosynthesis",
    name: "Nucleosynthesis",
    timeSeconds: 180,
    timeLabel: "~3 minutes",
    tempK: 1e9,
    tempLabel: "~10⁹ K",
    headline: "The first atomic nuclei form.",
    detail:
      "Cool enough now for protons and neutrons to fuse. In the first few minutes " +
      "the universe forges the lightest nuclei — about 75% hydrogen, 25% helium, " +
      "and a trace of lithium. These ratios, observed today, are a key confirmation " +
      "of the hot Big Bang.",
    visual: { palette: ["#ffd27a", "#ff8a4a", "#a24fd0"], density: 0.7, chaos: 0.5 },
  },
  {
    id: "recombination",
    name: "Recombination",
    timeSeconds: 1.2e13, // ~380,000 yr
    timeLabel: "~380,000 years",
    tempK: 3000,
    tempLabel: "~3,000 K",
    headline: "The universe becomes transparent — first light.",
    detail:
      "Electrons finally join nuclei to form neutral atoms. Light, no longer " +
      "scattered by free electrons, streams freely for the first time. That " +
      "release is the Cosmic Microwave Background — the oldest light we can see, " +
      "still detectable everywhere today.",
    visual: { palette: ["#ffb870", "#d98a6a", "#5a6fd0"], density: 0.5, chaos: 0.25 },
  },
  {
    id: "darkages",
    name: "Cosmic Dark Ages",
    timeSeconds: 1.6e15, // ~50 Myr (precedes the first stars)
    timeLabel: "~0.4 – 100 million years",
    tempK: 60,
    tempLabel: "~60 K",
    headline: "Darkness, before the first stars.",
    detail:
      "No stars yet — only cooling clouds of neutral hydrogen and helium, gently " +
      "pulled together by gravity along the scaffolding of dark matter. The seeds " +
      "from inflation slowly grow into the first dense knots.",
    visual: { palette: ["#3a2a5a", "#241d40", "#0c0a1a"], density: 0.3, chaos: 0.15 },
  },
  {
    id: "firststars",
    name: "First Stars",
    timeSeconds: 3.2e15, // ~100 Myr
    timeLabel: "~100 – 400 million years",
    tempK: 30,
    tempLabel: "~30 K",
    headline: "Cosmic dawn — the first stars ignite.",
    detail:
      "The densest clouds collapse and ignite as the first stars: huge, brilliant, " +
      "short-lived. Their ultraviolet light reionizes the surrounding hydrogen, and " +
      "their deaths seed the cosmos with the first heavy elements — carbon, oxygen, " +
      "iron.",
    visual: { palette: ["#bfe0ff", "#7aa6ff", "#2a1f55"], density: 0.45, chaos: 0.3 },
  },
  {
    id: "galaxies",
    name: "Galaxies Form",
    timeSeconds: 3e16, // ~1 Gyr
    timeLabel: "~1 billion years",
    tempK: 20,
    tempLabel: "~20 K",
    headline: "Stars gather into the first galaxies.",
    detail:
      "Stars, gas, and dark matter merge into the first galaxies, which grow and " +
      "collide over billions of years into the grand spirals and ellipticals we " +
      "see now. The cosmic web — filaments and voids — takes shape.",
    visual: { palette: ["#d6c4ff", "#8a6cff", "#160f2e"], density: 0.6, chaos: 0.35 },
  },
  {
    id: "solarsystem",
    name: "Our Solar System",
    timeSeconds: 2.9e17, // ~9.2 Gyr after the Big Bang (≈ 4.6 Gyr ago)
    timeLabel: "~9.2 billion years",
    tempK: 4,
    tempLabel: "~4 K",
    headline: "A cloud collapses — the Sun, the Earth, and us.",
    detail:
      "In one arm of the Milky Way, a cloud enriched by earlier dying stars " +
      "collapses. The Sun ignites at its centre; the leftover disk clumps into the " +
      "planets — Mercury through Neptune — and, on the third rock, Earth. Every atom " +
      "heavier than helium in your body was forged in stars that lived and died " +
      "before this moment.",
    visual: { palette: ["#ffe6b0", "#ffae5c", "#2a3a7a"], density: 0.72, chaos: 0.28 },
  },
  {
    id: "earthforms",
    name: "Earth Forms",
    timeSeconds: 2.907e17, // ~9.213 Gyr after BB — Earth accretes ~4.54 Gya
    timeLabel: "~9.21 billion years",
    tempK: 1800,
    tempLabel: "molten surface",
    headline: "A molten world takes shape.",
    detail:
      "Dust and rock in the young Sun's disk collide and stick, growing from grains " +
      "to boulders to planetesimals to a planet in a few tens of millions of years. " +
      "Heat from accretion and radioactive decay keeps early Earth molten — a magma " +
      "ocean with no crust, no air you could breathe, no water yet. Iron sinks to the " +
      "centre and forms the core (4.54 billion years ago; the oldest meteorites and " +
      "lunar samples date this).",
    visual: { palette: ["#ffd08a", "#c0491f", "#1a0f0a"], density: 0.74, chaos: 0.42 },
  },
  {
    id: "moonimpact",
    name: "The Moon Is Born",
    timeSeconds: 2.909e17, // ~60–100 Myr after Earth forms (~4.47 Gya)
    timeLabel: "~9.24 billion years",
    tempK: 2500,
    tempLabel: "impact fireball",
    headline: "A Mars-sized world strikes Earth.",
    detail:
      "About 60–100 million years after Earth forms, a Mars-sized protoplanet — " +
      "called Theia — slams into it. The collision nearly re-melts the planet and " +
      "throws a disk of vaporised rock into orbit, which coalesces into the Moon " +
      "(the leading 'giant-impact' model; Apollo samples show Earth and Moon share " +
      "the same oxygen-isotope fingerprint). The Moon's tug stabilises Earth's tilt, " +
      "steadying the seasons for billions of years to come.",
    visual: { palette: ["#fff0c0", "#e0662a", "#20120c"], density: 0.8, chaos: 0.5 },
  },
  {
    id: "water",
    name: "The Oceans Arrive",
    timeSeconds: 2.93e17, // ~4.4–4.0 Gya — earliest liquid water
    timeLabel: "~9.4 billion years",
    tempK: 350,
    tempLabel: "steam → rain",
    headline: "The world cools, and it rains for ages.",
    detail:
      "As the surface cools below the boiling point, water vapour outgassed from the " +
      "interior — and delivered by icy comets and water-rich asteroids during the " +
      "heavy bombardment — condenses and falls as rain that lasts millennia, filling " +
      "the first oceans. Zircon crystals from Western Australia (the Jack Hills, up to " +
      "4.4 billion years old) show liquid water existed astonishingly early. Water: " +
      "the one ingredient that makes everything after this possible.",
    visual: { palette: ["#9fd8ff", "#2f6fae", "#081726"], density: 0.72, chaos: 0.34 },
  },
  {
    id: "life",
    name: "Life Begins",
    timeSeconds: 3.06e17, // ~3.8–3.5 Gya — first microbial life
    timeLabel: "~9.7 billion years",
    tempK: 300,
    tempLabel: "warm seas",
    headline: "In the water, chemistry becomes biology.",
    detail:
      "In warm, mineral-rich water — likely around hydrothermal vents on the sea floor " +
      "— simple chemistry crosses the line into self-copying life. The oldest widely " +
      "accepted microfossils and chemical traces of life are ~3.5 billion years old, " +
      "with contested hints reaching ~3.8 billion. For the next two billion years, all " +
      "life on Earth is single-celled and invisible — but it's already rewriting the " +
      "planet.",
    visual: { palette: ["#7fe6c0", "#1f7a63", "#04140f"], density: 0.68, chaos: 0.3 },
  },
  {
    id: "oxygen",
    name: "The Air Turns Blue",
    timeSeconds: 3.5e17, // ~2.4 Gya — Great Oxidation Event
    timeLabel: "~11.4 billion years",
    tempK: 288,
    tempLabel: "15 °C",
    headline: "Microbes learn to breathe out oxygen.",
    detail:
      "Cyanobacteria invent photosynthesis and begin flooding the air and oceans with " +
      "oxygen — the Great Oxidation Event, ~2.4 billion years ago. It's a catastrophe " +
      "for most life then (oxygen is toxic to it) but it paints the sky blue, builds " +
      "the ozone layer that shields the surface, and opens the door to complex, " +
      "energy-hungry cells. Banded-iron rock formations worldwide record the moment " +
      "the oceans rusted.",
    visual: { palette: ["#bfe8ff", "#3f8fbf", "#0a1c2a"], density: 0.7, chaos: 0.26 },
  },
  {
    id: "complexlife",
    name: "Complex Life",
    timeSeconds: 4.19e17, // ~540 Mya — Cambrian explosion
    timeLabel: "~13.25 billion years",
    tempK: 288,
    tempLabel: "15 °C",
    headline: "Life explodes into animals.",
    detail:
      "After billions of years of microbes, cells team up. The Cambrian explosion " +
      "(~540 million years ago) fills the seas with the first animals — eyes, shells, " +
      "spines, predators and prey. Life moves onto land; forests, dinosaurs, and " +
      "mammals follow. A mass extinction 66 million years ago (an asteroid off " +
      "Yucatán) clears the way for mammals — and, eventually, for us.",
    visual: { palette: ["#c9e6a0", "#4f8f3f", "#0c1a08"], density: 0.72, chaos: 0.24 },
  },
  {
    id: "humans",
    name: "We Look Up",
    timeSeconds: 4.349e17, // ~300,000 ya — anatomically modern humans
    timeLabel: "~13.79 billion years",
    tempK: 288,
    tempLabel: "15 °C",
    headline: "Star-stuff that wonders where it came from.",
    detail:
      "Anatomically modern humans appear only ~300,000 years ago — the last blink of " +
      "cosmic time. Every atom of calcium in your bones, iron in your blood, oxygen " +
      "you breathe was forged inside stars that died before the Sun was born. We are " +
      "the universe grown able to look back at itself and ask how it all began — which " +
      "is exactly what this timeline is.",
    visual: { palette: ["#e8f0ff", "#6b86c8", "#070a14"], density: 0.7, chaos: 0.22 },
  },
  {
    id: "today",
    name: "Today",
    timeSeconds: 4.35e17, // 13.79 Gyr
    timeLabel: "13.8 billion years",
    tempK: 2.725,
    tempLabel: "2.725 K",
    headline: "Here. Now. Looking back.",
    detail:
      "The universe is vast, cold, and still expanding — accelerating, driven by " +
      "dark energy. Its background glow has cooled to just 2.725 K. On one small " +
      "world, matter forged in dead stars became able to wonder where it all came " +
      "from.",
    visual: { palette: ["#cfe6ff", "#5577cc", "#05060d"], density: 0.7, chaos: 0.2 },
  },
]

/** Interpolate a 0..1 progress across the whole log-time axis to an epoch index. */
export function epochAtLog(tLog: number): { index: number; epoch: Epoch; next?: Epoch; frac: number } {
  let i = 0
  for (let k = 0; k < EPOCHS.length; k++) {
    if (secToLog(EPOCHS[k].timeSeconds) <= tLog) i = k
  }
  const epoch = EPOCHS[i]
  const next = EPOCHS[i + 1]
  const a = secToLog(epoch.timeSeconds)
  const b = next ? secToLog(next.timeSeconds) : T_LOG_MAX
  const frac = b > a ? Math.min(1, Math.max(0, (tLog - a) / (b - a))) : 0
  return { index: i, epoch, next, frac }
}

/**
 * Slider position (0..1) of an epoch — EPOCH-UNIFORM: each of the N epochs owns
 * an equal 1/(N-1) slice of the track. A pure log-time axis crushed the recent
 * chapters (Earth → water → life → us all live in the last 0.006% of log-time,
 * unreachable by the slider). Uniform spacing gives every chapter equal room so
 * you can actually visit "The Oceans Arrive" and "Life Begins".
 */
export function epochToProgress(index: number): number {
  const n = EPOCHS.length
  if (n <= 1) return 0
  return Math.min(1, Math.max(0, index / (n - 1)))
}

/**
 * Map the scrub slider (0..1) to a log-time value. Epoch-uniform: p is split
 * into (N-1) equal segments; inside each we interpolate log-time linearly
 * between that epoch and the next, so the field still morphs smoothly while the
 * slider dwells fairly on every chapter.
 */
export function progressToLog(p: number): number {
  const n = EPOCHS.length
  const pc = Math.min(1, Math.max(0, p))
  if (n <= 1) return secToLog(EPOCHS[0]?.timeSeconds ?? 1)
  const seg = pc * (n - 1)
  const i = Math.min(n - 2, Math.floor(seg))
  const frac = seg - i
  const a = secToLog(EPOCHS[i].timeSeconds)
  const b = secToLog(EPOCHS[i + 1].timeSeconds)
  return a + (b - a) * frac
}
