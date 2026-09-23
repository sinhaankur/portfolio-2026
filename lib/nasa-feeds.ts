/**
 * nasa-feeds — real, live NASA open-data feeds for the Universe Engine.
 *
 * Every fetcher here pulls REAL data from NASA's public APIs (api.nasa.gov and
 * the NASA Image and Video Library), uses the site's NASA key when set (higher
 * rate limit) else the public DEMO_KEY, caches in-memory for the session, and
 * FAILS SOFTLY — a network/rate-limit error returns null/[] so a panel shows a
 * clean fallback, never a broken page. Same discipline as lib/imagery.ts +
 * lib/neo.ts. No invented data; where a field is genuinely absent we omit it.
 *
 * All feeds here are CORS-friendly (load directly from the static-export site,
 * no proxy needed).
 */

const KEY = process.env.NEXT_PUBLIC_NASA_KEY || "DEMO_KEY"

// tiny session cache helper
type Entry<T> = { at: number; data: T }
const cache = new Map<string, Entry<unknown>>()
const TTL = 1000 * 60 * 30 // 30 min

async function cachedJson<T>(url: string, key: string): Promise<T | null> {
  const hit = cache.get(key) as Entry<T> | undefined
  if (hit && Date.now() - hit.at < TTL) return hit.data
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as T
    cache.set(key, { at: Date.now(), data })
    return data
  } catch {
    return null // network/CORS/rate-limit → soft fail
  }
}

/* ── Mars rover photos ────────────────────────────────────────────────────────
 * Real Curiosity / Perseverance surface images. NASA's mars-photos API returns
 * the latest photos per rover; we take a handful with usable image URLs. */
export type MarsPhoto = {
  id: number
  imgSrc: string
  earthDate: string
  sol: number
  camera: string
  cameraFull: string
  rover: string
}

type RawMarsPhoto = {
  id: number
  img_src: string
  earth_date: string
  sol: number
  camera: { name: string; full_name: string }
  rover: { name: string }
}

export async function fetchMarsPhotos(
  rover: "curiosity" | "perseverance" = "perseverance",
  limit = 12,
): Promise<MarsPhoto[]> {
  const url = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/latest_photos?api_key=${KEY}`
  const json = await cachedJson<{ latest_photos?: RawMarsPhoto[] }>(url, `mars:${rover}`)
  const photos = json?.latest_photos ?? []
  return photos
    .filter((p) => p.img_src && p.img_src.startsWith("http"))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      imgSrc: p.img_src.replace(/^http:/, "https:"), // avoid mixed-content on https site
      earthDate: p.earth_date,
      sol: p.sol,
      camera: p.camera?.name ?? "",
      cameraFull: p.camera?.full_name ?? "",
      rover: p.rover?.name ?? rover,
    }))
}

/* ── NASA Image & Video Library search ("what's being discovered") ────────────
 * The public images-api.nasa.gov search (no key needed, CORS-ok). Used for the
 * "recent discoveries" walkthrough — query recent NASA imagery/news by keyword. */
export type NasaMedia = {
  id: string
  title: string
  description: string
  dateCreated: string
  center: string
  thumb: string | null
  keywords: string[]
}

type RawNasaItem = {
  data?: Array<{
    nasa_id: string
    title?: string
    description?: string
    date_created?: string
    center?: string
    keywords?: string[]
  }>
  links?: Array<{ href: string; rel?: string; render?: string }>
}

export async function searchNasaMedia(query: string, limit = 24): Promise<NasaMedia[]> {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`
  const json = await cachedJson<{ collection?: { items?: RawNasaItem[] } }>(url, `media:${query}`)
  const items = json?.collection?.items ?? []
  return items
    .slice(0, limit)
    .map((it) => {
      const d = it.data?.[0]
      if (!d) return null
      const thumb = it.links?.find((l) => l.render === "image" || l.rel === "preview")?.href ?? null
      return {
        id: d.nasa_id,
        title: d.title ?? "Untitled",
        description: d.description ?? "",
        dateCreated: d.date_created ?? "",
        center: d.center ?? "",
        thumb: thumb ? thumb.replace(/^http:/, "https:") : null,
        keywords: d.keywords ?? [],
      } as NasaMedia
    })
    .filter((x): x is NasaMedia => x !== null && Boolean(x.thumb))
    // newest first when dates are present
    .sort((a, b) => (b.dateCreated || "").localeCompare(a.dateCreated || ""))
}

/* ── NASA Exoplanet Archive ───────────────────────────────────────────────────
 * The TAP service (CORS-ok, no key). Confirmed exoplanets with real measured
 * mass/radius/period/host/method/year. We pull a curated column set as JSON. */
export type Exoplanet = {
  name: string
  hostStar: string
  radiusEarth: number | null
  massEarth: number | null
  periodDays: number | null
  discYear: number | null
  method: string
  distanceLy: number | null
}

type RawExo = {
  pl_name: string
  hostname: string
  pl_rade: number | null
  pl_bmasse: number | null
  pl_orbper: number | null
  disc_year: number | null
  discoverymethod: string | null
  sy_dist: number | null // parsecs
}

const PC_TO_LY = 3.26156

export async function fetchExoplanets(limit = 300): Promise<Exoplanet[]> {
  // ADQL query against the Planetary Systems (composite) table, default params,
  // ordered by most recently discovered. JSON format, CORS-enabled.
  const adql =
    `select top ${limit} pl_name,hostname,pl_rade,pl_bmasse,pl_orbper,disc_year,discoverymethod,sy_dist ` +
    `from pscomppars where default_flag=1 order by disc_year desc`
  const url =
    `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(adql)}&format=json`
  const rows = await cachedJson<RawExo[]>(url, `exo:${limit}`)
  if (!rows) return []
  return rows.map((r) => ({
    name: r.pl_name,
    hostStar: r.hostname,
    radiusEarth: r.pl_rade,
    massEarth: r.pl_bmasse,
    periodDays: r.pl_orbper,
    discYear: r.disc_year,
    method: r.discoverymethod ?? "—",
    distanceLy: r.sy_dist != null ? r.sy_dist * PC_TO_LY : null,
  }))
}
