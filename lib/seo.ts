/**
 * SEO helpers — keep canonical URLs correct across the static export.
 *
 * THE BUG THIS PREVENTS: the root layout used to hardcode `canonical: SITE_URL`,
 * so every sub-page inherited the HOMEPAGE canonical. Google then treats each
 * page as a duplicate of "/" and refuses to index it (symptom in Search Console:
 * "7 not indexed, 1 indexed"). Each page must declare a SELF-referencing
 * canonical that matches the actually-served URL — including the trailing slash,
 * because `next.config.mjs` sets `trailingSlash: true`.
 *
 * Usage in a page/layout:
 *
 *   import { canonicalPath } from "@/lib/seo"
 *   export const metadata: Metadata = {
 *     title: "Oracle — Principal UX Designer",   // brand is appended by the template
 *     ...canonicalPath("/works/oracle"),
 *   }
 */

import type { Metadata } from "next"

/** Normalise a route to a single leading slash + exactly one trailing slash. */
export function canonicalUrl(path: string): string {
  let p = path.trim()
  if (!p.startsWith("/")) p = `/${p}`
  if (p !== "/" && !p.endsWith("/")) p = `${p}/`
  return p
}

/**
 * Returns the `alternates` + `openGraph.url` block for a page so its canonical
 * (and OG url) self-reference the correct, trailing-slashed route. `metadataBase`
 * in the root layout resolves the relative path to the full https URL.
 */
export function canonicalPath(path: string): Pick<Metadata, "alternates" | "openGraph"> {
  const url = canonicalUrl(path)
  return {
    alternates: { canonical: url },
    openGraph: { url },
  }
}
