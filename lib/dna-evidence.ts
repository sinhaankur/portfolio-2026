/**
 * dna-evidence.ts — curated, CITED evidence for how diet, lifestyle, and
 * environment MODULATE a variant.
 *
 * DNA is the source of truth — the variant's molecular effect is fixed and lives
 * in lib/dna-annotations.ts. This file is the honest second half: what the
 * published literature says can *dial that effect up or down*. Diet and lifestyle
 * are context that modulates, never determines; geography is where a variant is
 * common, not a verdict about you.
 *
 * Every entry is a real, cited association — a factor, a plain-language finding,
 * and a source (PubMed PMID, or a public guideline). Never an invented formula
 * or a precise personal prediction. This grows over time; adding an entry is a
 * one-object edit.
 *
 * This is also the layer that makes the dataset resourceful for OTHERS: it's the
 * kind of "how do I act on this variant" evidence a builder can reuse.
 */

export type EvidenceKind = "diet" | "lifestyle" | "geo" | "note"

export type Evidence = {
  kind: EvidenceKind
  /** short factor label, e.g. "Alcohol type", "Millets & whole grains". */
  factor: string
  /** plain, honest finding — what the evidence says, no invented numbers. */
  finding: string
  /** citation label + optional PubMed id / URL as proof. */
  source: string
  pmid?: string
  url?: string
}

