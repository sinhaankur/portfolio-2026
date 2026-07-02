/**
 * The four operating-principle claims — single source of truth shared by the
 * philosophy section (components/about.tsx) and the ScrollCinema overture on
 * the home page. Lives in a plain module (no "use client") so server
 * components can read the actual values, not a client-reference proxy.
 */
export const PRINCIPLE_TITLES = [
  "The seam is the design.",
  "Uncertainty must be legible.",
  "Reversibility is the policy axis.",
  "Prototypes are the argument.",
] as const
