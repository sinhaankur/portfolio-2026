/**
 * dna-matches-source — resolves which match set the tools use: a person's real
 * LOCAL overlay when present, otherwise the public synthetic demo. Mirrors the
 * ancestry overlay pattern (see lib/dna-ancestry-private.ts).
 */

import { DEMO_MATCHES, type DnaMatch } from "./dna-matches"
import { MATCHES } from "./dna-matches.local"

/** The real local matches if provided, otherwise the demo set. Also reports
 *  which one so the UI can label the demo honestly. */
export function getMatches(): { matches: DnaMatch[]; isDemo: boolean } {
  if (MATCHES && MATCHES.length > 0) return { matches: MATCHES, isDemo: false }
  return { matches: DEMO_MATCHES, isDemo: true }
}
