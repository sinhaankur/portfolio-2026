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
  /** the community's own endogamous sub-groups (jāti / clan / gotra), where
   *  they carry a distinct, documented genetic signature. See CasteGroup. */
  castes?: CasteGroup[]
}

/**
 * CasteGroup — a jāti / clan / community-level ENDOGAMOUS group.
 *
 * The single most important fact about South Asian genetics (Reich et al.
 * 2009; Nakatsuka et al. 2017, Nature Genetics, "The promise of disease gene
 * discovery in South Asia"): after ~2,000 years of endogamy, the strongest
 * genetic structure is NOT ancestry proportion — it's WHO A GROUP MARRIES.
 * Thousands of jātis are each their own small, closed pool. Two jātis in the
 * same village can carry nearly identical ANI/ASI proportions yet be as
 * genetically distinct from each other as separate European nations, because
 * each descends from a small founder set and has drifted in isolation since.
 *
 * We capture that with a FOUNDER-EFFECT read rather than an ancestry mix:
 *   • driftIndex   0–100 — how strongly bottlenecked / isolated the pool is.
 *                  High = a small founder group + long endogamy → long runs of
 *                  shared DNA (IBD), elevated recessive-disease risk, a
 *                  distinctive cluster. (Nakatsuka: many groups have a founder
 *                  event STRONGER than the Ashkenazi or Finnish bottleneck.)
 *   • foundersEst  a plain-language read of the effective founding size.
 *   • note         what's documented about this group's pool.
 */
export type CasteGroup = {
  id: string
  /** jāti / clan / gotra / community name. */
  name: string
  /** varna / broad social category, purely as context (Brahmin, Kshatriya-like,
   *  merchant, agrarian, artisan, Dalit, tribal…) — NOT a ranking. */
  category: string
  driftIndex: number
  foundersEst: string
  /** HOW LONG the pool has been closed — the timeline depth. `endogamyYears`
   *  is the approximate age of the founder / start-of-endogamy event in years
   *  before present (some are millennia, some only a century — we want both).
   *  `since` is the plain-language era label shown on the timeline. */
  endogamyYears: number
  since: string
  note: string
  /** IBD / recessive-disease consequence of the closed pool. A small founder
   *  set + long endogamy means everyone shares long identical DNA segments
   *  (identity-by-descent), which concentrates recessive founder variants — the
   *  same population-genetics reason Ashkenazi/Finnish carrier screening exists.
   *  This is the medically ACTIONABLE payoff of the founder-effect read, framed
   *  as risk/screening awareness, never destiny. Present where documented. */
  founderDisease?: {
    /** rough IBD read — how much long shared-segment DNA members carry, a proxy
     *  for founder-variant load. "high" / "elevated" / "moderate". */
    ibd: "high" | "elevated" | "moderate"
    /** documented / reported founder conditions enriched in this pool. */
    conditions: string[]
    /** one honest line of context. */
    note: string
  }
}

/** Timeline anchors (years before present) for the "isolated since" scale —
 *  a shared axis so a 2,000-year-old jāti and a 100-year-old community read on
 *  the same ruler. Deep past on the left, living memory on the right. Each
 *  anchor carries WHAT WAS HAPPENING then, so the age of a pool connects to the
 *  history that formed it. */
export const TIMELINE_ANCHORS: { years: number; label: string; context: string }[] = [
  { years: 4000, label: "Bronze Age", context: "Indus/Harappan cities thrive; Iranian-farmer + AASI ancestry already mixing across the northwest. Bronze-Age Steppe pastoralists then move in from Central Asia and the ANI (Ancestral North Indian) pool forms." },
  { years: 2000, label: "~0 CE", context: "Widespread ANI↔ASI mixing across the subcontinent — then, over the next centuries, it largely STOPS." },
  { years: 1600, label: "Gupta era", context: "Endogamy hardens: qpAdm dates put the founder events of MANY modern jātis around here — pools close and stay closed." },
  { years: 1000, label: "~1000 CE", context: "Regional kingdoms; jāti structure entrenched. Turkic/Central-Asian and later Islamic gene flow enters the northwest." },
  { years: 500, label: "Mughal era", context: "Empire-scale movement, trade diasporas (Parsis settled far earlier); some merchant + service communities crystallise." },
  { years: 200, label: "Colonial", context: "The British census RIGIDIFIES caste categories; new occupational + religious-convert communities begin their own endogamy." },
  { years: 100, label: "~1920s", context: "Recent founder communities — migrant, sectarian and diaspora groups whose closed marriage pool is only a few generations old." },
  { years: 0, label: "today", context: "Most groups still marry within — the pools that formed centuries or millennia ago are still measurably distinct in DNA." },
]

