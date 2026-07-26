/**
 * dna-cm — the math behind the "cM Explainer": from a shared-DNA amount (in
 * centimorgans) to the relationships that amount is consistent with.
 *
 * A centimorgan (cM) measures genetic distance; two people who share DNA share
 * some total cM, and that total narrows down how they're related. This uses the
 * community "Shared cM Project" reference ranges (Blaine Bettinger et al., CC0 /
 * public reference), which aggregate tens of thousands of real known
 * relationships into an average + observed range per relationship. We report
 * every relationship whose observed range spans the entered value, ranked by how
 * close the entry sits to that relationship's average.
 *
 * This is a probability aid, NOT a verdict: many relationships overlap at a given
 * cM (e.g. half-sibling ≈ grandparent ≈ aunt/uncle), which is exactly why the
 * tool shows the full candidate set instead of a single answer.
 */

export type CmRelationship = {
  label: string
  /** average total shared cM for this relationship. */
  avg: number
  /** observed [min, max] shared cM across known cases. */
  range: [number, number]
  /** rough "degree of separation" group, for grouping in the UI. */
  group: "self/twin" | "immediate" | "close" | "mid" | "distant"
  /** plain description of the relationship. */
  note: string
}

/** Shared cM Project reference values (v4-era averages + observed ranges).
 *  Full siblings ~2613 avg; parent/child a near-fixed ~3485; identical twin
 *  ~3487 (the whole genome). Ranges widen with distance as recombination varies. */
export const CM_RELATIONSHIPS: CmRelationship[] = [
  { label: "Identical twin", avg: 3487, range: [3330, 3720], group: "self/twin", note: "The entire genome is shared — indistinguishable from yourself genetically." },
  { label: "Parent / Child", avg: 3485, range: [3330, 3720], group: "immediate", note: "You inherit exactly half your DNA from each parent — a near-fixed amount." },
  { label: "Full sibling", avg: 2613, range: [1613, 3488], group: "immediate", note: "Same two parents; the amount varies with how the parents' DNA recombined." },
  { label: "Grandparent / Grandchild", avg: 1754, range: [984, 2462], group: "close", note: "One generation removed — about a quarter of the genome, on average." },
  { label: "Aunt / Uncle · Niece / Nephew", avg: 1740, range: [1201, 2282], group: "close", note: "A parent's sibling (or your sibling's child)." },
  { label: "Half sibling", avg: 1759, range: [1160, 2436], group: "close", note: "One shared parent." },
  { label: "Great-grandparent", avg: 887, range: [464, 1486], group: "mid", note: "Two generations up." },
  { label: "First cousin", avg: 866, range: [396, 1397], group: "mid", note: "You share a set of grandparents." },
  { label: "Half aunt/uncle · Half niece/nephew", avg: 871, range: [492, 1315], group: "mid", note: "Related through a half-sibling line." },
  { label: "First cousin once removed", avg: 433, range: [102, 980], group: "mid", note: "Your first cousin's child (or your parent's first cousin)." },
  { label: "Half first cousin", avg: 449, range: [156, 979], group: "mid", note: "First cousins through a half-sibling line." },
  { label: "Second cousin", avg: 229, range: [41, 592], group: "distant", note: "You share a set of great-grandparents." },
  { label: "First cousin twice removed", avg: 221, range: [43, 531], group: "distant", note: "Two generations offset from a first cousin." },
  { label: "Second cousin once removed", avg: 122, range: [14, 353], group: "distant", note: "One generation offset from a second cousin." },
  { label: "Third cousin", avg: 73, range: [0, 217], group: "distant", note: "Shared great-great-grandparents." },
  { label: "Third cousin once removed", avg: 48, range: [0, 173], group: "distant", note: "One generation offset from a third cousin." },
  { label: "Fourth cousin", avg: 35, range: [0, 139], group: "distant", note: "Shared 3rd-great-grandparents — the edge of reliable detection." },
  { label: "Fifth cousin or more distant", avg: 25, range: [0, 117], group: "distant", note: "Very distant; often indistinguishable from no detectable relationship." },
]

export type CmMatch = CmRelationship & {
  /** 0..1 closeness of the entered cM to this relationship's average (1 = exact). */
  fit: number
}

/** Given a shared-cM value, return the relationships whose observed range spans
 *  it, ranked by closeness to the relationship average (best first). */
export function relationshipsForCm(cm: number): CmMatch[] {
  if (!Number.isFinite(cm) || cm < 0) return []
  return CM_RELATIONSHIPS.filter((r) => cm >= r.range[0] && cm <= r.range[1])
    .map((r) => {
      // fit: how close cm is to the average, normalized by the half-range so
      // wide-range relationships aren't unfairly penalized.
      const halfSpan = Math.max(1, (r.range[1] - r.range[0]) / 2)
      const fit = Math.max(0, 1 - Math.abs(cm - r.avg) / halfSpan)
      return { ...r, fit }
    })
    .sort((a, b) => b.fit - a.fit)
}

/** Convert a shared-cM total to an approximate percent of the genome shared.
 *  The autosomal genome is ~6800 cM total; two people share 2× that pool logic,
 *  but the conventional "% shared" divides total shared cM by ~6800. */
export function cmToPercent(cm: number): number {
  const TOTAL_AUTOSOMAL_CM = 6800
  return Math.max(0, Math.min(100, (cm / TOTAL_AUTOSOMAL_CM) * 100))
}
