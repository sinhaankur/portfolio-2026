/**
 * mirofish.ts — content type for the public /mirofish project page.
 *
 * The page is open (no password gate): the write-up lives in
 * content/mirofish.json and is imported directly and rendered by
 * <MirofishView>. (It was briefly password-locked; the gate + AES machinery
 * were removed when it went public.)
 */

// ---- dashboard (the recreated Mirofish trading terminal) --------------------

export type MirofishDashboard = {
  /** true while the page renders generated placeholder series, not real output. */
  sampleData: boolean
  header: {
    title: string
    subtitle?: string
    /** the big P&L figure (raw number; formatted in the UI). */
    pnl: number
    /** small stat chips along the header. */
    readouts: { label: string; value: string }[]
  }
  /** scatter "board" — one weighted point per (sub-sampled) trade. */
  probabilityLattice: {
    label: string
    points: { x: number; y: number; w: number }[]
  }
  /** ridgeline / stacked-density plot — each row is one strike level's density. */
  tailRidge: {
    label: string
    rows: number[][]
  }
  /** force-directed correlation network. */
  relationshipGraph: {
    label: string
    nodes: { id: string; group: number; size: number }[]
    edges: { source: string; target: string; weight: number }[]
  }
}

// ---- the prose write-up (header copy / capability list) ---------------------

export type MirofishStat = { label: string; value: string }

export type MirofishCapability = { title: string; detail: string }

export type MirofishContent = {
  meta: {
    /** Project name shown in the header. */
    name: string
    /** One-line tagline under the name. */
    tagline: string
  }
  /** Lead paragraph(s) — the elevator description. */
  summary: string[]
  /** Headline figures for the terminal-style stat strip. */
  stats: MirofishStat[]
  /** What the bridge can actually do. */
  capabilities: MirofishCapability[]
  /** How it's built — the architecture notes. */
  architecture: string[]
  /** Honest limitations / disclaimers. */
  caveats: string[]
  /** External pointers (repo, post, etc.). label -> url. */
  links?: { label: string; href: string }[]
}