/**
 * The tribes / communities. Grouped loosely by geography but the POINT of the
 * tool is that neighbours across a border share the same pool — so the
 * northwest cluster (Sindhi/Punjabi/Baluch/Pashtun) sits together regardless
 * of which modern country a given community lives in.
 */
export const TRIBES: Tribe[] = [
  // — Northwest (the Indus gradient) —
  { id: "sindhi", name: "Sindhi", region: "Indus Valley", at: [26, 68], panel: "—", mix: { AASI: 22, IRAN: 45, STEP: 30, EASI: 3 }, blurb: "Lower Indus community; high Iranian-farmer ancestry, the Harappan heartland signal.", castes: [
    { id: "sindhi-lohana", name: "Lohana", category: "Merchant / trading", driftIndex: 62, foundersEst: "small merchant founder set", endogamyYears: 700, since: "~1300s", note: "Mercantile community with a tight trading-network endogamy; a distinctive drifted pool." },
    { id: "sindhi-bhaiband", name: "Bhaiband", category: "Merchant / trading", driftIndex: 58, foundersEst: "trader lineage founders", endogamyYears: 500, since: "Mughal era", note: "Sindhi trading sub-community whose global diaspora kept marrying within." },
  ] },
  { id: "punjabi", name: "Punjabi", region: "Indus Valley", at: [31, 74], panel: "PJL", mix: { AASI: 25, IRAN: 40, STEP: 32, EASI: 3 }, blurb: "The Punjab plain either side of the border; the classic northwestern mix, close to the Sindhi pool.", castes: [
    { id: "punjabi-khatri", name: "Khatri", category: "Merchant / scribe", driftIndex: 60, foundersEst: "modest founder set", endogamyYears: 800, since: "~1200s", note: "Trading + administrative community; a compact, drifted pool across Punjab.", founderDisease: { ibd: "elevated", conditions: ["founder recessive variants"], note: "Compact trading-network pool → shared founder segments." } },
    { id: "punjabi-arora", name: "Arora", category: "Merchant / trading", driftIndex: 57, foundersEst: "modest founder set", endogamyYears: 700, since: "~1300s", note: "West-Punjab merchant community closely allied to the Khatri pool." },
    { id: "punjabi-ramgarhia", name: "Ramgarhia", category: "Artisan (Sikh)", driftIndex: 55, foundersEst: "artisan-caste founders", endogamyYears: 300, since: "Colonial", note: "Carpenter-smith Sikh community whose endogamy hardened in the last few centuries." },
  ] },
  { id: "baluch", name: "Baluch", region: "Indus Valley", at: [28, 65], mix: { AASI: 15, IRAN: 55, STEP: 27, EASI: 3 }, blurb: "Western frontier pastoralists; the highest Iranian-related share, blending toward the plateau." },
  { id: "pashtun", name: "Pashtun / Pathan", region: "Hindu Kush", at: [33, 70], mix: { AASI: 14, IRAN: 44, STEP: 39, EASI: 3 }, blurb: "Hindu-Kush communities; elevated steppe ancestry, continuous with Central Asia.", castes: [
    { id: "pashtun-tribe", name: "Tribal (Durrani / Ghilzai)", category: "Tribal confederation", driftIndex: 50, foundersEst: "clan-based founders", endogamyYears: 900, since: "~1100s", note: "Patrilineal clan (khel) endogamy; cousin marriage keeps each tribe a distinct pool." },
  ] },
  { id: "kashmiri", name: "Kashmiri", region: "Himalaya (west)", at: [34, 75], mix: { AASI: 20, IRAN: 42, STEP: 35, EASI: 3 }, blurb: "Vale-of-Kashmir community; northwestern pool with a Himalayan tilt.", castes: [
    { id: "kashmiri-pandit", name: "Kashmiri Pandit", category: "Brahmin", driftIndex: 68, foundersEst: "small valley founder set", endogamyYears: 1500, since: "Gupta era", note: "Isolated Brahmin community of the Vale; long endogamy + geographic isolation → a strongly drifted pool.", founderDisease: { ibd: "high", conditions: ["elevated consanguinity-linked recessive load"], note: "Small, mountain-isolated founder pool → long shared IBD segments; a candidate for community carrier screening." } },
    { id: "kashmiri-muslim", name: "Kashmiri Muslim", category: "Convert community (Islam)", driftIndex: 40, foundersEst: "the local valley pool", endogamyYears: 700, since: "~1300s", note: "Genetically the SAME Kashmiri valley pool that converted to Islam from the 14th c. — faith changed, ancestry did not. Cousin-marriage tradition raises its own IBD." },
  ] },

  // — North & Gangetic plain —
  { id: "jat", name: "Jat", region: "North India / Punjab", at: [29, 76], mix: { AASI: 28, IRAN: 36, STEP: 33, EASI: 3 }, blurb: "Agrarian community of the northwestern plains; strong steppe component.", castes: [
    { id: "jat-north", name: "Jat (agrarian got)", category: "Agrarian", driftIndex: 48, foundersEst: "large agrarian pool", endogamyYears: 700, since: "~1300s", note: "Exogamous by got (clan) but endogamous by caste; a big pool, so weaker drift than the merchant jātis." },
  ] },
  { id: "brahmin-n", name: "Brahmin (North)", region: "Gangetic plain", at: [27, 80], mix: { AASI: 30, IRAN: 35, STEP: 32, EASI: 3 }, blurb: "Traditionally priestly community; among the higher steppe + Iranian shares in the north.", castes: [
    { id: "brahmin-gaur", name: "Gaur Brahmin", category: "Brahmin", driftIndex: 64, foundersEst: "priestly founder lineages", endogamyYears: 1800, since: "~200 CE", note: "Among the OLDEST founder events — qpAdm dates many Brahmin jātis to ~2,000 years ago; gotra exogamy inside caste endogamy." },
    { id: "brahmin-kanyakubja", name: "Kanyakubja Brahmin", category: "Brahmin", driftIndex: 66, foundersEst: "priestly founder lineages", endogamyYears: 1700, since: "Gupta era", note: "Gangetic Brahmin community with a deep, tightly maintained pool." },
  ] },
  { id: "up-hindustani", name: "Hindustani (UP/Bihar)", region: "Gangetic plain", at: [26, 82], mix: { AASI: 42, IRAN: 33, STEP: 22, EASI: 3 }, blurb: "Central Gangetic communities — the middle of the AASI↔ANI cline.", castes: [
    { id: "up-yadav", name: "Yadav / Ahir", category: "Pastoral-agrarian", driftIndex: 46, foundersEst: "large pastoral pool", endogamyYears: 800, since: "~1200s", note: "Big pastoral-agrarian community; caste endogamy with clan exogamy, moderate drift." },
    { id: "up-kayastha", name: "Kayastha", category: "Scribe / administrative", driftIndex: 59, foundersEst: "scribal founder set", endogamyYears: 1000, since: "~1000 CE", note: "Record-keeping community; a compact administrative pool with clear drift." },
    { id: "up-chamar", name: "Chamar / Jatav (Dalit)", category: "Dalit (scheduled caste)", driftIndex: 60, foundersEst: "small local founder sets", endogamyYears: 1500, since: "Gupta era", note: "One of the largest Dalit communities; enforced separation kept many local sub-pools small and endogamous → real founder structure over the Gangetic base.", founderDisease: { ibd: "elevated", conditions: ["founder-variant enrichment in local sub-pools"], note: "Historically under-studied; equitable screening should include these pools." } },
    { id: "up-ashraf", name: "Ashraf / Pathan (UP Muslim)", category: "Convert + migrant (Islam)", driftIndex: 44, foundersEst: "local pool + some Central-Asian input", endogamyYears: 800, since: "~1200s", note: "North-Indian Muslim communities — mostly the local Gangetic pool that converted, with a thin Central-Asian/Afghan admixture layer in some lineages (biraderi endogamy)." },
  ] },

  // — West / Deccan —
  { id: "marathi", name: "Marathi (Maharashtra)", region: "Deccan (west)", at: [19, 76], mix: { AASI: 44, IRAN: 33, STEP: 20, EASI: 3 }, blurb: "Western-Deccan communities; a balanced mid-cline pool bridging the north and the south.", castes: [
    { id: "marathi-ckp", name: "Chandraseniya Kayastha Prabhu (CKP)", category: "Scribe / administrative", driftIndex: 63, foundersEst: "small scribal founder set", endogamyYears: 1000, since: "~1000 CE", note: "A small, tightly endogamous administrative community — a compact, well-drifted Deccan pool.", founderDisease: { ibd: "elevated", conditions: ["founder recessive variants"], note: "Small closed pool → concentrated founder segments." } },
    { id: "marathi-maratha", name: "Maratha / Kunbi", category: "Agrarian (landholding)", driftIndex: 48, foundersEst: "large agrarian pool", endogamyYears: 800, since: "~1200s", note: "The large agrarian-warrior community of Maharashtra; a big pool, so moderate drift." },
    { id: "marathi-mahar", name: "Mahar (Dalit)", category: "Dalit (scheduled caste)", driftIndex: 62, foundersEst: "small local founder sets", endogamyYears: 1500, since: "Gupta era", note: "Major Maharashtrian Dalit community (Ambedkar's own); enforced separation → small, deeply endogamous pools with real founder structure.", founderDisease: { ibd: "elevated", conditions: ["founder-variant enrichment"], note: "Under-studied enforced-separation pools; belongs in equitable screening." } },
  ] },

  // — East & Northeast —
  { id: "bengali", name: "Bengali", region: "Bengal delta", at: [23, 89], panel: "BEB", mix: { AASI: 45, IRAN: 25, STEP: 14, EASI: 16 }, blurb: "Delta communities either side of the border; a real East-Asian-related layer appears here.", castes: [
    { id: "bengali-brahmin", name: "Bengali Brahmin (Kulin)", category: "Brahmin", driftIndex: 61, foundersEst: "Kulin founder lineages", endogamyYears: 900, since: "~1100s", note: "Kulin reforms formalised a tight marriage circle; a drifted Brahmin pool over the East-Asian-tinged Bengali base.", founderDisease: { ibd: "elevated", conditions: ["founder recessive variants"], note: "The Kulin marriage circle tightened the pool → concentrated founder segments." } },
    { id: "bengali-kayastha", name: "Bengali Kayastha", category: "Scribe / administrative", driftIndex: 57, foundersEst: "scribal founder set", endogamyYears: 900, since: "~1100s", note: "Administrative community closely paired with the Bengali Brahmin pool." },
    { id: "bengali-muslim", name: "Bengali Muslim", category: "Convert community (Islam)", driftIndex: 38, foundersEst: "the local delta pool", endogamyYears: 700, since: "~1300s", note: "The majority Bengali population; genetically the SAME delta pool (AASI-heavy with an East-Asian layer) that converted to Islam from the 13th c. — a huge pool, so weak drift despite the timeline." },
  ] },
  { id: "odia", name: "Odia", region: "Eastern India", at: [20, 85], mix: { AASI: 52, IRAN: 24, STEP: 14, EASI: 10 }, blurb: "Coastal eastern community; shifted toward the deep AASI layer, close to the Bengali pool." },
  { id: "assamese", name: "Assamese / NE tribes", region: "Northeast India", at: [26, 93], mix: { AASI: 30, IRAN: 12, STEP: 6, EASI: 52 }, blurb: "Brahmaputra + hill communities; the strongest East-Asian / Tibeto-Burman signal in the subcontinent.", castes: [
    { id: "ne-tribal", name: "Hill tribes (Naga / Mizo-like)", category: "Tribal", driftIndex: 72, foundersEst: "small village founder sets", endogamyYears: 1200, since: "~800s", note: "Village- and clan-endogamous hill communities; small pools + isolation → strong, distinctive drift.", founderDisease: { ibd: "high", conditions: ["village-specific founder variants"], note: "Tiny isolated founder pools → very long shared segments; each village can carry its own recessive variants." } },
  ] },

  // — South (Dravidian + tribal) —
  { id: "tamil", name: "Tamil", region: "South India", at: [11, 78], panel: "STU", mix: { AASI: 55, IRAN: 30, STEP: 12, EASI: 3 }, blurb: "Dravidian-speaking community; toward the AASI end, with a strong Iranian-farmer layer.", castes: [
    { id: "tamil-brahmin", name: "Tamil Brahmin (Iyer/Iyengar)", category: "Brahmin", driftIndex: 65, foundersEst: "priestly founder lineages", endogamyYears: 1600, since: "Gupta era", note: "Deep founder event + strict endogamy; a well-studied, strongly drifted southern Brahmin pool.", founderDisease: { ibd: "elevated", conditions: ["founder recessive variants"], note: "Deep, tightly maintained pool → concentrated founder variants; a screening candidate." } },
    { id: "tamil-vellalar", name: "Vellalar", category: "Agrarian (landholding)", driftIndex: 54, foundersEst: "landholding founders", endogamyYears: 1000, since: "~1000 CE", note: "Landholding Tamil community; a substantial but clearly endogamous pool." },
    { id: "tamil-nadar", name: "Nadar", category: "Agrarian / merchant", driftIndex: 60, foundersEst: "regional founder set", endogamyYears: 700, since: "~1300s", note: "Southern Tamil community; documented founder event and elevated shared-DNA within.", founderDisease: { ibd: "elevated", conditions: ["founder recessive variants"], note: "Documented founder event; members share long IBD segments." } },
    { id: "tamil-paravar", name: "Paravar (Christian converts)", category: "Convert community (Christian)", driftIndex: 58, foundersEst: "coastal fishing founder set", endogamyYears: 500, since: "~1500s", note: "Coastal fishing community converted to Catholicism in the 16th c. (Portuguese era) — the same South-Indian coastal pool, still endogamous after conversion." },
    { id: "tamil-dalit", name: "Paraiyar / Arunthathiyar (Dalit)", category: "Dalit (scheduled caste)", driftIndex: 63, foundersEst: "small local founder sets", endogamyYears: 1500, since: "Gupta era", note: "Dalit communities were among the MOST strictly endogamised — forced social separation produced small, deeply isolated pools, so several carry strong founder effects and their own drift.", founderDisease: { ibd: "high", conditions: ["strong founder-variant enrichment"], note: "Enforced separation → small closed pools with high IBD; a priority for equitable carrier screening that historically got least attention." } },
  ] },
  { id: "telugu", name: "Telugu", region: "South India", at: [17, 79], panel: "ITU", mix: { AASI: 52, IRAN: 31, STEP: 14, EASI: 3 }, blurb: "Deccan Dravidian community; very close to the Tamil pool — a border makes no genetic difference.", castes: [
    { id: "telugu-reddy", name: "Reddy", category: "Agrarian (landholding)", driftIndex: 56, foundersEst: "landholding founders", endogamyYears: 900, since: "~1100s", note: "Deccan landholding community; a distinct, moderately drifted pool." },
    { id: "telugu-kamma", name: "Kamma", category: "Agrarian (landholding)", driftIndex: 58, foundersEst: "landholding founders", endogamyYears: 900, since: "~1100s", note: "Landholding community paired with the Reddy pool; documented founder structure." },
    { id: "telugu-komati", name: "Komati / Vaishya", category: "Merchant / trading", driftIndex: 66, foundersEst: "small merchant founder set", endogamyYears: 1000, since: "~1000 CE", note: "Merchant community with one of the STRONGER South-Indian founder events — a tightly closed trading pool.", founderDisease: { ibd: "high", conditions: ["strong founder-variant enrichment"], note: "Among the sharpest South-Indian founder effects documented — long IBD segments, a clear screening candidate." } },
    { id: "telugu-madiga", name: "Madiga / Mala (Dalit)", category: "Dalit (scheduled caste)", driftIndex: 64, foundersEst: "small local founder sets", endogamyYears: 1500, since: "Gupta era", note: "Deccan Dalit communities; enforced endogamy produced small, deeply drifted pools with their own founder structure.", founderDisease: { ibd: "high", conditions: ["founder-variant enrichment"], note: "Small enforced-separation pools carry high IBD; historically least screened." } },
  ] },
  { id: "gujarati", name: "Gujarati", region: "West India", at: [22, 72], panel: "GIH", mix: { AASI: 38, IRAN: 38, STEP: 21, EASI: 3 }, blurb: "Western coastal + inland communities; balanced AASI/Iranian, the 1000-Genomes GIH panel.", castes: [
    { id: "guj-patel", name: "Patel / Patidar", category: "Agrarian (landholding)", driftIndex: 55, foundersEst: "landholding founders", endogamyYears: 600, since: "~1400s", note: "Landholding-turned-diaspora community; endogamy held even across global migration." },
    { id: "guj-vania", name: "Vania (Jain/Hindu merchant)", category: "Merchant / trading", driftIndex: 62, foundersEst: "merchant founder set", endogamyYears: 900, since: "~1100s", note: "Merchant community, some Jain; a compact, drifted trading pool." },
    { id: "guj-parsi", name: "Parsi (Zoroastrian)", category: "Religious diaspora", driftIndex: 74, foundersEst: "~few hundred refugees", endogamyYears: 1200, since: "~800s", note: "Zoroastrian refugees from Persia (~8th c.) who stayed strictly endogamous — one of the most striking small closed pools, with real Iranian ancestry retained.", founderDisease: { ibd: "high", conditions: ["autosomal-recessive founder disorders", "reported cancer-incidence differences"], note: "One of the world's most-studied small endogamous pools; the tight founder set concentrates specific variants — a textbook founder-effect community." } },
    { id: "guj-bohra", name: "Dawoodi Bohra", category: "Convert community (Islam)", driftIndex: 60, foundersEst: "small mercantile founder set", endogamyYears: 900, since: "~1100s", note: "Shia Ismaili merchant community, converts from the Gujarati trading pool; strict endogamy + a compact founder set → a distinctly drifted group.", founderDisease: { ibd: "elevated", conditions: ["consanguinity-linked recessive load"], note: "Endogamous + cousin-marriage tradition raises long shared-segment DNA." } },
  ] },
  { id: "adivasi-s", name: "Adivasi (South/Central)", region: "Central India", at: [21, 81], mix: { AASI: 72, IRAN: 18, STEP: 7, EASI: 3 }, blurb: "Tribal communities (e.g. Gond, Paniya-like); the closest surviving proxy to the deep AASI layer.", castes: [
    { id: "adivasi-gond", name: "Gond", category: "Tribal", driftIndex: 70, foundersEst: "small tribal founder sets", endogamyYears: 2000, since: "~0 CE", note: "Large Central-Indian tribe; deep AASI proxy with long tribal endogamy.", founderDisease: { ibd: "high", conditions: ["tribal founder variants", "sickle-cell trait enriched in several Central-Indian tribes"], note: "Deep, long-isolated pool; some Central-Indian tribes also carry elevated sickle-cell allele frequencies." } },
    { id: "adivasi-paniya", name: "Paniya-like", category: "Tribal", driftIndex: 80, foundersEst: "very small founder set", endogamyYears: 2500, since: "pre-mixing", note: "Among the highest-AASI, most-drifted groups sampled — a small, ancient, closed pool.", founderDisease: { ibd: "high", conditions: ["strong founder-variant enrichment"], note: "One of the smallest, most-drifted pools sampled — extreme IBD, the clearest AASI proxy." } },
  ] },

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
  "Deccan (west)",
  "Bengal delta",
  "Eastern India",
  "Northeast India",
  "Central India",
  "South India",
  "Sri Lanka",
  "Iran",
  "Central Asia",
]

