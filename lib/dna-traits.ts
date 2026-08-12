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

export type TraitCategory =
  | "diet"
  | "fitness"
  | "skin"
  | "wellness"
  | "physical"
  | "health"
  | "pharma"

/** Where a marker's interpretation is sourced from — shown per trait so the
 *  page reads as honest science, not horoscope-genetics. All open/citable. */
export type TraitSource =
  | "GWAS Catalog"
  | "ClinVar"
  | "PharmGKB"
  | "SNPedia"
  | "peer-reviewed"

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
  /** The dataset(s) this interpretation is drawn from — cited on the card so
   *  the provenance is visible. Optional for legacy markers; new ones set it. */
  source?: TraitSource
  /** How strong the evidence is, in plain words ("well-established",
   *  "reported"). Shown next to the source. */
  evidence?: string
  /**
   * The key PUBLISHED PAPER behind this interpretation — a short citation + its
   * PubMed ID. Rendered as a link to the open PubMed record so anyone can read
   * the actual research (people ask for the source; this is it). Open-access /
   * public where possible.
   */
  paper?: { cite: string; pmid: string }
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
  /**
   * Plain-language "why is that true?" for the certainPass claim — the actual
   * genetics reasoning, surfaced in a tooltip so the conclusion isn't a black
   * box. Only the mechanism; still honest, never a promise about the child.
   */
  certainPassWhy?: string
}

/** Sort the two alleles so "GA" and "AG" both match the "AG" key. */
export function normalizeGenotype(g: string): string {
  return g.toUpperCase().split("").sort().join("")
}

