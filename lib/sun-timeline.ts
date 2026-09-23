/**
 * sun-timeline — the real history + future of the Sun and its effect on the
 * planets, as deterministic sourced data (no model, no invention).
 *
 * The engine's standard: real over invented, cite it, label inference as
 * inference. The numbers here are established solar/stellar astrophysics:
 *  - the Sun formed ~4.57 billion years ago (Gya) and joined the main sequence
 *    at ~70% of today's luminosity (the "faint young Sun");
 *  - it brightens ~1% per ~110 million years as helium builds in the core;
 *  - in ~1.0–1.1 Gyr its rising output crosses Earth's moist-greenhouse limit
 *    (oceans begin to boil away);
 *  - core hydrogen exhausts at ~+5 Gyr → subgiant → red giant (~+5.4 Gyr),
 *    swelling past Earth's orbit, engulfing Mercury & Venus (Earth debated);
 *  - it sheds a planetary nebula and ends as a white dwarf (~+7.6–8 Gyr).
 *
 * Luminosity model (Gough 1981, standard solar model): a good closed-form fit is
 *   L(t)/L_now ≈ 1 / (1 + 0.4·(1 − t/t_now))
 * where t is age since formation and t_now = 4.57 Gyr. This gives ~0.71 at
 * birth and 1.0 today — used only for the pre-red-giant main-sequence stretch;
 * the giant-phase values are quoted from stellar-evolution models, not this fit.
 */

export const SUN_AGE_NOW_GYR = 4.57

/** Main-sequence luminosity relative to today, from the Gough standard-model
 *  fit. `ageGyr` = age since the Sun formed. Valid up to core-H exhaustion
 *  (~10–11 Gyr); beyond that the giant phase is quoted, not fitted. */
export function solarLuminosityFraction(ageGyr: number): number {
  return 1 / (1 + 0.4 * (1 - ageGyr / SUN_AGE_NOW_GYR))
}

export type SunEra = {
  /** time relative to NOW, in billions of years (negative = past). */
  atGyrFromNow: number
  phase: string
  title: string
  /** luminosity vs today (× L☉_now); null in phases where a single value is
   *  meaningless (e.g. the brief flash of the giant tip). */
  lumVsNow: number | null
  detail: string
  /** what it means for the planets at this moment. */
  planets: string
  inference?: boolean
}

/** The Sun's arc, past → deep future, as sourced eras. */
export const SUN_ERAS: SunEra[] = [
  {
    atGyrFromNow: -4.57,
    phase: "Formation",
    title: "A cloud collapses",
    lumVsNow: null,
    detail:
      "The Sun condenses from a molecular cloud; the core reaches ~15 million K and hydrogen fusion ignites. It joins the main sequence as a G-type star.",
    planets: "The protoplanetary disk is still forming the planets from leftover gas and dust.",
  },
  {
    atGyrFromNow: -4.0,
    phase: "Faint young Sun",
    title: "Only ~71% as bright",
    lumVsNow: 0.71,
    detail:
      "The young Sun shines at roughly 70% of today's luminosity. With a fainter Sun, Earth should have frozen — the 'faint young Sun paradox' — yet there was liquid water, kept warm by a much thicker greenhouse atmosphere.",
    planets: "Early Earth has oceans despite the dimmer Sun; Mars may have had liquid water too.",
  },
  {
    atGyrFromNow: 0,
    phase: "Main sequence · now",
    title: "A stable G2V star",
    lumVsNow: 1.0,
    detail:
      "Today: surface ~5,772 K, core ~15 million K, steadily fusing ~600 million tonnes of hydrogen into helium every second. Middle-aged and stable.",
    planets: "Earth sits comfortably in the habitable zone. The zone spans roughly 0.95–1.7 AU.",
  },
  {
    atGyrFromNow: 1.0,
    phase: "Brightening",
    title: "Oceans begin to boil",
    lumVsNow: 1.1,
    detail:
      "The Sun brightens ~1% every ~110 million years. In about a billion years its output crosses Earth's moist-greenhouse limit: rising water vapour drives a runaway greenhouse and the oceans start to evaporate.",
    planets:
      "Earth likely becomes uninhabitable — long before the Sun dies. The habitable zone has migrated outward, briefly favouring Mars's position.",
    inference: true,
  },
  {
    atGyrFromNow: 3.5,
    phase: "Late main sequence",
    title: "A hotter, brighter Sun",
    lumVsNow: 1.4,
    detail:
      "Helium keeps accumulating in the core, which contracts and heats, so fusion runs faster and the Sun keeps brightening toward the end of its hydrogen-burning life.",
    planets: "Earth is a scorched, desiccated world. The outer solar system slowly warms.",
    inference: true,
  },
  {
    atGyrFromNow: 5.0,
    phase: "Subgiant → red giant",
    title: "Core hydrogen runs out",
    lumVsNow: 3,
    detail:
      "With core hydrogen exhausted, fusion moves to a shell around an inert helium core. The Sun leaves the main sequence, swelling and cooling at the surface as it climbs the red-giant branch.",
    planets: "The inner solar system is being enveloped in an expanding, reddening Sun.",
    inference: true,
  },
  {
    atGyrFromNow: 5.4,
    phase: "Red giant tip",
    title: "Swells past Earth's orbit",
    lumVsNow: 2000,
    detail:
      "At the red-giant tip the Sun balloons to ~200× its current radius and thousands of times brighter, reaching roughly 1 AU. It also sheds mass, so the planets' orbits widen — which is why Earth's survival is genuinely debated.",
    planets:
      "Mercury and Venus are engulfed and destroyed. Earth is either swallowed or left a molten, airless cinder just outside. Far out, Jupiter's and Saturn's icy moons (Europa, Titan, Enceladus) may briefly thaw.",
    inference: true,
  },
  {
    atGyrFromNow: 7.6,
    phase: "Planetary nebula",
    title: "The outer layers drift away",
    lumVsNow: null,
    detail:
      "The Sun sheds its outer envelope into a glowing planetary nebula, exposing the hot, dense core. Fusion ends.",
    planets: "The surviving outer planets orbit through the expanding, fading shell of gas.",
    inference: true,
  },
  {
    atGyrFromNow: 8.0,
    phase: "White dwarf",
    title: "An Earth-sized cinder",
    lumVsNow: 0.001,
    detail:
      "All that remains is a white dwarf — the Sun's core, about the size of Earth but half its original mass, no longer fusing. It will cool and dim over trillions of years.",
    planets:
      "The remaining planets orbit a slowly-cooling ember. The solar system goes dark and cold.",
    inference: true,
  },
]

