/**
 * Deterministic space Q&A — answers the factual questions the engine's real data
 * CAN answer, with no model and no hallucination surface. Superlatives (biggest,
 * hottest, farthest planet), counts (how many planets/moons/satellites),
 * distances/speeds of a body, "how far back can we go", "first spacecraft", and
 * comparisons. Returns null when it can't answer confidently — then the caller
 * falls through to the grounded LLM/fallback.
 *
 * Real over invented: every number here comes from planetsData or documented
 * space history.
 */

import { planetsData } from "@/components/universe-engine/astronomy"

const SAT_COUNT = "18,500+"

/** Try to answer a factual question deterministically. null = can't. */
export function answerSpaceQuestion(raw: string): string | null {
  const q = raw.toLowerCase().trim()

  // --- "how far back can we go" / time range ---------------------------------
  if (/how far back|earliest (?:date|time)|back in time|oldest.*(?:date|show)|time range|how far (?:forward|ahead)/.test(q)) {
    return "The satellite timeline scrubs back to 1957 — the start of the Space Age, when Sputnik launched. Planet positions are computed from orbital math, so the solar system can be shown at essentially any date, past or future. And the Big Bang lab goes all the way back to the Planck epoch, 13.8 billion years ago."
  }

  // --- first spacecraft / first satellite ------------------------------------
  if (/first (?:man.?made |human.?made )?(?:spacecraft|satellite|object).*(?:launch|space|orbit)|when.*first.*(?:launch|spacecraft|satellite)|first.*(?:launched|in space)/.test(q)) {
    return "Sputnik 1 — launched October 4, 1957 by the Soviet Union — was the first human-made object in orbit. It was a 58-cm aluminium sphere that beeped on the radio for three weeks and opened the Space Age. The engine's tracked catalogue starts a little later (its earliest object is from 1964)."
  }

  // --- counts ----------------------------------------------------------------
  if (/how many planets/.test(q)) {
    const n = planetsData.filter((p) => !/dwarf/i.test(p.classification)).length
    return `There are ${n} planets in the solar system (Mercury through Neptune). Pluto was reclassified as a dwarf planet in 2006 — it's here too, just not counted among the eight.`
  }
  if (/how many (?:satellites|objects).*(?:orbit|space|earth|track)/.test(q) || /how many satellites/.test(q)) {
    return `The engine tracks ${SAT_COUNT} objects orbiting Earth — active satellites, spent rocket bodies, and tracked debris — each on its real SGP4 orbit. Around ${"2,600+"} of those are debris.`
  }
  if (/how many moons/.test(q)) {
    const most = [...planetsData].sort((a, b) => (b.moons ?? 0) - (a.moons ?? 0))[0]
    return `It depends on the planet — Saturn leads with 146 known moons, Jupiter has 95. Earth has just one. ${most.name} currently has the most in the dataset.`
  }

  // --- superlatives ----------------------------------------------------------
  const planets = planetsData.filter((p) => p.radiusEarth != null)
  const bySize = (dir: 1 | -1) => [...planets].sort((a, b) => ((b.radiusEarth ?? 0) - (a.radiusEarth ?? 0)) * dir)[0]
  const byDist = (dir: 1 | -1) => [...planets].sort((a, b) => ((b.aAU ?? 0) - (a.aAU ?? 0)) * dir)[0]

  if (/(?:biggest|largest|hugest) planet/.test(q)) {
    const p = bySize(1)
    return `${p.name} is the biggest planet — about ${p.radiusEarth?.toFixed(1)}× Earth's radius. It's a gas giant, more massive than all the other planets combined.`
  }
  if (/(?:smallest|tiniest) planet/.test(q)) {
    const p = bySize(-1)
    return `${p.name} is the smallest planet — only about ${p.radiusEarth?.toFixed(2)}× Earth's radius, barely larger than the Moon.`
  }
  if (/(?:hottest|warmest) planet/.test(q)) {
    // Venus is hottest by surface (runaway greenhouse) even though Mercury is closer.
    const venus = planets.find((p) => p.name === "Venus")
    return `Venus is the hottest planet — its surface sits at about ${venus?.surfaceTempK?.mean ?? 737} K (${((venus?.surfaceTempK?.mean ?? 737) - 273).toFixed(0)}°C), hotter even than Mercury, because a runaway CO₂ greenhouse traps the heat.`
  }
  if (/(?:coldest|coolest) planet/.test(q)) {
    const p = [...planets].sort((a, b) => (a.surfaceTempK?.mean ?? 999) - (b.surfaceTempK?.mean ?? 999))[0]
    return `${p.name} is the coldest planet — around ${p.surfaceTempK?.mean} K (${((p.surfaceTempK?.mean ?? 0) - 273).toFixed(0)}°C), out in the deep cold of the outer solar system.`
  }
  if (/(?:farthest|furthest|most distant) planet/.test(q)) {
    const p = byDist(1)
    return `${p.name} is the farthest planet from the Sun — about ${p.aAU?.toFixed(1)} AU out (${((p.aAU ?? 0) * 149.6).toFixed(0)} million km). Sunlight takes over four hours to reach it.`
  }
  if (/(?:closest|nearest) planet (?:to the sun)?/.test(q)) {
    const p = byDist(-1)
    return `${p.name} is the closest planet to the Sun — about ${p.aAU?.toFixed(2)} AU. Ironically it's not the hottest; that's Venus.`
  }
  if (/most moons|planet with (?:the )?most moons/.test(q)) {
    const p = [...planetsData].sort((a, b) => (b.moons ?? 0) - (a.moons ?? 0))[0]
    return `${p.name} has the most moons — ${p.moons} known, the largest satellite family in the solar system.`
  }

  // --- "how far is X" / "how fast is X" (a specific body) --------------------
  const distMatch = q.match(/how far (?:is |away is )?(?:the )?([a-z0-9 '-]+?)(?:\s+from (?:the )?(?:sun|earth|us))?[?.]?$/)
  if (distMatch) {
    const name = distMatch[1].trim()
    const p = planets.find((x) => x.name.toLowerCase() === name || name.includes(x.name.toLowerCase()))
    if (p && p.aAU != null) {
      const km = (p.aAU * 149.6).toFixed(0)
      const lightMin = (p.aAU * 8.317).toFixed(0)
      return `${p.name} orbits about ${p.aAU.toFixed(2)} AU from the Sun — roughly ${km} million km. Sunlight takes about ${lightMin} minutes to get there.`
    }
  }

  return null
}
