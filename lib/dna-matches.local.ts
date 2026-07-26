/**
 * dna-matches.local — PERSONAL DNA-match overlay (local-only).
 *
 * Committed as a NULL STUB: the public site ships no personal match data, so the
 * Chromosome Browser / AutoClusters run on the synthetic DEMO_MATCHES instead.
 *
 * To use YOUR real matches locally:
 *   1. Replace `null` with a DnaMatch[] (export your match+segment list from the
 *      testing site; keep names anonymised if you like).
 *   2. Tell git to ignore your edits so they never commit:
 *        git update-index --skip-worktree lib/dna-matches.local.ts
 */

import type { DnaMatch } from "./dna-matches"

export const MATCHES: DnaMatch[] | null = null