/** Each planet's ultimate fate as the Sun evolves — sourced, honest. */
export const PLANET_FATES: { name: string; fate: string }[] = [
  { name: "Mercury", fate: "Engulfed by the red-giant Sun and destroyed." },
  { name: "Venus", fate: "Engulfed by the red-giant Sun and destroyed." },
  { name: "Earth", fate: "Oceans boil in ~1 Gyr; then either swallowed by the red giant or left a barren cinder — debated." },
  { name: "Mars", fate: "Briefly in a warmer zone as the Sun brightens, but too small to hold air; baked in the giant phase." },
  { name: "Jupiter", fate: "Loses some atmosphere to intense radiation; survives to orbit the white dwarf." },
  { name: "Saturn", fate: "Survives; its moon Titan may briefly get temperate surface conditions during the giant phase." },
  { name: "Uranus", fate: "Survives, warmed but intact; orbits the white-dwarf remnant." },
  { name: "Neptune", fate: "Survives in the cold outer system; outlives the Sun's fusion life." },
]

/** Past-habitability notes — the honest, sometimes counter-intuitive story of
 *  whether the inner planets could have hosted life when the Sun was fainter.
 *  The faint young Sun moved the habitable zone INWARD, not outward — so it
 *  helps the case for early Venus, while early Mars stayed warm via its
 *  atmosphere, not the Sun. Stated carefully, sourced, inference labelled. */
export const PAST_HABITABILITY: { name: string; note: string }[] = [
  {
    name: "Venus",
    note:
      "Counter-intuitively, the FAINTER early Sun helps here: climate models (NASA GISS, Way et al. 2016) suggest Venus may have held liquid-water oceans and temperate conditions for up to ~2–3 billion years, only tipping into its runaway greenhouse later as the Sun brightened. Early Venus is a real candidate for past habitability.",
  },
  {
    name: "Mars",
    note:
      "Strong evidence (river valleys, lakebeds, clays) shows early Mars (~3.5–4 Gya) had liquid water — but the faint young Sun made it COLDER, not warmer. Mars was kept warm by a thick CO₂/greenhouse atmosphere it later lost to space. Past habitability is plausible; it was despite the dim Sun, not because of it.",
  },
  {
    name: "Earth",
    note:
      "Life arose while the Sun was ~20–25% fainter than today. Earth stayed liquid thanks to a stronger greenhouse (more CO₂/CH₄) — the resolution of the 'faint young Sun paradox'.",
  },
]

/** Sources for the timeline — surfaced in the panel + credited. */
export const SUN_TIMELINE_SOURCES = [
  "Gough (1981), Solar Physics — standard solar-model luminosity evolution",
  "Sackmann, Boothroyd & Kraemer (1993), ApJ — the Sun's future as a red giant",
  "Schröder & Connon Smith (2008), MNRAS — 'Distant future of the Sun and Earth revisited'",
  "NASA / solar physics — present-day solar parameters",
]
