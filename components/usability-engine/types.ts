/**
 * Usability Engine — public types.
 *
 * Same authoring philosophy as the Universe Engine: types declare the
 * shape of the catalog, data files (heuristics.ts) declare instances,
 * and React components render them. Add a row to the catalog and the
 * scene picks it up.
 *
 * The engine is built around a growing catalog of usability heuristics,
 * each carrying:
 *   - a story (why the heuristic matters in narrative form)
 *   - an interactive demo key (lookup into a registry of mini-surfaces)
 *   - an audit question (something the reader can ask of their own product)
 *   - a fix (concrete advice when they answer "no" to the audit question)
 */

export type SurfaceKind = "website" | "application" | "form" | "mobile-app"

export type Severity = "blocker" | "major" | "minor"

/**
 * Keys for interactive demo components. Heuristics with a `demo` field
 * pointing at one of these get the demo rendered alongside the prose.
 * Add a key here, implement the demo under `demos/<key>.tsx`, register
 * it in `demos/registry.ts`, and any heuristic referencing the key will
 * automatically pick up the demo.
 */
export type DemoKey =
  | "visibility-status"
  | "error-prevention"
  | "undo"
  | "recognition"

export type Heuristic = {
  id: string
  /** Display number — '01' through '10' for Nielsen + extensions. */
  number: string
  title: string
  /** One-sentence claim — the gist of the heuristic. */
  claim: string
  /** Two-or-three-sentence narrative explaining why this matters. */
  story: string
  /** Surface types this heuristic primarily applies to. */
  appliesTo: SurfaceKind[]
  /** Cost-of-failure tier — drives the audit summary ordering. */
  severity: Severity
  /** A short audit question the reader can ask of their own surface. */
  auditQuestion: string
  /** Concrete advice when the audit answer is "no" or "unsure". */
  fix: string
  /** Optional interactive demo. Lookups happen in demos/registry.ts. */
  demo?: DemoKey
}

/** Per-heuristic verdict during an active audit session. */
export type AuditVerdict = "pass" | "fail" | "skip" | null

/**
 * One stored audit session — the URL being audited and the user's
 * verdicts per heuristic. Persisted in localStorage so the user can
 * pause mid-audit and pick up later.
 */
export type AuditSession = {
  url: string
  startedAt: number
  verdicts: Record<string, AuditVerdict>
}
