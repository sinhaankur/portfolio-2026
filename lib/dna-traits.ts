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

export type TraitCategory = "diet" | "wellness" | "physical" | "health"

export type TraitOutcome = {
  /** Short verdict shown as the headline result, e.g. "Likely lactose intolerant". */
  label: string
  /** One-to-two sentence plain-language explanation. */
  detail: string
  /** Rough tone for the result chip. */
  tone: "neutral" | "notable"
  /** How this tends to show up in everyday life (symptoms, sensations). */
  feels?: string
  /** Actionable diet/lifestyle suggestion. Never medical instruction. */
  tip?: string
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
  /**
   * Next-generation note: how this trait passes to children, in plain terms.
   * Optional — only where there's an honest, simple inheritance story.
   */
  inherit?: string
  /**
   * When you are HOMOZYGOUS at this marker (you pass the same allele to every
   * child), a short, certain statement of what your side contributes. Only set
   * where the single-allele consequence is clean and honest. Shown in the
   * "inherited for certain" portrait.
   */
  certainPass?: string
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
      GG: { label: "Likely lactose intolerant", detail: "No persistence variant — lactase production often declines after childhood, so dairy may cause discomfort. Common across much of the world.", tone: "notable", feels: "This is a leading reason for bloating, gas, cramps, or loose stools an hour or two after milk, soft cheese, or ice cream. Hard/aged cheeses and yogurt are usually easier (less lactose).", tip: "Try a 2-week dairy swap (lactose-free milk, hard cheese, yogurt) and see if bloating settles. A lactase enzyme tablet before dairy can help when you do indulge." },
    },
    certainPass: "You always pass the non-persistence allele — so a child needs the tolerance copy from their other parent to comfortably digest dairy as an adult.",
  },
  {
    id: "caffeine",
    rsid: "rs762551",
    category: "diet",
    title: "Caffeine metabolism",
    gene: "CYP1A2",
    about: "How quickly your liver clears caffeine from your system.",
    outcomes: {
      AA: { label: "Fast metabolizer", detail: "You clear caffeine quickly — coffee tends to hit and leave faster, and is less likely to disrupt sleep when not too late in the day.", tone: "neutral", feels: "You can often have coffee in the afternoon without it wrecking sleep, and may feel you need a second cup for the effect to land.", tip: "You tolerate caffeine well, but it's still a diuretic and appetite-suppressant — don't let it replace meals or water." },
      AC: { label: "Slow metabolizer", detail: "You clear caffeine more slowly — effects linger longer, so afternoon coffee is more likely to affect sleep.", tone: "notable" },
      CC: { label: "Slow metabolizer", detail: "Caffeine stays in your system noticeably longer — sensitivity and sleep disruption are more likely.", tone: "notable" },
    },
    certainPass: "You always pass a fast-metabolizer copy — your children will lean toward clearing caffeine quickly.",
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
    certainPass: "You always pass the normal-activity allele — your children won't get the alcohol-flush variant from your side.",
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
      TT: { label: "Lower-risk variant", detail: "Not associated with the increased-appetite effect — the most favourable FTO genotype for weight regulation.", tone: "neutral", feels: "You're less genetically driven toward overeating than most — appetite is more likely set by habits, sleep, and stress than by this gene.", tip: "Your weight is mostly in your hands, not your genes here. Protein at breakfast and decent sleep keep appetite steady." },
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
      TT: { label: "Higher sensitivity", detail: "Two copies linked to less efficient blood-sugar regulation — pairing carbs with protein/fibre and staying active is especially worthwhile.", tone: "notable", feels: "Big refined-carb meals (white rice, bread, sweets) may hit you with an energy spike then a crash, hunger again soon after, and — over time — easier belly/visceral fat gain than the average person. This is one of the more relevant 'why tummy fat' variants you carry.", tip: "Eat carbs alongside protein, fat, or fibre rather than alone; favour whole over refined; a short walk after meals blunts the sugar spike noticeably." },
    },
    certainPass: "You always pass the carb-sensitivity allele — each child inherits one copy from you, so balanced, whole-carb habits are worth teaching early.",
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
      AG: { label: "Medium taster", detail: "Moderate bitter sensitivity — you notice bitterness but it's rarely overwhelming.", tone: "neutral", feels: "Coffee, dark chocolate, IPA, and greens like kale register as bitter but are enjoyable — you're in the middle of the range most people sit in.", tip: "Roasting or a little fat/acid (olive oil, lemon) tames bitter veg if you want to eat more of it." },
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
      CT: { label: "Intermediate converter", detail: "Moderate conversion efficiency — some direct EPA/DHA (fish or algae oil) is still useful.", tone: "neutral", feels: "You make some omega-3 from plants but not maximally — easy to run low if your diet is light on oily fish.", tip: "A couple of servings of oily fish a week (or an algae-oil supplement if vegetarian) covers the gap." },
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
    inherit: "The dry allele is recessive — a child needs one from each parent to have dry-type earwax/odor. If you're the wet type, children only inherit dry if the other parent also carries it.",
  },

  // ------------------------------------------------------------- physical ----
  {
    id: "eye-color",
    rsid: "rs12913832",
    category: "physical",
    title: "Eye colour",
    gene: "HERC2 / OCA2",
    about:
      "The single strongest common predictor of blue vs. brown eyes — it switches nearby pigment genes on or off.",
    outcomes: {
      AA: { label: "Likely brown", detail: "Two 'brown' copies — brown eyes are very likely.", tone: "neutral", feels: "Brown is the global default and dominant here." },
      AG: { label: "Brown or hazel/green", detail: "One of each — usually brown or an intermediate hazel/green; outcome depends on other pigment genes.", tone: "neutral", feels: "Carrying one blue-associated copy means lighter-eyed children are possible." },
      GG: { label: "Likely blue", detail: "Two 'blue' copies — blue (or light) eyes are most likely.", tone: "notable" },
    },
    inherit: "Blue is largely recessive at this marker. Two blue-eyed parents usually have blue-eyed children; a brown-eyed parent carrying one blue copy (like AG) can still pass blue on.",
  },
  {
    id: "freckles",
    rsid: "rs1393350",
    category: "physical",
    title: "Freckling & sun response",
    gene: "TYR",
    about: "A pigment-gene variant linked to freckling and UV sensitivity.",
    outcomes: {
      GG: { label: "Less freckling", detail: "Lower tendency to freckle from this marker.", tone: "neutral" },
      AG: { label: "Some freckling", detail: "Intermediate — some freckling and sun reactivity is common.", tone: "neutral" },
      AA: { label: "More freckling", detail: "Higher tendency to freckle and react to sun.", tone: "notable", feels: "Skin that freckles and pinks in the sun usually wants more diligent SPF." },
    },
  },
  {
    id: "pigment",
    rsid: "rs12203592",
    category: "physical",
    title: "Skin & hair pigment",
    gene: "IRF4",
    about: "Influences hair/skin tone, freckling, and how skin tans vs. burns.",
    outcomes: {
      CC: { label: "Darker / tans", detail: "Associated with darker hair and skin that tends to tan rather than burn.", tone: "neutral" },
      CT: { label: "Intermediate", detail: "Mixed pigment effect — outcome depends on your other variants.", tone: "neutral" },
      TT: { label: "Lighter / burns", detail: "Associated with lighter colouring and skin that burns more easily.", tone: "notable" },
    },
  },
  {
    id: "endurance",
    rsid: "rs8192678",
    category: "physical",
    title: "Endurance vs. power",
    gene: "PPARGC1A",
    about:
      "A variant in the 'mitochondrial master switch' linked to aerobic endurance capacity.",
    outcomes: {
      CC: { label: "Endurance-leaning", detail: "Associated with better aerobic/endurance response to training.", tone: "neutral", feels: "You may find steady cardio — running, cycling, swimming — comes relatively naturally.", tip: "Lean into endurance work; it likely pays off well for you. Don't skip strength, though." },
      CT: { label: "Mixed", detail: "A blend of endurance and power tendencies.", tone: "neutral" },
      TT: { label: "Power-leaning", detail: "Slightly less endurance-associated — may respond relatively better to strength/power work.", tone: "neutral" },
    },
  },
  {
    id: "bdnf-memory",
    rsid: "rs6265",
    category: "physical",
    title: "BDNF — learning & mood",
    gene: "BDNF (Val66Met)",
    about:
      "A brain-growth-factor variant linked to memory, learning, and exercise-driven mood benefits.",
    outcomes: {
      CC: { label: "Val/Val", detail: "The more common form — typical BDNF activity, associated with robust exercise-linked mood and memory benefits.", tone: "neutral", feels: "Exercise tends to reliably lift mood and sharpen focus for you.", tip: "Use movement as a mood/cognition tool — it works especially well with this genotype." },
      CT: { label: "Val/Met", detail: "One Met copy — slightly altered BDNF signalling, generally subtle.", tone: "neutral" },
      TT: { label: "Met/Met", detail: "Two Met copies — somewhat lower activity-dependent BDNF; small effects on stress/memory in some studies.", tone: "neutral" },
    },
  },

  // --------------------------------------------------------------- health ----
  // Polygenic *tendencies* only — common variants framed as above/below average.
  // NEVER risk scores or diagnoses. See the section disclaimer in the UI.
  {
    id: "apoe-lipid",
    rsid: "rs7412",
    category: "health",
    title: "Cholesterol handling (APOE)",
    gene: "APOE",
    about:
      "One of two APOE markers. This one (rs7412) distinguishes the E2 form, associated with how the body clears blood lipids.",
    outcomes: {
      CC: { label: "No E2 variant here", detail: "You don't carry the E2-defining allele at this position. Note: a chip can't resolve full APOE status, and we deliberately don't report the disease-linked E4 marker.", tone: "neutral" },
      CT: { label: "One E2 allele", detail: "Carrying one E2-defining allele, often associated with lower LDL cholesterol on average.", tone: "neutral" },
      TT: { label: "Two E2 alleles", detail: "E2/E2 pattern at this marker — usually associated with lower LDL, occasionally altered lipid clearance.", tone: "notable" },
    },
  },
  {
    id: "triglycerides",
    rsid: "rs662799",
    category: "health",
    title: "Triglyceride tendency",
    gene: "APOA5",
    about:
      "A common variant associated with how high blood triglycerides tend to run, especially on high-carb/high-fat diets.",
    outcomes: {
      AA: { label: "Lower-tendency", detail: "The common genotype — not associated with the higher-triglyceride effect.", tone: "neutral", feels: "Your triglyceride response to diet is likely average — driven more by what you eat than by this gene." },
      AG: { label: "Slightly higher tendency", detail: "One copy associated with somewhat higher triglycerides, more pronounced with refined carbs and alcohol.", tone: "neutral", tip: "If relevant, less refined sugar and alcohol plus more omega-3 tends to help triglycerides." },
      GG: { label: "Higher tendency", detail: "Associated with a tendency toward higher triglycerides — diet sensitivity is greater. A tendency, not a diagnosis.", tone: "notable" },
    },
  },
  {
    id: "t2d-ppar",
    rsid: "rs1801282",
    category: "health",
    title: "Insulin sensitivity (PPARG)",
    gene: "PPARG (Pro12Ala)",
    about:
      "The Ala variant is associated with modestly better insulin sensitivity — one of the more reassuring common metabolic variants.",
    outcomes: {
      CC: { label: "Common form", detail: "Pro/Pro — the common genotype; no protective Ala effect, but no added tendency either.", tone: "neutral" },
      CG: { label: "Protective Ala carrier", detail: "One Ala copy, associated with slightly improved insulin sensitivity on average.", tone: "neutral", feels: "A small genetic point in your favour for blood-sugar handling." },
      GG: { label: "Two Ala copies", detail: "Associated with the most favourable insulin-sensitivity tendency at this marker.", tone: "neutral" },
    },
  },
  {
    id: "clotting-fvl",
    rsid: "rs6025",
    category: "health",
    title: "Clotting — Factor V Leiden",
    gene: "F5",
    about:
      "A well-known variant affecting blood-clotting tendency. Important caveat below.",
    outcomes: {
      CC: { label: "No variant detected", detail: "You don't carry the Factor V Leiden variant at this position — the common, lower-tendency genotype.", tone: "neutral", feels: "Reassuring at this single marker. Note a chip only checks this one spot; clinical clotting evaluation looks at much more." },
      CT: { label: "One copy", detail: "Carrying one Factor V Leiden copy is associated with a higher clotting tendency. This is the kind of result worth confirming with a clinician on a validated test.", tone: "notable" },
      TT: { label: "Two copies", detail: "Two copies — notably higher clotting tendency. Confirm clinically; do not act on raw chip data alone.", tone: "notable" },
    },
    inherit: "Factor V Leiden is inherited simply — each parent passes one F5 copy, so a carrier parent has a 50% chance of passing the variant to each child.",
  },
]
