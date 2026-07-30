/**
 * dna-tribes — curated, tribe/community-level ancestry reference for the DNA
 * tools' "surviving gene pool" view.
 *
 * WHY THIS EXISTS: modern national borders are NOT genetic units. The real
 * population-genetics structure of South Asia and its neighbours is a
 * continuous gradient built from a small set of deep ancestral components,
 * mixed in different proportions by COMMUNITY — caste, tribe, language,
 * region — not by country. A Sindhi and a Punjabi share almost the same
 * ancestral pool; so do a Bengali and an Odia. This tool shows those shared,
 * SURVIVING components rather than dividing people by nationality.
 *
 * MODEL (the honest, published one — NOT a company "you are X%" figure):
 * Narasimhan et al. 2019 (Science, "The formation of human populations in
 * South and Central Asia") and Reich-lab work model South Asians as mixtures
 * of a few sources. We use four readable components:
 *   • AASI  — Ancient Ancestral South Indian hunter-gatherer (the deepest,
 *             indigenous layer; no close modern proxy, highest in southern
 *             and tribal/Adivasi groups).
 *   • IRAN  — Iranian-related Neolithic farmer ancestry (from the northwest;
 *             the Indus/Harappan farming layer).
 *   • STEP  — Western Steppe pastoralist ancestry (Bronze-Age expansions;
 *             highest in the northwest and in traditionally priestly groups).
 *   • EASI  — East-Asian / Tibeto-Burman related (highest in the northeast
 *             and Himalayan belt).
 * Proportions here are ILLUSTRATIVE order-of-magnitude reads of the published
 * clines, rounded to sum to 100 — a teaching aid, never a personal result.
 *
 * Sources (all open / public): Narasimhan 2019 (Science) supplementary
 * qpAdm models; Reich et al. 2009 (Nature) ANI/ASI cline; 1000 Genomes
 * Project South Asian panels (GIH, PJL, BEB, STU, ITU); Lazaridis 2016.
 */

export type AncestryComponent = "AASI" | "IRAN" | "STEP" | "EASI"

export const COMPONENT_META: Record<
  AncestryComponent,
  { label: string; short: string; color: string; note: string }
> = {
  AASI: {
    label: "Ancient South Indian",
    short: "AASI",
    color: "#e0894b", // warm earth
    note: "The deepest indigenous hunter-gatherer layer of the subcontinent. No close modern proxy exists; it survives most strongly in southern and Adivasi (tribal) communities.",
  },
  IRAN: {
    label: "Iranian-farmer (Indus)",
    short: "IRAN",
    color: "#5aa9a3", // teal
    note: "Neolithic farmer ancestry related to the Iranian plateau — the Indus-Valley / Harappan farming layer that entered from the northwest.",
  },
  STEP: {
    label: "Steppe pastoralist",
    short: "STEPPE",
    color: "#7b8add", // steppe blue
    note: "Bronze-Age Western Steppe pastoralist ancestry from the great expansions; highest in the northwest and in some traditionally priestly communities.",
  },
  EASI: {
    label: "East-Asian / Tibeto-Burman",
    short: "EASI",
    color: "#c46fa0", // orchid
    note: "East-Asian-related ancestry, strongest in the northeast and the Himalayan belt through Tibeto-Burman and Austroasiatic communities.",
  },
}

export type Tribe = {
  id: string
  /** community / tribe / language-group name — the real genetic unit. */
  name: string
  /** the broad geography it sits in (for grouping + the map). */
  region: string
  /** rough map marker [lat, lng]. */
  at: [number, number]
  /** 1000 Genomes / study panel code where one applies (else omitted). */
  panel?: string
  /** illustrative component mix (sums to 100). */
  mix: Record<AncestryComponent, number>
  blurb: string
}

/**
 * The tribes / communities. Grouped loosely by geography but the POINT of the
 * tool is that neighbours across a border share the same pool — so the
 * northwest cluster (Sindhi/Punjabi/Baluch/Pashtun) sits together regardless
 * of which modern country a given community lives in.
 */
