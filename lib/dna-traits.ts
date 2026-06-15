/**
 * Curated trait-marker panel for the DNA page.
 *
 * SCOPE & ETHICS — read before adding markers:
 *   - Diet / nutrition / wellness traits ONLY. No disease-risk, no diagnoses,
 *     no carrier status, no BRCA / APOE / late-onset-disease prediction.
 *   - Everything here is informational genetics with well-replicated effects.
 *     A genotyping chip is not a clinical test; the UI carries a "not medical
 *     advice" disclaimer and this module must never imply otherwise.
 *
 * HOW IT WORKS:
 *   scripts/encrypt-dna.mjs looks up each marker's rsID in the raw CSV, reads
 *   the genotype, and ships only { id, genotype } (no rsID/position) inside the
 *   encrypted blob. The interpretation copy lives here, keyed by the normalized
 *   genotype, so wording can be refined without re-encrypting.
 *
 * NORMALIZATION:
 *   MyHeritage reports two alleles in arbitrary order ("GA" == "AG"). We sort
 *   the two letters alphabetically before matching, so define `outcomes` keys
 *   with sorted genotypes (e.g. "AG", not "GA"). All markers below are defined
 *   on the forward (+) strand to match MyHeritage build37.
 */

export type TraitCategory = "diet" | "wellness"

export type TraitOutcome = {
  /** Short verdict shown as the headline result, e.g. "Likely lactose intolerant". */
  label: string
  /** One-to-two sentence plain-language explanation. */
  detail: string
  /** Rough tone for the result chip. */
  tone: "neutral" | "notable"
}

export type TraitMarker = {
  id: string
  rsid: string
  category: TraitCategory
  /** Human title, e.g. "Lactose tolerance". */
  title: string
  /** The gene most associated, for the curious. */
  gene: string
  /** What this trait is about, shown above the result. */
  about: string
  /** genotype (alleles sorted A→T) -> outcome. */
  outcomes: Record<string, TraitOutcome>
}

/** Sort the two alleles so "GA" and "AG" both match the "AG" key. */
export function normalizeGenotype(g: string): string {
  return g.toUpperCase().split("").sort().join("")
}

