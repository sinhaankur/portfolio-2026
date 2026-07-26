/**
 * dna-ethnicities — public reference for the "Ethnicities Map" tool.
 *
 * A broad, region-level view of which genetic-ancestry groups are most common in
 * each part of the world, and where each group is most concentrated. This is
 * deliberately COARSE and educational: ancestry-composition categories are
 * fuzzy, overlapping, and modelled differently by every testing company. We use
 * continental / sub-continental groupings (the level population genetics actually
 * supports) and never imply a precise "you are X%" claim.
 *
 * Sourced from public population-genetics groupings (continental ancestry
 * clusters as used broadly across the field); percentages are illustrative
 * order-of-magnitude, not company figures.
 */

export type EthnicityGroup = {
  id: string
  label: string
  /** rough home regions where this ancestry is most concentrated. */
  homelands: string[]
  blurb: string
}

/** The broad ancestry groups (continental + major sub-continental). */
export const ETHNICITY_GROUPS: EthnicityGroup[] = [
  { id: "west-african", label: "West African", homelands: ["Nigeria", "Ghana", "Senegal", "Mali"], blurb: "The largest source of Sub-Saharan ancestry; deep human diversity — Africa holds more genetic variation than the rest of the world combined." },
  { id: "east-african", label: "East African", homelands: ["Ethiopia", "Somalia", "Kenya"], blurb: "Carries both deep African lineages and ancient back-to-Africa Eurasian admixture." },
  { id: "north-african", label: "North African", homelands: ["Morocco", "Algeria", "Egypt", "Tunisia"], blurb: "A blend of indigenous Berber, Near-Eastern and Mediterranean ancestries across the Sahara's northern edge." },
  { id: "nw-european", label: "Northwestern European", homelands: ["Britain", "Ireland", "France", "Germany", "Low Countries"], blurb: "A mix of early farmers, western hunter-gatherers and Bronze-Age steppe ancestry." },
  { id: "scandinavian", label: "Scandinavian", homelands: ["Norway", "Sweden", "Denmark", "Iceland"], blurb: "Northern-European ancestry with strong steppe and hunter-gatherer components; the Norse expansions spread it widely." },
  { id: "e-european", label: "Eastern European", homelands: ["Poland", "Russia", "Ukraine", "Balkans"], blurb: "Balto-Slavic ancestry with a large steppe component from the Bronze-Age expansions." },
  { id: "iberian", label: "Iberian", homelands: ["Spain", "Portugal"], blurb: "Mediterranean farmer ancestry layered with North-African and Near-Eastern gene flow." },
  { id: "italian", label: "Italian / Greek", homelands: ["Italy", "Greece", "Aegean"], blurb: "Deep Neolithic-farmer roots plus Near-Eastern and later Mediterranean admixture." },
  { id: "ashkenazi", label: "Ashkenazi Jewish", homelands: ["Central & Eastern Europe (diaspora)"], blurb: "A tightly bottlenecked population blending Near-Eastern and European ancestry; distinctive in DNA-match data." },
  { id: "near-eastern", label: "Near Eastern / Middle Eastern", homelands: ["Levant", "Arabia", "Iran", "Anatolia"], blurb: "Home of the Neolithic farmers who reshaped world diet; deep, layered ancestry." },
  { id: "south-asian", label: "South Asian", homelands: ["India", "Pakistan", "Bangladesh", "Nepal", "Sri Lanka"], blurb: "A mix of Ancient Ancestral South Indian hunter-gatherers, Indus-Valley/Iranian-farmer and steppe ancestry — one of the world's most populous ancestry groups." },
  { id: "central-asian", label: "Central Asian", homelands: ["Kazakhstan", "Uzbekistan", "Mongolia"], blurb: "A crossroads of steppe, East-Asian and Iranian ancestry along the Silk Road." },
  { id: "east-asian", label: "East Asian", homelands: ["China", "Japan", "Korea"], blurb: "Deep, relatively distinct ancestry with strong internal north–south structure." },
  { id: "se-asian", label: "Southeast Asian", homelands: ["Vietnam", "Thailand", "Philippines", "Indonesia"], blurb: "A blend of mainland East-Asian farming expansions and older indigenous lineages." },
  { id: "oceanian", label: "Oceanian / Papuan", homelands: ["Papua New Guinea", "Melanesia", "Aboriginal Australia"], blurb: "Carries the highest Denisovan ancestry on Earth — up to ~4–6%." },
  { id: "indigenous-americas", label: "Indigenous American", homelands: ["Andes", "Mesoamerica", "Amazonia", "North America"], blurb: "Descends from a founding population that crossed Beringia; distinctive and deeply structured across the continents." },
]

/** Region → the ancestry groups typically most common there (ids into the list
 *  above). Order = rough prominence. Coarse + illustrative. */
export type RegionEntry = {
  id: string
  region: string
  /** [lat, lng] for the map marker. */
  at: [number, number]
  groups: string[]
}

export const REGIONS: RegionEntry[] = [
  { id: "in", region: "India", at: [22, 79], groups: ["south-asian", "central-asian", "east-asian"] },
  { id: "pk", region: "Pakistan", at: [30, 69], groups: ["south-asian", "near-eastern", "central-asian"] },
  { id: "cn", region: "China", at: [35, 104], groups: ["east-asian", "central-asian", "se-asian"] },
  { id: "jp", region: "Japan", at: [36, 138], groups: ["east-asian"] },
  { id: "gb", region: "United Kingdom", at: [54, -2], groups: ["nw-european", "scandinavian", "e-european"] },
  { id: "de", region: "Germany", at: [51, 10], groups: ["nw-european", "e-european", "scandinavian"] },
  { id: "es", region: "Spain", at: [40, -4], groups: ["iberian", "north-african", "italian"] },
  { id: "it", region: "Italy", at: [42, 13], groups: ["italian", "near-eastern", "north-african"] },
  { id: "ng", region: "Nigeria", at: [9, 8], groups: ["west-african"] },
  { id: "et", region: "Ethiopia", at: [9, 40], groups: ["east-african", "near-eastern"] },
  { id: "eg", region: "Egypt", at: [26, 30], groups: ["north-african", "near-eastern", "east-african"] },
  { id: "ir", region: "Iran", at: [32, 53], groups: ["near-eastern", "central-asian", "south-asian"] },
  { id: "ru", region: "Russia", at: [61, 90], groups: ["e-european", "central-asian", "east-asian"] },
  { id: "mx", region: "Mexico", at: [23, -102], groups: ["indigenous-americas", "iberian", "west-african"] },
  { id: "br", region: "Brazil", at: [-10, -55], groups: ["iberian", "west-african", "indigenous-americas"] },
  { id: "au", region: "Australia", at: [-25, 134], groups: ["oceanian", "nw-european", "east-asian"] },
  { id: "ph", region: "Philippines", at: [13, 122], groups: ["se-asian", "east-asian", "iberian"] },
  { id: "sa", region: "Saudi Arabia / Arabia", at: [24, 45], groups: ["near-eastern", "east-african", "north-african"] },
]

/** Reverse index: which regions list a given group among their common ancestries. */
export function regionsForGroup(groupId: string): RegionEntry[] {
  return REGIONS.filter((r) => r.groups.includes(groupId))
}

export function groupById(id: string): EthnicityGroup | undefined {
  return ETHNICITY_GROUPS.find((g) => g.id === id)
}