export const TRIBES: Tribe[] = [
  // — Northwest (the Indus gradient) —
  { id: "sindhi", name: "Sindhi", region: "Indus Valley", at: [26, 68], panel: "—", mix: { AASI: 22, IRAN: 45, STEP: 30, EASI: 3 }, blurb: "Lower Indus community; high Iranian-farmer ancestry, the Harappan heartland signal." },
  { id: "punjabi", name: "Punjabi", region: "Indus Valley", at: [31, 74], panel: "PJL", mix: { AASI: 25, IRAN: 40, STEP: 32, EASI: 3 }, blurb: "The Punjab plain either side of the border; the classic northwestern mix, close to the Sindhi pool." },
  { id: "baluch", name: "Baluch", region: "Indus Valley", at: [28, 65], mix: { AASI: 15, IRAN: 55, STEP: 27, EASI: 3 }, blurb: "Western frontier pastoralists; the highest Iranian-related share, blending toward the plateau." },
  { id: "pashtun", name: "Pashtun / Pathan", region: "Hindu Kush", at: [33, 70], mix: { AASI: 14, IRAN: 44, STEP: 39, EASI: 3 }, blurb: "Hindu-Kush communities; elevated steppe ancestry, continuous with Central Asia." },
  { id: "kashmiri", name: "Kashmiri", region: "Himalaya (west)", at: [34, 75], mix: { AASI: 20, IRAN: 42, STEP: 35, EASI: 3 }, blurb: "Vale-of-Kashmir community; northwestern pool with a Himalayan tilt." },

  // — North & Gangetic plain —
  { id: "jat", name: "Jat", region: "North India / Punjab", at: [29, 76], mix: { AASI: 28, IRAN: 36, STEP: 33, EASI: 3 }, blurb: "Agrarian community of the northwestern plains; strong steppe component." },
  { id: "brahmin-n", name: "Brahmin (North)", region: "Gangetic plain", at: [27, 80], mix: { AASI: 30, IRAN: 35, STEP: 32, EASI: 3 }, blurb: "Traditionally priestly community; among the higher steppe + Iranian shares in the north." },
  { id: "up-hindustani", name: "Hindustani (UP/Bihar)", region: "Gangetic plain", at: [26, 82], mix: { AASI: 42, IRAN: 33, STEP: 22, EASI: 3 }, blurb: "Central Gangetic communities — the middle of the AASI↔ANI cline." },

  // — East & Northeast —
  { id: "bengali", name: "Bengali", region: "Bengal delta", at: [23, 89], panel: "BEB", mix: { AASI: 45, IRAN: 25, STEP: 14, EASI: 16 }, blurb: "Delta communities either side of the border; a real East-Asian-related layer appears here." },
  { id: "odia", name: "Odia", region: "Eastern India", at: [20, 85], mix: { AASI: 52, IRAN: 24, STEP: 14, EASI: 10 }, blurb: "Coastal eastern community; shifted toward the deep AASI layer, close to the Bengali pool." },
  { id: "assamese", name: "Assamese / NE tribes", region: "Northeast India", at: [26, 93], mix: { AASI: 30, IRAN: 12, STEP: 6, EASI: 52 }, blurb: "Brahmaputra + hill communities; the strongest East-Asian / Tibeto-Burman signal in the subcontinent." },

  // — South (Dravidian + tribal) —
  { id: "tamil", name: "Tamil", region: "South India", at: [11, 78], panel: "STU", mix: { AASI: 55, IRAN: 30, STEP: 12, EASI: 3 }, blurb: "Dravidian-speaking community; toward the AASI end, with a strong Iranian-farmer layer." },
  { id: "telugu", name: "Telugu", region: "South India", at: [17, 79], panel: "ITU", mix: { AASI: 52, IRAN: 31, STEP: 14, EASI: 3 }, blurb: "Deccan Dravidian community; very close to the Tamil pool — a border makes no genetic difference." },
  { id: "gujarati", name: "Gujarati", region: "West India", at: [22, 72], panel: "GIH", mix: { AASI: 38, IRAN: 38, STEP: 21, EASI: 3 }, blurb: "Western coastal + inland communities; balanced AASI/Iranian, the 1000-Genomes GIH panel." },
  { id: "adivasi-s", name: "Adivasi (South/Central)", region: "Central India", at: [21, 81], mix: { AASI: 72, IRAN: 18, STEP: 7, EASI: 3 }, blurb: "Tribal communities (e.g. Gond, Paniya-like); the closest surviving proxy to the deep AASI layer." },

  // — Neighbouring pools (to show the gradient continues, not stops) —
  { id: "iranian-plateau", name: "Iranian plateau peoples", region: "Iran", at: [32, 53], mix: { AASI: 3, IRAN: 72, STEP: 22, EASI: 3 }, blurb: "West of the Indus the pool tips fully to Iranian-farmer + steppe — the same components, different weights." },
  { id: "central-asian", name: "Central Asian (Tajik/Uzbek)", region: "Central Asia", at: [40, 68], mix: { AASI: 4, IRAN: 40, STEP: 34, EASI: 22 }, blurb: "North of the Hindu Kush the East-Asian share climbs while Iranian + steppe persist — the northern edge of the same gradient." },
  { id: "sinhala", name: "Sinhala / Sri Lankan", region: "Sri Lanka", at: [7, 81], mix: { AASI: 50, IRAN: 30, STEP: 13, EASI: 7 }, blurb: "Island communities; essentially the South-Indian pool with its own drift — the gradient reaches the sea." },
]

/** Surviving/shared pool: for a chosen tribe, the OTHER tribes whose component
 *  mix is closest (smallest total absolute difference across components). These
 *  are the communities that share the most of the same surviving ancestry —
 *  usually the ones a modern border tries to separate. */
export function closestTribes(id: string, n = 4): { tribe: Tribe; sharedPct: number }[] {
  const self = TRIBES.find((t) => t.id === id)
  if (!self) return []
  const comps: AncestryComponent[] = ["AASI", "IRAN", "STEP", "EASI"]
  return TRIBES.filter((t) => t.id !== id)
    .map((t) => {
      // L1 distance across the 4 components (0–200). Shared% = the overlap:
      // 100 − (half the L1 distance) = how much of the pool they hold in common.
      const dist = comps.reduce((s, c) => s + Math.abs(self.mix[c] - t.mix[c]), 0)
      return { tribe: t, sharedPct: Math.round(100 - dist / 2) }
    })
    .sort((a, b) => b.sharedPct - a.sharedPct)
    .slice(0, n)
}

export function tribeById(id: string): Tribe | undefined {
  return TRIBES.find((t) => t.id === id)
}

/** Regions present, in a sensible display order (northwest → south → neighbours). */
export const TRIBE_REGION_ORDER = [
  "Indus Valley",
  "Hindu Kush",
  "Himalaya (west)",
  "North India / Punjab",
  "Gangetic plain",
  "West India",
  "Bengal delta",
  "Eastern India",
  "Northeast India",
  "Central India",
  "South India",
  "Sri Lanka",
  "Iran",
  "Central Asia",
]