export const TRAIT_MARKERS: TraitMarker[] = [
  // ---------------------------------------------------------------- diet -----
  {
    id: "lactose",
    paper: { cite: "Enattah et al., Nature Genetics — identifies the MCM6 variant behind lactase persistence", pmid: "11788828" },
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
    certainPassWhy: "Both of your copies at this marker are the ancestral 'lactase switches off after weaning' version. You hand exactly one copy to each child, and since both of yours are the same, that's the only one you can pass. Adult lactose tolerance is dominant — one tolerance copy is enough — but that copy can only come from the other parent, because you don't carry it to give.",
  },
  {
    id: "caffeine",
    paper: { cite: "Cornelis et al., JAMA — CYP1A2 genotype, coffee intake & heart-attack risk", pmid: "16522833" },
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
    certainPassWhy: "Both of your copies here are the fast-metabolizer version of CYP1A2 (the liver enzyme that breaks down caffeine). You can only pass a copy you actually carry — and both of yours are the fast kind — so every child gets a fast copy from your side. Whether they're fully fast or intermediate depends on what the other parent passes.",
  },
  {
    id: "alcohol-flush",
    paper: { cite: "Brooks et al., PLoS Medicine — ALDH2 deficiency, alcohol & oesophageal-cancer risk", pmid: "19320537" },
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
    certainPassWhy: "The flush comes from a broken copy of ALDH2 — the enzyme that clears acetaldehyde, the harsh by-product of alcohol. Both of your copies are the working, normal-activity version, so the only copy you can hand down is a working one. A child only flushes if they inherit a broken copy from BOTH parents (it's recessive), and they can't get one from you — so from your side, they're covered. If the other parent carries the variant, a child could still be a silent carrier, just not a flusher because of your contribution.",
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
    // "Is beer/wheat okay for me?" — the WHEAT half. This is a POSSIBILITY flag,
    // never a diagnosis: rs2187668 tags the HLA-DQ2.5 type. Carrying it is common
    // (~30-40% of people) and MOST carriers never develop coeliac disease; NOT
    // carrying it makes coeliac very unlikely. A chip cannot diagnose coeliac —
    // only a doctor's blood test / biopsy can. Framed strictly as information,
    // in the spirit of how APOE-E4 is deliberately withheld here.
    id: "gluten-wheat",
    paper: { cite: "Romanos et al. — HLA-DQ tag SNPs (incl. rs2187668) for coeliac-disease risk typing", pmid: "24333368" },
    rsid: "rs2187668",
    category: "diet",
    title: "Beer & wheat — gluten possibility",
    gene: "HLA-DQ2.5",
    about:
      "Beer is made from wheat/barley, so it contains gluten. This marker tags the main gene type linked to coeliac disease — it flags whether coeliac is even POSSIBLE for you, not whether you have it. It says nothing about the alcohol itself (see the flush trait for that).",
    source: "peer-reviewed",
    evidence: "well-established risk marker; not diagnostic",
    outcomes: {
      CC: {
        label: "Coeliac very unlikely",
        detail: "You don't carry the DQ2.5 tag. Coeliac disease is very unlikely for you — it almost always needs this gene type. That doesn't rule out ordinary, non-coeliac wheat sensitivity, but the autoimmune kind is off the table for most people without this marker.",
        tone: "neutral",
        feels: "If wheat/beer gives you no gut trouble, this fits. If beer still bloats you, it's more likely the carbonation, the alcohol, or plain non-coeliac sensitivity than coeliac.",
        tip: "No gluten avoidance is implied here. Enjoy beer/wheat as normal-risk foods; the alcohol-flush trait is the one worth checking for beer itself.",
      },
      CT: {
        label: "Carries the tag — possible, not likely",
        detail: "You carry one copy of the DQ2.5 tag. This is COMMON — roughly a third of people do — and the large majority never develop coeliac disease. It means coeliac is possible for you, not that you have it. Only a doctor's blood test (and sometimes a biopsy) can tell.",
        tone: "notable",
        feels: "Most carriers eat wheat and drink beer with no issue at all. Watch only for a real pattern — ongoing bloating, diarrhoea, fatigue, or weight loss that tracks with gluten — and if you see it, that's a doctor conversation, not a self-diagnosis.",
        tip: "Do NOT cut gluten on the strength of this marker — and especially don't cut it before seeing a doctor, because going gluten-free first can make the medical test come back falsely negative. This is information to keep in your back pocket, nothing more.",
      },
      TT: {
        label: "Carries the tag — possible, not likely",
        detail: "You carry two copies of the DQ2.5 tag. It's still only a possibility marker: the majority of people with it never develop coeliac disease. It raises the chance relative to non-carriers, but is nowhere near a diagnosis — only a doctor can test for that.",
        tone: "notable",
        feels: "Plenty of people with this genotype eat wheat their whole lives with no problem. The marker matters only if real symptoms appear alongside gluten.",
        tip: "Keep eating normally unless symptoms genuinely track with gluten; if they do, ask a doctor for a coeliac blood test BEFORE removing gluten (removing it first can hide the result). Never self-diagnose from a chip.",
      },
    },
    inherit:
      "This gene type is inherited, which is why coeliac can run in families — but inheriting the tag is not inheriting the disease. Most family members who carry it never develop it.",
  },
  {
    id: "carb-weight",
    paper: { cite: "Frayling et al., Science — the FTO variant linked to BMI & obesity risk", pmid: "17434869" },
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
    certainPassWhy: "Both of your copies of TCF7L2 are the carb-sensitivity version (the strongest common type-2-diabetes-risk variant known). Since both are the same, that's the only copy you can pass — so every child gets at least one from you. One copy is a modest nudge, not a sentence; it's exactly the kind of lean that whole-carb, protein-paired eating habits offset well, which is why teaching those habits early is worth it.",
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
    paper: { cite: "Frosst et al., Nature Genetics — the MTHFR C677T thermolabile variant", pmid: "7647779" },
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
    paper: { cite: "Wang et al., The Lancet — genome-wide study of vitamin-D insufficiency (CYP2R1/GC)", pmid: "20541252" },
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
    paper: { cite: "Eiberg et al., Human Genetics — a single HERC2/OCA2 founder for blue eyes", pmid: "18172690" },
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
    paper: { cite: "Lucia et al., J. Applied Physiology — PPARGC1A (PGC-1α) & endurance performance", pmid: "15980245" },
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
    paper: { cite: "Egan et al., Cell — the BDNF Val66Met variant & human memory", pmid: "12553913" },
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
    paper: { cite: "Corder et al., Science — APOE ε4 gene dose & Alzheimer's risk", pmid: "8346443" },
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

  // -------------------------------------------------------------- fitness ----
  {
    id: "fuel-type",
    rsid: "rs4253778",
    category: "fitness",
    title: "Training fuel & fibre type",
    gene: "PPARA",
    about:
      "A regulator of how muscle uses fat vs. carbohydrate for fuel — linked to endurance vs. power/strength leaning.",
    outcomes: {
      GG: { label: "Endurance-fuel leaning", detail: "The common genotype — associated with efficient fat-burning and a lean toward aerobic/endurance performance.", tone: "neutral", feels: "Steady-state cardio and higher-rep work likely feel sustainable; you fuel well on fat during longer efforts.", tip: "Zone-2 cardio (long, conversational-pace sessions) pays off for you. Still strength train 2×/week for muscle and bone — endurance leaning isn't an excuse to skip it." },
      CG: { label: "Mixed", detail: "One of each — a blend of endurance and power/strength tendencies.", tone: "neutral", tip: "You can train either direction; periodise — blocks of endurance, blocks of strength — to develop both." },
      CC: { label: "Power/strength leaning", detail: "Associated with greater reliance on carbohydrate fuel and a lean toward strength/power.", tone: "neutral", tip: "Lower-rep, heavier strength work and short intervals suit you; make sure carbs are available around hard sessions." },
    },
  },
  {
    id: "training-response",
    rsid: "rs1042713",
    category: "fitness",
    title: "Fat-burning & training response",
    gene: "ADRB2",
    about:
      "A receptor that governs how readily stored fat is mobilised during exercise and how the body responds to training.",
    outcomes: {
      AA: { label: "Strong responder", detail: "Associated with efficient fat mobilisation during exercise.", tone: "neutral", feels: "Fasted/morning cardio may feel effective for you." },
      AG: { label: "Typical responder", detail: "Intermediate fat-mobilisation response — the common pattern.", tone: "neutral", feels: "Standard response to cardio; consistency matters more than timing.", tip: "Don't over-rotate on 'fat-burning zone' myths — total energy balance and consistency drive fat loss, not a magic heart-rate window." },
      GG: { label: "Gradual responder", detail: "Associated with slower fat mobilisation — fat loss may need a bit more patience and volume.", tone: "neutral", tip: "Lean on diet for fat loss and use training for fitness/muscle; results compound with consistency." },
    },
  },
  {
    id: "tendon-injury",
    rsid: "rs1800012",
    category: "fitness",
    title: "Tendon & ligament resilience",
    gene: "COL1A1",
    about:
      "A collagen-gene variant linked to connective-tissue strength and soft-tissue injury risk (sprains, tendon issues).",
    outcomes: {
      CC: { label: "Protective collagen", detail: "Associated with more robust connective tissue and somewhat lower soft-tissue injury risk.", tone: "neutral" },
      CA: { label: "Resilient (carrier)", detail: "One protective copy — generally favourable connective-tissue resilience.", tone: "neutral", feels: "Decent tissue resilience, but ramp load sensibly — genes don't beat a bad training spike.", tip: "Warm up properly, progress load gradually (~10%/week), and don't skip eccentric/strength work for tendons." },
      AA: { label: "Standard", detail: "The common genotype without the protective association — normal injury risk; technique and load management matter most.", tone: "neutral" },
    },
  },
  {
    id: "lactate",
    rsid: "rs1049434",
    category: "fitness",
    title: "Lactate clearance",
    gene: "MCT1 (SLC16A1)",
    about:
      "Affects how fast muscle clears lactate — relevant to high-intensity work and how quickly you recover between hard efforts.",
    outcomes: {
      TT: { label: "Efficient clearer", detail: "Associated with better lactate transport — you may handle and recover from high-intensity intervals relatively well.", tone: "neutral", feels: "Repeated sprints / HIIT sets may feel manageable; the 'burn' clears faster.", tip: "You can tolerate interval training well — use it, but still respect recovery days." },
      CT: { label: "Intermediate", detail: "Average lactate-clearing capacity.", tone: "neutral" },
      CC: { label: "Gradual clearer", detail: "Associated with slower lactate clearance — high-intensity efforts may fatigue you faster and need more recovery.", tone: "neutral", tip: "Build an aerobic base first; add intervals gradually and give yourself full recovery between hard sessions." },
    },
  },
  {
    id: "strength-response",
    rsid: "rs699",
    category: "fitness",
    title: "Strength-training response",
    gene: "AGT",
    about:
      "An angiotensinogen variant associated with muscle-growth and strength response to resistance training.",
    outcomes: {
      AA: { label: "Strong response", detail: "Associated with a greater muscle/strength response to resistance training.", tone: "neutral", tip: "Your body rewards lifting — progressive overload with enough protein (~1.6 g/kg) will show results." },
      AG: { label: "Good response", detail: "Intermediate — a solid strength-training response.", tone: "neutral", feels: "You build strength at a healthy, typical rate with consistent lifting.", tip: "Stick to progressive overload and adequate protein; consistency beats program-hopping." },
      GG: { label: "Steady response", detail: "Associated with a more gradual strength response — gains come, just patiently.", tone: "neutral", tip: "Don't chase fast numbers; longer, consistent training blocks and protein win here." },
    },
  },

  // ----------------------------------------------------------------- skin ----
  {
    id: "oxidative-aging",
    rsid: "rs4880",
    category: "skin",
    title: "Antioxidant defense (skin aging)",
    gene: "SOD2",
    about:
      "SOD2 neutralises free radicals in cells. This variant affects how efficiently you clear oxidative stress — a driver of skin aging.",
    outcomes: {
      AA: { label: "Strong defense", detail: "Associated with efficient mitochondrial antioxidant activity.", tone: "neutral" },
      AG: { label: "Typical defense", detail: "Intermediate antioxidant capacity.", tone: "neutral" },
      GG: { label: "Lean on antioxidants", detail: "Associated with comparatively lower SOD2 antioxidant efficiency — oxidative stress (sun, pollution, smoking) may age skin a little faster.", tone: "notable", feels: "Skin may show sun/pollution wear sooner if unprotected.", tip: "Daily SPF is your highest-leverage move. A vitamin-C serum in the morning and antioxidant-rich diet (colourful veg, berries) genuinely help here; avoid smoking." },
    },
  },
  {
    id: "catalase",
    rsid: "rs1001179",
    category: "skin",
    title: "Hydrogen-peroxide clearance",
    gene: "CAT",
    about:
      "Catalase breaks down hydrogen peroxide (an oxidant linked to greying and skin stress). This variant affects its level.",
    outcomes: {
      CC: { label: "Higher catalase", detail: "Associated with robust catalase activity — good oxidant clearance.", tone: "neutral", feels: "A point in your favour for oxidative-stress handling in skin and hair." },
      CT: { label: "Intermediate", detail: "Average catalase activity.", tone: "neutral" },
      TT: { label: "Lower catalase", detail: "Associated with reduced catalase — slightly less oxidant buffering.", tone: "neutral", tip: "Antioxidant skincare (vitamin C/E) and sun protection compensate well." },
    },
  },
  {
    id: "detox-gst",
    rsid: "rs1695",
    category: "skin",
    title: "Detox & pollution defense",
    gene: "GSTP1",
    about:
      "GSTP1 helps neutralise environmental toxins and pollution byproducts that stress skin.",
    outcomes: {
      AA: { label: "Standard activity", detail: "The common genotype — typical detox-enzyme activity.", tone: "neutral", feels: "Average ability to clear pollution-related oxidative load.", tip: "Cleanse off the day's pollution at night and use antioxidants; basic habits cover this." },
      AG: { label: "Altered activity", detail: "One variant copy — modestly changed enzyme activity.", tone: "neutral" },
      GG: { label: "Reduced activity", detail: "Associated with lower GSTP1 activity — skin may be a touch more reactive to pollution/irritants.", tone: "notable", tip: "Gentle, fragrance-free products, nightly cleansing, and antioxidants help if your skin reacts to city air." },
    },
  },
  {
    id: "uv-pigment",
    rsid: "rs1800440",
    category: "skin",
    title: "UV response & tanning",
    gene: "TYR",
    about:
      "A pigment-gene variant influencing how skin responds to UV — burning vs. tanning and melanoma-relevant sun sensitivity.",
    outcomes: {
      AA: { label: "Tans more easily", detail: "Associated with a more protective tanning response.", tone: "neutral" },
      AG: { label: "Intermediate", detail: "Mixed sun response.", tone: "neutral" },
      TT: { label: "Sun-sensitive lean", detail: "Associated with a tendency to burn rather than tan at this marker — sun protection matters more.", tone: "notable", feels: "Skin likely pinks/burns before it tans.", tip: "Non-negotiable daily SPF 30+, reapply outdoors, hats and shade at midday. This is the biggest lever for both aging and skin-cancer prevention." },
    },
  },
  {
    id: "p53-skin",
    rsid: "rs1042522",
    category: "skin",
    title: "Cellular repair (P53)",
    gene: "TP53",
    about:
      "TP53 is the cell's master 'repair-or-retire damaged cells' switch — relevant to how skin handles UV/oxidative damage over time.",
    outcomes: {
      GG: { label: "Arginine form", detail: "The more common form, associated with efficient triggering of damaged-cell cleanup.", tone: "neutral" },
      CG: { label: "Mixed form", detail: "One of each — a blend of the two repair-response styles.", tone: "neutral", feels: "Typical cellular-repair response; nothing to flag.", tip: "Sun protection and not smoking matter far more than this variant for keeping skin healthy long-term." },
      CC: { label: "Proline form", detail: "Associated with a different DNA-repair response profile — subtle effects, well within normal.", tone: "neutral" },
    },
  },

  // -------------------------------------------------- diet (expansion) -------
  {
    id: "fat-cell",
    rsid: "rs1421085",
    category: "diet",
    title: "Fat-cell programming (FTO causal)",
    gene: "FTO",
    about:
      "The actual causal variant in the FTO obesity locus — it shifts fat cells away from calorie-burning beige fat toward calorie-storing white fat.",
    outcomes: {
      TT: { label: "Burn-leaning", detail: "The favourable genotype — fat cells lean toward energy-burning rather than storage.", tone: "neutral", feels: "Less genetic push toward fat storage; appetite and storage are more under your control." },
      CT: { label: "Intermediate", detail: "One risk copy — a modest shift toward fat storage and higher appetite.", tone: "neutral" },
      CC: { label: "Store-leaning", detail: "Two risk copies — fat cells lean toward storage and appetite signalling runs higher. Diet and activity still dominate the outcome.", tone: "notable", feels: "May feel hungrier and store fat (incl. belly) more easily.", tip: "Protein-forward meals, resistance training (more beige-fat activity), and a regular sleep schedule push back against this." },
    },
  },
  {
    id: "appetite-mc4r",
    rsid: "rs17782313",
    category: "diet",
    title: "Appetite & snacking drive",
    gene: "MC4R",
    about:
      "A variant near the brain's master appetite-control gene, linked to satiety, snacking, and preference for energy-dense food.",
    outcomes: {
      TT: { label: "Steady appetite", detail: "The common genotype — not associated with the increased-appetite effect.", tone: "neutral", feels: "Your hunger cues are likely reliable; you can mostly trust fullness.", tip: "Eat to your hunger, keep protein and fibre up, and you won't fight your biology much here." },
      CT: { label: "Higher snack drive", detail: "One copy associated with a bit more snacking and appetite for rich food.", tone: "neutral", tip: "Pre-plan snacks, keep tempting food out of sight, and front-load protein at meals." },
      CC: { label: "Strong appetite drive", detail: "Two copies associated with stronger appetite and pull toward energy-dense food.", tone: "notable", tip: "Structure beats willpower: regular protein-rich meals, a stocked fridge of easy healthy options, and good sleep blunt the drive." },
    },
  },
  {
    id: "fat-response",
    rsid: "rs5082",
    category: "diet",
    title: "Dietary fat response",
    gene: "APOA2 / CELSR2 region",
    about:
      "A variant linked to how your weight and lipids respond to a high-saturated-fat diet.",
    outcomes: {
      AA: { label: "Fat-sensitive", detail: "Associated with greater weight response to high saturated-fat intake.", tone: "notable", tip: "Favour unsaturated fats (olive oil, nuts, fish) over heavy saturated fat (butter, fatty red meat)." },
      AG: { label: "Intermediate", detail: "Moderate sensitivity to dietary saturated fat.", tone: "neutral", feels: "A Mediterranean-style fat balance suits you well.", tip: "Lean on olive oil, nuts, and fish; keep saturated fat moderate." },
      GG: { label: "Less sensitive", detail: "Associated with a smaller weight response to saturated fat — though heart-healthy fats are still the better choice.", tone: "neutral" },
    },
  },
  {
    id: "hdl-cetp",
    rsid: "rs2070895",
    category: "diet",
    title: "Good-cholesterol (HDL) tendency",
    gene: "LIPC",
    about:
      "A variant associated with HDL ('good' cholesterol) levels and how they respond to diet and exercise.",
    outcomes: {
      GG: { label: "Typical HDL", detail: "The common genotype — standard HDL tendency.", tone: "neutral", feels: "Your HDL responds normally to the usual levers.", tip: "Aerobic exercise, olive oil, and oily fish nudge HDL up; these work well regardless of genotype." },
      AG: { label: "Slightly higher HDL", detail: "One copy associated with marginally higher HDL.", tone: "neutral" },
      AA: { label: "Higher HDL lean", detail: "Associated with a tendency toward higher HDL — generally favourable.", tone: "neutral" },
    },
  },

  // ------------------------------------------------ pharmacogenomics ----------
  // How your body processes common drugs — from PharmGKB (the pharmacogenomics
  // knowledgebase). Informational only: dosing is ALWAYS a clinician's call on
  // a validated test, never a consumer chip.
  {
    id: "caffeine-metabolism",
    rsid: "rs762551",
    category: "pharma",
    title: "Caffeine metabolism speed",
    gene: "CYP1A2",
    source: "PharmGKB",
    evidence: "well-established",
    about: "How fast the CYP1A2 enzyme clears caffeine — the difference between a coffee that wears off in hours and one that keeps you up.",
    outcomes: {
      AA: { label: "Fast metabolizer", detail: "The *1A/*1A form — caffeine clears quickly, so it affects you for less time.", tone: "neutral", feels: "You can often drink coffee later in the day without it wrecking sleep — you burn it off fast.", tip: "You still have a real limit; fast clearance isn't a licence for unlimited caffeine." },
      AC: { label: "Slow metabolizer", detail: "One slow allele — caffeine lingers longer, so a late coffee reaches further into the evening.", tone: "notable", feels: "Afternoon coffee more easily disturbs your sleep, and caffeine's jittery edge lasts longer.", tip: "Keep caffeine to the morning; a cut-off around noon–2pm helps sleep." },
      CC: { label: "Slow metabolizer", detail: "Two slow alleles — caffeine clears slowly and stays in your system for hours.", tone: "notable", feels: "Even a mid-afternoon coffee can cost you sleep; the stimulant effect outstays its welcome.", tip: "Front-load caffeine early; switch to decaf after late morning." },
    },
  },
  {
    id: "warfarin-sensitivity",
    rsid: "rs9923231",
    category: "pharma",
    title: "Warfarin dose sensitivity",
    gene: "VKORC1",
    source: "PharmGKB",
    evidence: "clinical (CPIC)",
    about: "A variant that strongly influences how much of the blood thinner warfarin a person needs — one of the best-established pharmacogenetic links.",
    outcomes: {
      GG: { label: "Standard sensitivity", detail: "The common form — typically needs a standard warfarin dose.", tone: "neutral" },
      AG: { label: "Increased sensitivity", detail: "One copy — usually needs a lower warfarin dose to avoid over-thinning.", tone: "notable" },
      AA: { label: "High sensitivity", detail: "Two copies — needs a notably lower warfarin dose. This is clinically actionable — a doctor uses genotype-guided dosing here.", tone: "notable", tip: "If you're ever prescribed warfarin, mention this — but dosing is decided by a clinician on a validated test, never a consumer chip." },
    },
  },
  {
    id: "clopidogrel",
    rsid: "rs4244285",
    category: "pharma",
    title: "Clopidogrel (Plavix) response",
    gene: "CYP2C19",
    source: "PharmGKB",
    evidence: "clinical (CPIC)",
    about: "Whether you activate clopidogrel — a common anti-clotting drug after heart procedures. Poor metabolizers get less benefit from it.",
    outcomes: {
      GG: { label: "Normal activator", detail: "The functional form — you activate clopidogrel normally.", tone: "neutral" },
      AG: { label: "Reduced activator", detail: "One loss-of-function copy — reduced activation, so clopidogrel may work less well.", tone: "notable" },
      AA: { label: "Poor activator", detail: "Two loss-of-function copies — clopidogrel is poorly activated; clinicians often choose an alternative. Actionable, but only a doctor decides on a validated test.", tone: "notable" },
    },
  },
  {
    id: "malignant-hyperthermia",
    rsid: "rs1801086",
    category: "pharma",
    title: "Anaesthetic sensitivity (RYR1)",
    gene: "RYR1",
    source: "ClinVar",
    evidence: "clinical",
    about: "A rare but serious reaction to certain general anaesthetics. A consumer chip covers only a few of the many RYR1 variants — a normal result here does NOT rule it out.",
    outcomes: {
      CC: { label: "No flagged variant", detail: "None of the tested RYR1 risk variants present — but a chip can't see most of them, so this is not clearance.", tone: "neutral" },
      CT: { label: "Variant present — confirm", detail: "A tested variant is present. This must be confirmed clinically; tell an anaesthetist before any surgery.", tone: "notable" },
    },
  },
]
