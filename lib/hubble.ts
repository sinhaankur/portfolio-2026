/**
 * hubble.ts — latest Hubble Space Telescope images.
 *
 * Source: NASA's Image and Video Library (`images-api.nasa.gov`) — keyless,
 * HTTPS, CORS-open (`Access-Control-Allow-Origin: *`), so it loads directly in
 * the browser from the static site, no proxy or key needed. (HubbleSite's old v3
 * API is defunct — it now redirects to a CMS page — so we use NASA's library,
 * which carries the same imagery with real titles, dates, and credits.)
 *
 * Fidelity: real NASA/Hubble releases surfaced as-is. Returns null on failure so
 * the imagery panel simply omits the Hubble strip — nothing breaks.
 *
 * https://github.com/sinhaankur/portfolio-2026
 */

export type HubbleImage = {
  id: string
  title: string
  date: string
  /** Preview image URL (CORS-safe). */
  thumb: string
  /** Page/asset link for "view full". */
  full: string
}

let cache: { at: number; items: HubbleImage[] } | null = null
const TTL = 1000 * 60 * 60 // 1 hour

/** Fetch the newest Hubble images from NASA's library. */
export async function fetchHubbleLatest(limit = 6): Promise<HubbleImage[] | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.items.slice(0, limit)

  try {
    // Newest-first Hubble photos. The API sorts by relevance, so we bias recent
    // by querying the current + previous year and sorting by date ourselves.
    const year = new Date().getFullYear()
    const res = await fetch(
      `https://images-api.nasa.gov/search?q=hubble&media_type=image&year_start=${year - 1}`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      collection?: { items?: Array<{
        data?: Array<{ nasa_id: string; title: string; date_created: string }>
        links?: Array<{ href: string; rel?: string }>
      }> }
    }
    const raw = json.collection?.items ?? []
    if (raw.length === 0) return null

    const items: HubbleImage[] = raw
      .map((it) => {
        const d = it.data?.[0]
        const link = it.links?.find((l) => l.rel === "preview") ?? it.links?.[0]
        if (!d || !link?.href) return null
        return {
          id: d.nasa_id,
          title: d.title,
          date: (d.date_created ?? "").slice(0, 10),
          thumb: link.href,
          full: link.href.replace("~thumb", "~large").replace("~small", "~large"),
        } as HubbleImage
      })
      .filter((x): x is HubbleImage => x !== null)
      .sort((a, b) => (a.date < b.date ? 1 : -1))

    if (items.length === 0) return null
    cache = { at: Date.now(), items }
    return items.slice(0, limit)
  } catch {
    return null
  }
}