export const TRAIT_MARKERS: TraitMarker[] = [
  // ---------------------------------------------------------------- diet -----
  {
    id: "lactose",
    rsid: "rs4988235",
    category: "diet",
    title: "Lactose tolerance",
    gene: "MCM6 / LACTASE",
    about:
      "Whether your body keeps producing lactase — the enzyme that digests milk sugar — into adulthood.",
    outcomes: {
      AA: { label: "Lactase persistent", detail: "Two copies of the persistence variant — your body typically keeps digesting dairy comfortably as an adult.", tone: "neutral" },
      AG: { label: "Likely tolerant", detail: "One persistence copy — usually enough to digest dairy, though tolerance can vary.", tone: "neutral" },
      GG: { label: "Likely lactose intolerant", detail: "No persistence variant — lactase production often declines after childhood, so dairy may cause discomfort. Common across much of the world.", tone: "notable" },
    },
  },
  {
    id: "caffeine",
    rsid: "rs762551",
    category: "diet",
    title: "Caffeine metabolism",
    gene: "CYP1A2",
    about: "How quickly your liver clears caffeine from your system.",
    outcomes: {
      AA: { label: "Fast metabolizer", detail: "You clear caffeine quickly — coffee tends to hit and leave faster, and is less likely to disrupt sleep when not too late in the day.", tone: "neutral" },
      AC: { label: "Slow metabolizer", detail: "You clear caffeine more slowly — effects linger longer, so afternoon coffee is more likely to affect sleep.", tone: "notable" },
      CC: { label: "Slow metabolizer", detail: "Caffeine stays in your system noticeably longer — sensitivity and sleep disruption are more likely.", tone: "notable" },
    },
  },
  {
    id: "alcohol-flush",
    rsid: "rs671",
    category: "diet",
    title: "Alcohol flush response",
    gene: "ALDH2",
    about:
      "The 'Asian flush' — whether you break down alcohol's toxic byproduct (acetaldehyde) efficiently.",
    outcomes: {
      GG: { label: "No flush variant", detail: "Normal ALDH2 activity — you don't carry the variant that causes facial flushing and nausea from alcohol.", tone: "neutral" },
      AG: { label: "Partial flush response", detail: "One reduced-activity copy — alcohol can cause flushing, faster intoxication, and stronger hangovers.", tone: "notable" },
      AA: { label: "Strong flush response", detail: "Very low ALDH2 activity — alcohol causes pronounced flushing and discomfort, and tolerance is typically low.", tone: "notable" },
    },
  },
  {
    id: "alcohol-metab",
    rsid: "rs1229984",
    category: "diet",
    title: "Alcohol metabolism rate",
    gene: "ADH1B",
    about: "How fast the first step of alcohol breakdown runs.",
    outcomes: {
      CC: { label: "Typical metabolism", detail: "Standard ADH1B activity — alcohol is broken down at the usual rate.", tone: "neutral" },
      CT: { label: "Faster first-step", detail: "One fast variant — the first step of alcohol breakdown runs quicker, which can mean more flush-like effects.", tone: "neutral" },
      TT: { label: "Fast first-step", detail: "Fast ADH1B activity — alcohol's first breakdown step is rapid.", tone: "neutral" },
    },
  },
  {
    id: "carb-weight",
    rsid: "rs9939609",
    category: "diet",
    title: "Appetite & weight response",
    gene: "FTO",
    about:
      "The most-studied common variant linked to appetite regulation and body weight.",
    outcomes: {
      TT: { label: "Lower-risk variant", detail: "Not associated with the increased-appetite effect — the most favourable FTO genotype for weight regulation.", tone: "neutral" },
      AT: { label: "Intermediate", detail: "One appetite-associated copy — a modest tendency toward higher appetite; responds well to protein and activity.", tone: "neutral" },
      AA: { label: "Higher-appetite variant", detail: "Two copies associated with slightly higher appetite and weight — diet and exercise still dominate the outcome.", tone: "notable" },
    },
  },
  {
    id: "blood-sugar",
    rsid: "rs7903146",
    category: "diet",
    title: "Carbohydrate sensitivity",
    gene: "TCF7L2",
    about: "A variant linked to how the body manages blood sugar after carbs.",
    outcomes: {
      CC: { label: "Typical response", detail: "Not associated with the carb-sensitivity variant.", tone: "neutral" },
      CT: { label: "Mild sensitivity", detail: "One copy linked to slightly less efficient blood-sugar handling — fibre and balanced meals help.", tone: "neutral" },
      TT: { label: "Higher sensitivity", detail: "Two copies linked to less efficient blood-sugar regulation — pairing carbs with protein/fibre and staying active is especially worthwhile.", tone: "notable" },
    },
  },
  {
    id: "bitter-taste",
    rsid: "rs1726866",
    category: "diet",
    title: "Bitter taste perception",
    gene: "TAS2R38",
    about:
      "How strongly you taste bitter compounds — which shapes feelings about brassica veg, coffee, and dark greens.",
    outcomes: {
      AA: { label: "Strong taster", detail: "You likely perceive bitterness intensely — broccoli, kale, and coffee can taste sharply bitter.", tone: "notable" },
      AG: { label: "Medium taster", detail: "Moderate bitter sensitivity — you notice bitterness but it's rarely overwhelming.", tone: "neutral" },
      GG: { label: "Non-taster", detail: "You're relatively insensitive to these bitter compounds — bitter veg and coffee taste milder to you.", tone: "neutral" },
    },
  },
  {
    id: "fatty-acids",
    rsid: "rs174547",
    category: "diet",
    title: "Omega fatty-acid processing",
    gene: "FADS1",
    about:
      "How well you convert plant-based ALA into the long-chain omega-3s (EPA/DHA) the body uses.",
    outcomes: {
      TT: { label: "Efficient converter", detail: "Strong conversion of plant omega-3s — you make EPA/DHA from sources like flax and walnuts relatively well.", tone: "neutral" },
      CT: { label: "Intermediate converter", detail: "Moderate conversion efficiency — some direct EPA/DHA (fish or algae oil) is still useful.", tone: "neutral" },
      CC: { label: "Lower converter", detail: "Less efficient at making long-chain omega-3s from plants — direct dietary EPA/DHA (oily fish or algae oil) matters more for you.", tone: "notable" },
    },
  },

  // ------------------------------------------------------------- wellness ----
  {
    id: "folate",
    rsid: "rs1801133",
    category: "wellness",
    title: "Folate processing (MTHFR C677T)",
    gene: "MTHFR",
    about:
      "How efficiently you activate folate (vitamin B9) — relevant to B-vitamin needs.",
    outcomes: {
      GG: { label: "Normal activity", detail: "Standard MTHFR activity — you process folate efficiently.", tone: "neutral" },
      AG: { label: "Slightly reduced", detail: "One reduced-activity copy — folate processing is modestly lower; leafy greens and adequate B-vitamins help.", tone: "neutral" },
      AA: { label: "Reduced activity", detail: "Two copies — meaningfully lower folate-activation efficiency. Folate-rich foods (or methylfolate) are worth prioritising.", tone: "notable" },
    },
  },
  {
    id: "vitamin-d",
    rsid: "rs10741657",
    category: "wellness",
    title: "Vitamin D levels",
    gene: "CYP2R1",
    about: "A variant influencing how readily you maintain vitamin D status.",
    outcomes: {
      AA: { label: "Tends higher", detail: "Associated with more favourable vitamin D levels.", tone: "neutral" },
      AG: { label: "Intermediate", detail: "Average tendency — sunlight and diet still set your actual level.", tone: "neutral" },
      GG: { label: "Tends lower", detail: "Associated with lower vitamin D levels — worth keeping an eye on intake and sun exposure, especially in winter.", tone: "notable" },
    },
  },
  {
    id: "vitamin-d-binding",
    rsid: "rs2282679",
    category: "wellness",
    title: "Vitamin D transport",
    gene: "GC",
    about: "Affects the binding protein that carries vitamin D in the blood.",
    outcomes: {
      TT: { label: "Typical transport", detail: "Standard vitamin-D binding-protein activity.", tone: "neutral" },
      GT: { label: "Slightly reduced", detail: "One variant copy associated with marginally lower circulating vitamin D.", tone: "neutral" },
      GG: { label: "Reduced transport", detail: "Associated with lower circulating vitamin D — supports paying attention to vitamin D status.", tone: "notable" },
    },
  },
  {
    id: "iron",
    rsid: "rs1799945",
    category: "wellness",
    title: "Iron absorption",
    gene: "HFE (H63D)",
    about: "A common variant affecting how much dietary iron you absorb.",
    outcomes: {
      CC: { label: "Typical absorption", detail: "No H63D variant — standard iron handling.", tone: "neutral" },
      CG: { label: "Slightly higher absorption", detail: "One H63D copy — modestly increased iron absorption; generally benign.", tone: "neutral" },
      GG: { label: "Higher absorption", detail: "Two H63D copies — increased iron absorption. Usually harmless, but worth being aware of.", tone: "notable" },
    },
  },
  {
    id: "dopamine",
    rsid: "rs4680",
    category: "wellness",
    title: "Dopamine clearance (COMT)",
    gene: "COMT",
    about:
      "The 'warrior / worrier' variant — how fast you clear dopamine in the prefrontal cortex, linked to stress response and focus style.",
    outcomes: {
      GG: { label: "Warrior", detail: "Faster dopamine clearance — tends toward steadier performance under stress, with lower baseline dopamine.", tone: "neutral" },
      AG: { label: "Balanced", detail: "Intermediate clearance — a mix of the warrior and worrier tendencies.", tone: "neutral" },
      AA: { label: "Worrier", detail: "Slower clearance — often linked to sharper focus and memory in calm conditions, but more stress sensitivity.", tone: "neutral" },
    },
  },
  {
    id: "earwax",
    rsid: "rs17822931",
    category: "wellness",
    title: "Earwax & body odor type",
    gene: "ABCC11",
    about:
      "A single variant that determines wet vs. dry earwax — and correlates with sweat/body-odor type.",
    outcomes: {
      CC: { label: "Wet type", detail: "Wet earwax and typical apocrine sweat — the most common type globally.", tone: "neutral" },
      CT: { label: "Wet type (carrier)", detail: "Wet earwax — the wet allele is dominant, so you present the wet type while carrying one dry copy.", tone: "neutral" },
      TT: { label: "Dry type", detail: "Dry, flaky earwax and notably reduced underarm body odor.", tone: "notable" },
    },
  },
]