/** Keyed by TRAIT_MARKERS id (not rsID) so it reads alongside the trait card. */
export const DNA_EVIDENCE: Record<string, Evidence[]> = {
  // ── ALDH2 · alcohol flush ────────────────────────────────────────────────
  "alcohol-flush": [
    {
      kind: "diet",
      factor: "Which alcohol — does the type matter?",
      finding:
        "No. The flush is caused by acetaldehyde, the by-product your body makes from ethanol — and beer, wine, and spirits are all just ethanol in water at different strengths. A beer isn't 'safer' than a shot; only the total ethanol matters. A standard drink (≈14 g ethanol) is one 355 ml beer ≈ one 150 ml wine ≈ one 44 ml spirit — the same load.",
      source: "NIAAA — What is a standard drink",
      url: "https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink",
    },
    {
      kind: "lifestyle",
      factor: "Alcohol + this variant = real cancer risk",
      finding:
        "In people carrying the flush variant, drinking raises acetaldehyde exposure and is linked to markedly higher oesophageal (and head/neck) cancer risk. The flush is a biological warning, not just an inconvenience — the honest advice is to drink little or none.",
      source: "Brooks et al., PLoS Medicine 2009 (ALDH2 & alcohol/cancer)",
      pmid: "19320537",
    },
    {
      kind: "geo",
      factor: "Where it's common",
      finding:
        "The flush allele is common across East Asia (≈15–20% in Korean/Japanese cohorts) and rare elsewhere (<1% globally) — that's why it's nicknamed 'Asian flush'. Being common somewhere doesn't tell you your ancestry; your genotype already does.",
      source: "gnomAD / 1000 Genomes allele frequencies",
      url: "https://gnomad.broadinstitute.org/variant/rs671?dataset=gnomad_r4",
    },
  ],

  // ── TCF7L2 · blood sugar / carb sensitivity ──────────────────────────────
  "blood-sugar": [
    {
      kind: "diet",
      factor: "Millets & whole grains",
      finding:
        "For a carb-sensitivity variant, the grain TYPE matters more than cutting carbs. Millets (ragi, jowar, bajra, foxtail) and other whole/intact grains have a lower glycaemic response than white rice or refined wheat — a controlled review found millets lowered fasting and post-meal blood glucose. Swapping refined grains for millets/whole grains is one of the highest-leverage moves here.",
      source: "Anitha et al., Frontiers in Nutrition 2021 (millets & glycaemic response)",
      pmid: "34277683",
    },
    {
      kind: "diet",
      factor: "Vegetables, pulses & fibre first",
      finding:
        "Eating vegetables, legumes, and fibre before or alongside carbs blunts the blood-sugar spike, and higher fibre intake is consistently linked to lower type-2-diabetes risk. Non-starchy veg, dals/beans, and whole fruit are the friendly carbs; refined sugar and white flour are the ones to pair-down.",
      source: "Reynolds et al., The Lancet 2019 (carbohydrate quality & fibre)",
      pmid: "30638909",
    },
    {
      kind: "lifestyle",
      factor: "A short walk after meals",
      finding:
        "Even 2–15 minutes of light walking after eating measurably lowers the post-meal glucose spike — a simple, free lever that helps most for carb-sensitive genotypes.",
      source: "Buffey et al., Sports Medicine 2022 (post-meal walking)",
      pmid: "35113427",
    },
  ],
  // TCF7L2 second marker id, same gene — mirror the diet evidence.
  "carb-weight": [
    {
      kind: "diet",
      factor: "Protein-forward meals",
      finding:
        "For appetite-associated FTO genotypes, higher-protein meals increase fullness and blunt the extra appetite drive the variant nudges toward — the effect of the gene shrinks when protein and fibre are high.",
      source: "Tanaka et al. & FTO-diet interaction reviews",
      pmid: "23736366",
    },
    {
      kind: "lifestyle",
      factor: "Physical activity offsets FTO",
      finding:
        "The classic finding: in physically active people the FTO weight effect is roughly halved. A meta-analysis of >200,000 adults showed activity attenuates the FTO-linked obesity risk — movement genuinely dials this variant down.",
      source: "Kilpeläinen et al., PLoS Medicine 2011 (FTO × physical activity)",
      pmid: "22069379",
    },
  ],
  "fat-cell": [
    {
      kind: "lifestyle",
      factor: "Resistance training + sleep",
      finding:
        "Storage-leaning FTO genotypes respond well to resistance training (more active, energy-burning tissue) and regular sleep — short sleep independently raises appetite hormones, compounding the variant. Consistent training + 7–9 h sleep push back on both.",
      source: "FTO exercise-interaction literature; sleep & appetite (Spiegel et al.)",
      pmid: "15583226",
    },
  ],

  // ── MCM6 · lactose ────────────────────────────────────────────────────────
  lactose: [
    {
      kind: "diet",
      factor: "You may still tolerate some dairy",
      finding:
        "Non-persistence doesn't mean zero dairy. Hard cheeses and yoghurt are naturally low in lactose (bacteria pre-digest it), and tolerance often improves with small, spread-out amounts. Lactose-free milk and lactase drops are simple fixes.",
      source: "NIH / NIDDK — Lactose Intolerance",
      url: "https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance",
    },
    {
      kind: "geo",
      factor: "Where persistence is common",
      finding:
        "Adult lactose tolerance is common in Northern Europe and some pastoralist populations, and less common across much of Asia and Africa — a textbook case of diet (dairy herding) driving a gene's spread. Where it's common is history, not your verdict.",
      source: "1000 Genomes / gnomAD frequencies for rs4988235",
      url: "https://gnomad.broadinstitute.org/variant/rs4988235?dataset=gnomad_r4",
    },
  ],

  // ── MTHFR · folate ────────────────────────────────────────────────────────
  folate: [
    {
      kind: "diet",
      factor: "Folate-rich foods & leafy greens",
      finding:
        "Reduced-function MTHFR genotypes benefit from steady dietary folate — leafy greens, legumes, and (where used) fortified grains. Some evidence favours the methylfolate form of supplements, but food-first is the honest baseline; talk to a clinician before high-dose supplements.",
      source: "NIH Office of Dietary Supplements — Folate",
      url: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/",
    },
  ],

  // ── Vitamin D pathway ─────────────────────────────────────────────────────
  "vitamin-d": [
    {
      kind: "geo",
      factor: "Latitude & sunlight",
      finding:
        "This is where geography genuinely interacts with genes: at higher latitudes (and with darker skin or heavy sun-cover) the skin makes less vitamin D, so lower-D genotypes are more likely to run deficient in winter. Sensible sun, oily fish, and (if advised) supplementation help.",
      source: "NIH Office of Dietary Supplements — Vitamin D",
      url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    },
  ],

  // ── BDNF · mood / memory / exercise ───────────────────────────────────────
  "bdnf-memory": [
    {
      kind: "lifestyle",
      factor: "Exercise is a mood + memory lever",
      finding:
        "BDNF is the brain's 'growth fertilizer', and exercise raises it — which is why movement so reliably lifts mood and sharpens memory. Aerobic exercise measurably increases BDNF and is as effective as medication for mild-to-moderate depression in trials. This is one of the strongest gene × lifestyle stories there is: the daily habit changes the biology.",
      source: "Szuhany et al., meta-analysis of exercise & BDNF, J Psychiatr Res 2015",
      pmid: "25455510",
    },
    {
      kind: "lifestyle",
      factor: "Sleep, mood swings & 'low testosterone'",
      finding:
        "Mood swings and low testosterone are heavily driven by day-to-day activity, not just genes. One week of 5-hour nights cut healthy young men's testosterone 10–15% — and poor sleep, chronic stress, and refined-carb blood-sugar crashes all worsen mood. Resistance training and enough sleep raise testosterone and steady mood. Genes set the baseline; sleep, training, and stress turn the dial.",
      source: "Leproult & Van Cauter, sleep restriction & testosterone, JAMA 2011",
      pmid: "21632481",
    },
  ],

  // ── COMT · dopamine / stress ──────────────────────────────────────────────
  dopamine: [
    {
      kind: "lifestyle",
      factor: "Stress load meets the 'warrior/worrier' gene",
      finding:
        "COMT sets how fast your prefrontal cortex clears dopamine — the 'warrior' (fast) vs 'worrier' (slow) trade-off: slow clearers think sharply when calm but are more stress-sensitive under pressure. It's a tendency, not a fate — sleep, aerobic exercise, and stress-management (the same levers that steady mood) shift how much it shows up day to day.",
      source: "COMT Val158Met (rs4680) — SNPedia",
      url: "https://www.snpedia.com/index.php/Rs4680",
    },
  ],

  // ── FADS1 · omega fatty-acid processing ───────────────────────────────────
  "fatty-acids": [
    {
      kind: "diet",
      factor: "Some people convert plant omega-3s poorly",
      finding:
        "FADS1 controls how well you turn plant-based omega-3 (ALA, from flax/walnuts/chia) into the active EPA/DHA your brain and heart use. Lower-efficiency genotypes get less benefit from plant sources — oily fish (or an algae/fish-oil supplement) delivers EPA/DHA directly and matters more for you.",
      source: "Lemaitre et al., FADS & plasma n-3 fatty acids, PLoS Genet 2011",
      pmid: "21829377",
    },
    {
      kind: "lifestyle",
      factor: "Omega-3 index responds to intake",
      finding:
        "Your blood omega-3 level rises steadily with consistent intake regardless of genotype — genes set the conversion rate, but eating the fatty acids directly bypasses that bottleneck.",
      source: "Köhler et al., long-term n-3 supplementation, Eur J Clin Nutr 2011",
      pmid: "21063431",
    },
  ],

  // ── Iron absorption (HFE) ─────────────────────────────────────────────────
  iron: [
    {
      kind: "diet",
      factor: "Vitamin C boosts iron; tea/coffee blocks it",
      finding:
        "How much iron you absorb from a meal swings hugely with what you eat alongside it: vitamin C (citrus, peppers) can multiply plant-iron absorption several-fold, while tea, coffee, and calcium taken with the meal sharply cut it. This dietary effect is often larger than the genetic one — timing your tea away from iron-rich meals is a real lever.",
      source: "Hallberg & Hulthén, dietary iron absorption algorithm, Am J Clin Nutr 2000",
      pmid: "10799377",
    },
    {
      kind: "note",
      factor: "High-absorber genotypes: don't over-supplement",
      finding:
        "Some HFE genotypes absorb iron more readily (the haemochromatosis-risk direction). If that's you, avoid routine high-dose iron supplements unless a blood test shows you're low — more isn't better, and excess iron is harmful. Confirm iron status with ferritin, not guesswork.",
      source: "NIH Office of Dietary Supplements — Iron",
      url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
    },
  ],

  // ── APOE · cholesterol / fat handling ─────────────────────────────────────
  "apoe-lipid": [
    {
      kind: "diet",
      factor: "Saturated fat hits some genotypes harder",
      finding:
        "APOE shapes how your blood cholesterol responds to dietary fat. Certain genotypes (notably E4 carriers) tend to raise LDL more on high saturated fat — so swapping butter/fatty meat for unsaturated fats (olive oil, nuts, fish) is especially worthwhile. The AHA advisory found replacing saturated with unsaturated fat lowers cardiovascular risk.",
      source: "Sacks et al., AHA Presidential Advisory on Dietary Fats, Circulation 2017",
      pmid: "28620111",
    },
    {
      kind: "lifestyle",
      factor: "The brain-health levers matter more for E4",
      finding:
        "APOE is also the biggest common genetic factor in Alzheimer's risk — but risk, not fate. The modifiable levers (exercise, sleep, blood-pressure and blood-sugar control, not smoking) matter more for E4 carriers, not less. It's a reason to act on the basics, never a reason to give up.",
      source: "Liu et al., APOE & Alzheimer disease: risk, mechanisms & therapy, Nat Rev Neurol 2013",
      pmid: "23296339",
    },
  ],

  // ── TAS2R38 · bitter taste ────────────────────────────────────────────────
  "bitter-taste": [
    {
      kind: "diet",
      factor: "If greens taste bitter, cook them smarter",
      finding:
        "Strong-taster genotypes perceive bitterness in cruciferous veg (broccoli, kale, Brussels sprouts) intensely, which can make them eat fewer — a small real link to veg intake. Roasting, a little fat/acid (olive oil, lemon), or pairing with something sweet tames the bitterness so you still get the nutrition.",
      source: "TAS2R38 (rs1726866) — SNPedia",
      url: "https://www.snpedia.com/index.php/Rs1726866",
    },
  ],

  // ── Caffeine metabolism ───────────────────────────────────────────────────
  caffeine: [
    {
      kind: "lifestyle",
      factor: "Timing over total, for slow metabolizers",
      finding:
        "Slow-metabolizer genotypes clear caffeine over many hours, so an afternoon coffee can still disrupt sleep. Fast metabolizers are less affected. Shifting caffeine earlier in the day matters more than the amount for sleep quality.",
      source: "Cornelis et al., caffeine metabolism (CYP1A2)",
      pmid: "16522833",
    },
  ],
}

/** Convenience: the evidence entries for a marker, or an empty array. */
export function evidenceFor(markerId: string): Evidence[] {
  return DNA_EVIDENCE[markerId] ?? []
}