/** Every caste/clan group across all tribes, flattened, each tagged with its
 *  parent tribe — for the endogamy timeline (one axis, all groups on it). */
export function allCasteGroups(): (CasteGroup & { tribe: Tribe })[] {
  const out: (CasteGroup & { tribe: Tribe })[] = []
  for (const t of TRIBES) {
    for (const c of t.castes ?? []) out.push({ ...c, tribe: t })
  }
  return out
}

/** The single most historically resonant read: for a given endogamy age (years
 *  before present), the timeline anchor whose era it falls in — so a group's age
 *  maps to "what was happening then". */
export function eraFor(years: number): { label: string; context: string } {
  // anchors are sorted deep→recent; pick the oldest anchor at or before `years`.
  let best = TIMELINE_ANCHORS[TIMELINE_ANCHORS.length - 1]
  for (const a of TIMELINE_ANCHORS) {
    if (years <= a.years) best = a
  }
  return { label: best.label, context: best.context }
}

/** Log-ish position (0=today at right → 1=deep past at left) for the timeline
 *  axis, so millennia and a single century both read on one ruler. */
export function timelinePos(years: number): number {
  const maxY = 4000
  // sqrt compresses the deep past so recent centuries still get visible spread.
  return Math.min(1, Math.sqrt(Math.max(0, years) / maxY))
}
