/**
 * dna-ancestry-private — the PERSONAL ancestry overlay accessor.
 *
 * Ankur's real MyHeritage "Ancient Origins" composition is personal data a raw
 * SNP CSV can't reproduce, so it must NEVER be published to this public repo.
 * It lives in `./dna-ancestry.local.ts`, which is committed ONLY as a null stub
 * and then marked `git update-index --skip-worktree` so local edits (the real
 * numbers) are never staged/committed. On the public site the stub returns null
 * and the UI falls back to the generic educational journey — same
 * "local-only, never publish personal data" model as the rest of the DNA page
 * ([[project_dna_page]]).
 *
 * To fill it in locally (one time):
 *   1. edit lib/dna-ancestry.local.ts with your real AncestryProfile
 *   2. run: git update-index --skip-worktree lib/dna-ancestry.local.ts
 *      (so git ignores your edits; `--no-skip-worktree` to undo)
 */

import type { AncestryProfile } from "./dna-journey"
import { ANCESTRY } from "./dna-ancestry.local"

export function getPrivateAncestry(): AncestryProfile | null {
  return ANCESTRY
}
