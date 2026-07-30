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
      source: "Egan et al., COMT Val108/158Met & prefrontal function, PNAS 2001 (rs4680)",
      url: "https://www.ncbi.nlm.nih.gov/snp/rs4680",
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
      source: "Kim et al., TAS2R38 bitter-taste receptor & PTC sensitivity, Science 2003 (rs1726866)",
      url: "https://www.ncbi.nlm.nih.gov/snp/rs1726866",
    },
  ],

  // ── APOA2 · saturated-fat response ────────────────────────────────────────
  "fat-response": [
    {
      kind: "diet",
      factor: "Saturated fat may drive weight gain more in you",
      finding:
        "One of the cleanest gene × diet findings: people with the CC genotype at APOA2 tend to gain more weight and have higher BMI on a high-saturated-fat diet, while the same food affects others less. Below ~22 g saturated fat/day the difference largely disappears — so swapping butter/fatty meat for olive oil, nuts and fish is especially high-leverage for this genotype.",
      source: "Corella et al., APOA2 × saturated fat & body weight, J Nutr 2013",
      pmid: "24108135",
    },
    {
      kind: "note",
      factor: "It runs through metabolism, not magic",
      finding:
        "Follow-up work traced the effect to real metabolic and epigenetic changes downstream of the variant — confirming it's a genuine biological interaction, not a statistical fluke.",
      source: "Lai et al., APOA2-saturated fat mechanism, Am J Clin Nutr 2018",
      pmid: "29901700",
    },
  ],

  // ── APOA5 · triglycerides ─────────────────────────────────────────────────
  triglycerides: [
    {
      kind: "diet",
      factor: "Omega-3s and less refined sugar lower triglycerides",
      finding:
        "APOA5 variants can push triglycerides up. The diet levers are well-established: oily fish / omega-3, cutting refined sugar and alcohol, and losing excess weight all lower triglycerides — and they matter more if your genotype already runs them high.",
      source: "Aung et al., Marine Omega-3 & cardiovascular disease, J Am Heart Assoc 2019",
      pmid: "31567003",
    },
  ],

  // ── SOD2 · oxidative aging (skin) ─────────────────────────────────────────
  "oxidative-aging": [
    {
      kind: "lifestyle",
      factor: "Sun protection + antioxidants matter more here",
      finding:
        "SOD2 is a front-line antioxidant enzyme inside your cells' mitochondria. Lower-efficiency genotypes clear oxidative stress (from UV, pollution, smoking) a little less well, so skin may show sun/pollution wear sooner. Daily SPF is the highest-leverage move; a morning vitamin-C serum and an antioxidant-rich diet (colourful veg, berries) genuinely help; don't smoke.",
      source: "Sutton et al., SOD2 Ala16Val mitochondrial targeting, Pharmacogenetics 2005 (rs4880)",
      url: "https://www.ncbi.nlm.nih.gov/snp/rs4880",
    },
  ],

  // ── GSTP1 · detox / UV response ───────────────────────────────────────────
  "detox-gst": [
    {
      kind: "lifestyle",
      factor: "Cruciferous veg supports your detox enzymes",
      finding:
        "GST enzymes help clear certain toxins and oxidative by-products. Sulforaphane — from broccoli, and especially broccoli sprouts — upregulates the body's own antioxidant/detox pathways, a useful lever if your GST genotype is lower-activity. Not a cleanse gimmick; a real, food-based nudge.",
      source: "GSTP1 Ile105Val (rs1695), GWAS Catalog / dbSNP",
      url: "https://www.ncbi.nlm.nih.gov/snp/rs1695",
    },
  ],

  // ── ADRB2 · training response ─────────────────────────────────────────────
  "training-response": [
    {
      kind: "lifestyle",
      factor: "Consistency beats the 'fat-burning zone' myth",
      finding:
        "ADRB2 shapes how readily you mobilise fat during exercise, but the practical takeaway is the same for every genotype: total energy balance and consistency drive fat loss, not a magic heart-rate 'fat-burning zone'. Use training for fitness and muscle; lean on diet for fat loss. Cardiac-rehab trials show consistent exercise pays off regardless.",
      source: "Heran et al., Exercise-based cardiac rehabilitation, Cochrane Database Syst Rev 2011",
      pmid: "21735386",
    },
  ],

  // ── CYP2C19 · clopidogrel (drug safety) ───────────────────────────────────
  clopidogrel: [
    {
      kind: "note",
      factor: "This one is genuinely worth telling a doctor",
      finding:
        "Clopidogrel (Plavix) is a blood thinner that your liver must ACTIVATE via CYP2C19. Poor-metabolizer genotypes activate less of it, so it can work less well — a real, clinically-actionable interaction where a doctor may choose a different antiplatelet drug. If you're ever prescribed clopidogrel, this is worth mentioning; it's not something to self-manage.",
      source: "Scott et al., Clopidogrel therapy & CYP2C19 genotype (CPIC), 2012",
      pmid: "28520346",
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

  // ── GC · vitamin-D binding protein ────────────────────────────────────────
  "vitamin-d-binding": [
    {
      kind: "diet",
      factor: "Some genotypes need more to raise their vitamin D",
      finding:
        "GC codes for the protein that carries vitamin D in your blood. Certain variants are linked to lower circulating vitamin D and a blunted rise from the same dose — so if yours is a lower-carrier type, you may need more sun or a higher supplemental dose to reach the same blood level. Retest after supplementing rather than assuming a standard dose worked.",
      source: "Wang et al., GWAS of circulating vitamin D levels, Hum Mol Genet 2010",
      pmid: "20418485",
    },
  ],

  // ── F5 · Factor V Leiden (clotting) ───────────────────────────────────────
  "clotting-fvl": [
    {
      kind: "note",
      factor: "The lifestyle levers that matter most for clot risk",
      finding:
        "Factor V Leiden raises the risk of dangerous blood clots (DVT/PE). The variant is fixed, but the situational triggers are very modifiable: on long flights or drives, move + hydrate; be aware around surgery, immobility, and pregnancy; and — importantly — combined (estrogen) oral contraceptives multiply the risk sharply for carriers, so this is a genuine 'tell your doctor' variant when choosing contraception or HRT. Smoking adds to it.",
      source: "Kujovich, Factor V Leiden thrombophilia — NIH GeneReviews",
      url: "https://www.ncbi.nlm.nih.gov/books/NBK1368/",
    },
  ],

  // ── MCT1 · lactate transport (fitness) ────────────────────────────────────
  lactate: [
    {
      kind: "lifestyle",
      factor: "Build the aerobic base if you clear lactate slower",
      finding:
        "MCT1 moves lactate in and out of muscle. Slower-clearing genotypes may feel high-intensity intervals burn and fatigue faster and need more recovery. The training answer is well-established regardless of genotype: build an aerobic base first, then add intervals gradually with full recovery between hard sessions — everyone's lactate threshold rises with consistent training.",
      source: "Cupeiro et al., MCT1 T1470A & blood lactate, J Sci Med Sport 2016 (rs1049434)",
      url: "https://www.ncbi.nlm.nih.gov/snp/rs1049434",
    },
  ],
}

/** Convenience: the evidence entries for a marker, or an empty array. */
export function evidenceFor(markerId: string): Evidence[] {
  return DNA_EVIDENCE[markerId] ?? []
}
