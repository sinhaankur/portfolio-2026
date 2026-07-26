/**
 * dna-ancestry.local — PERSONAL ancestry overlay (local-only).
 *
 * This committed version is a NULL STUB: the public site/repo ships no personal
 * ancestry data, so the DNA journey falls back to the generic educational arc.
 *
 * To show YOUR real MyHeritage "Ancient Origins" journey locally:
 *   1. Replace `null` below with a real AncestryProfile (see the example shape
 *      in the comment), using your era breakdowns / closest populations.
 *   2. Tell git to ignore your edits so they're never committed:
 *        git update-index --skip-worktree lib/dna-ancestry.local.ts
 *      (undo later with --no-skip-worktree if you need to change the stub).
 *
 * Example shape (all fields optional):
 *   export const ANCESTRY: AncestryProfile = {
 *     summary: "…",
 *     deepAncestry: [{ population: "<source pop>", pct: 0 }, …],
 *     eras: [{ id: "era", label: "<Era>", yearsAgo: 0,
 *              components: [{ population: "<pop>", pct: 0, date: "<range>" }, …] }, …],
 *     closest: [{ population: "<pop>", distance: 0 }, …],
 *   }
 */

import type { AncestryProfile } from "./dna-journey"

export const ANCESTRY: AncestryProfile | null = null
