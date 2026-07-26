/**
 * asset-cdn — resolve an asset URL against the central asset CDN
 * (Cloudflare R2 at assets.sinhaankur.com), with a local fallback.
 *
 * The heavy / optional / game-fidelity assets live in the separate
 * `sinhaankur-assets` repo and are served over R2's free-egress CDN. This helper
 * returns the CDN URL for a given path so the site can pull them without bloating
 * the portfolio repo.
 *
 * HARD RULE: anything the site NEEDS to render must ship a self-hosted copy in
 * `public/` and be referenced normally (a plain "/textures/…"). Use cdnAsset()
 * ONLY for heavy extras (e.g. an optional 16K "Super Clear" texture, game
 * assets) — and always pass a `localFallback` so the experience degrades
 * gracefully if the CDN is ever unreachable or the env base isn't set.
 */

/** The CDN base. Overridable via env for the r2.dev URL before the custom domain
 *  is live, or empty to force everything to local fallbacks (e.g. offline dev). */
const CDN_BASE = (process.env.NEXT_PUBLIC_ASSET_CDN_BASE ?? "https://assets.sinhaankur.com").replace(/\/+$/, "")

/**
 * Resolve a CDN asset path → full URL.
 *
 * @param path  path within the asset store, e.g. "hd/textures/earth-16k.webp"
 * @param localFallback  a self-hosted path under public/ to use when the CDN base
 *   is disabled (empty env). Strongly recommended for anything on a render path.
 */
export function cdnAsset(path: string, localFallback?: string): string {
  const clean = path.replace(/^\/+/, "")
  if (!CDN_BASE) return localFallback ?? `/${clean}`
  return `${CDN_BASE}/${clean}`
}

/** True when a real CDN base is configured (vs. forced-local). Lets callers skip
 *  requesting a heavy CDN-only asset entirely when there's no CDN. */
export const hasAssetCdn = CDN_BASE.length > 0
