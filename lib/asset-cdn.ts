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

/** The CDN base. OFF by default (empty) so nothing requests a dead URL before the
 *  R2 bucket + custom domain are actually live — every cdnAsset() call safely
 *  resolves to its local fallback until then. Turn the CDN ON by setting
 *  NEXT_PUBLIC_ASSET_CDN_BASE (to https://assets.sinhaankur.com once R2 is up, or
 *  the r2.dev URL in the interim). One env change flips the whole site to the CDN;
 *  no code change. */
const CDN_BASE = (process.env.NEXT_PUBLIC_ASSET_CDN_BASE ?? "").replace(/\/+$/, "")

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
  // Local dev / smoke runs: R2's CORS allow-list only covers the production
  // origin, so every CDN fetch from localhost fails loudly and falls back
  // anyway. Skip the round trip and serve the local copy directly.
  if (
    typeof window !== "undefined" &&
    /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname) &&
    localFallback
  ) {
    return localFallback
  }
  return `${CDN_BASE}/${clean}`
}

/** True when a real CDN base is configured (vs. forced-local). Lets callers skip
 *  requesting a heavy CDN-only asset entirely when there's no CDN. */
export const hasAssetCdn = CDN_BASE.length > 0
