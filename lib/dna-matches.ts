/**
 * dna-matches — data model + a PUBLIC demo dataset for the Chromosome Browser and
 * AutoClusters tools.
 *
 * DNA-match data (who you share segments with, and where) is inherently
 * multi-person and can't come from your own raw CSV — it lives in a testing
 * company's user database. So the tools run on:
 *   • a synthetic DEMO set (below) for public visitors — enough to show exactly
 *     how segment-painting and clustering work, with invented people, or
 *   • a real LOCAL overlay (lib/dna-matches.local.ts, a committed null stub +
 *     skip-worktree) when someone drops their own exported match list in locally.
 *
 * No real personal match data is ever committed.
 */

/** The 22 autosomes + X, with approximate lengths in cM (genetic distance). */
export const CHROMOSOME_CM: { chr: string; cm: number }[] = [
  { chr: "1", cm: 281 }, { chr: "2", cm: 264 }, { chr: "3", cm: 224 }, { chr: "4", cm: 214 },
  { chr: "5", cm: 209 }, { chr: "6", cm: 194 }, { chr: "7", cm: 187 }, { chr: "8", cm: 169 },
  { chr: "9", cm: 167 }, { chr: "10", cm: 174 }, { chr: "11", cm: 158 }, { chr: "12", cm: 170 },
  { chr: "13", cm: 126 }, { chr: "14", cm: 120 }, { chr: "15", cm: 132 }, { chr: "16", cm: 131 },
  { chr: "17", cm: 129 }, { chr: "18", cm: 121 }, { chr: "19", cm: 111 }, { chr: "20", cm: 100 },
  { chr: "21", cm: 63 }, { chr: "22", cm: 71 }, { chr: "X", cm: 180 },
]

export type SharedSegment = {
  chr: string
  /** segment start / end in cM along that chromosome. */
  startCm: number
  endCm: number
}

export type DnaMatch = {
  id: string
  name: string
  /** total shared cM (sum of segments). */
  totalCm: number
  /** the actual shared segments, for the chromosome browser. */
  segments: SharedSegment[]
  /** which side / ancestral cluster this match falls into (for AutoClusters). */
  cluster: string
  /** a best-guess relationship label. */
  relationship: string
}

/** A synthetic demo match set — invented people, plausible segment layouts, two
 *  clear clusters ("maternal" / "paternal") so AutoClusters has structure to
 *  find. Purely illustrative. */
export const DEMO_MATCHES: DnaMatch[] = [
  {
    id: "m1", name: "A. Rivera", totalCm: 1720, relationship: "Aunt / Uncle", cluster: "Maternal",
    segments: [
      { chr: "1", startCm: 0, endCm: 120 }, { chr: "3", startCm: 40, endCm: 180 },
      { chr: "6", startCm: 0, endCm: 90 }, { chr: "11", startCm: 60, endCm: 158 },
      { chr: "15", startCm: 0, endCm: 80 }, { chr: "20", startCm: 20, endCm: 100 },
    ],
  },
  {
    id: "m2", name: "B. Okafor", totalCm: 860, relationship: "First cousin", cluster: "Maternal",
    segments: [
      { chr: "1", startCm: 10, endCm: 110 }, { chr: "4", startCm: 0, endCm: 130 },
      { chr: "6", startCm: 20, endCm: 85 }, { chr: "12", startCm: 40, endCm: 140 },
      { chr: "18", startCm: 0, endCm: 90 },
    ],
  },
  {
    id: "m3", name: "C. Haddad", totalCm: 402, relationship: "First cousin once removed", cluster: "Maternal",
    segments: [
      { chr: "1", startCm: 30, endCm: 100 }, { chr: "6", startCm: 30, endCm: 80 },
      { chr: "9", startCm: 20, endCm: 120 }, { chr: "16", startCm: 0, endCm: 90 },
    ],
  },
  {
    id: "m4", name: "D. Lindqvist", totalCm: 1650, relationship: "Grandparent", cluster: "Paternal",
    segments: [
      { chr: "2", startCm: 0, endCm: 200 }, { chr: "5", startCm: 20, endCm: 180 },
      { chr: "7", startCm: 0, endCm: 120 }, { chr: "10", startCm: 40, endCm: 174 },
      { chr: "14", startCm: 0, endCm: 100 }, { chr: "22", startCm: 0, endCm: 71 },
    ],
  },
  {
    id: "m5", name: "E. Moreau", totalCm: 690, relationship: "First cousin", cluster: "Paternal",
    segments: [
      { chr: "2", startCm: 30, endCm: 160 }, { chr: "5", startCm: 40, endCm: 150 },
      { chr: "8", startCm: 0, endCm: 110 }, { chr: "13", startCm: 20, endCm: 120 },
      { chr: "19", startCm: 0, endCm: 80 },
    ],
  },
  {
    id: "m6", name: "F. Yamada", totalCm: 233, relationship: "Second cousin", cluster: "Paternal",
    segments: [
      { chr: "2", startCm: 60, endCm: 150 }, { chr: "7", startCm: 30, endCm: 100 },
      { chr: "17", startCm: 0, endCm: 90 },
    ],
  },
  {
    id: "m7", name: "G. Costa", totalCm: 96, relationship: "Third cousin", cluster: "Unclustered",
    segments: [
      { chr: "3", startCm: 100, endCm: 160 }, { chr: "21", startCm: 0, endCm: 55 },
    ],
  },
]
