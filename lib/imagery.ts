/**
 * imagery.ts — live astronomy imagery for the Universe Engine, from open,
 * keyless, CORS-friendly feeds.
 *
 * Primary source: NASA's Astronomy Picture of the Day (APOD). It is served over
 * HTTPS with `Access-Control-Allow-Origin: *` and works with the shared
 * `DEMO_KEY`, so it loads directly in the browser from the static-export site —
 * no proxy, no personal key, nothing to leak.
 *
 * Fidelity: every item is a real, dated NASA publication with its own credit
 * line. We surface that credit; we never restyle or claim the imagery. If the
 * feed is unavailable (rate-limited/offline) the panel degrades gracefully.
 *
 * https://github.com/sinhaankur/portfolio-2026
 */

export type ApodItem = {
  date: string
  title: string
  explanation: string
  /** Standard-resolution image URL. */
  url: string
  /** High-resolution image URL when present. */
  hdurl?: string
  /** "image" | "video" — we only render images; videos link out. */
  mediaType: "image" | "video"
  copyright?: string
}

const APOD = "https://api.nasa.gov/planetary/apod"
// The shared DEMO_KEY is intentional: it keeps the feed keyless and public.
// It is rate-limited, so we cache in-memory for the session and fail softly.
const KEY = "DEMO_KEY"

let cache: { at: number; today: ApodItem | null; recent: ApodItem[] } | null = null
const TTL = 1000 * 60 * 30 // 30 min

function mapItem(raw: any): ApodItem | null {
  if (!raw || !raw.url) return null
  return {
    date: String(raw.date ?? ""),
    title: String(raw.title ?? "Untitled"),
    explanation: String(raw.explanation ?? ""),
    url: String(raw.url),
    hdurl: raw.hdurl ? String(raw.hdurl) : undefined,
    mediaType: raw.media_type === "video" ? "video" : "image",
    copyright: raw.copyright ? String(raw.copyright).replace(/\s+/g, " ").trim() : undefined,
  }
}

/** Today's picture plus a short strip of recent ones. */
export async function fetchImagery(): Promise<{ today: ApodItem | null; recent: ApodItem[] } | null> {
  if (cache && Date.now() - cache.at < TTL) {
    return { today: cache.today, recent: cache.recent }
  }
  try {
    // One call for today, one for the last several days as a gallery strip.
    const [todayRes, recentRes] = await Promise.all([
      fetch(`${APOD}?api_key=${KEY}`),
      fetch(`${APOD}?api_key=${KEY}&count=8`),
    ])
    if (!todayRes.ok || !recentRes.ok) throw new Error("apod http")

    const today = mapItem(await todayRes.json())
    const recentRaw = (await recentRes.json()) as any[]
    const recent = Array.isArray(recentRaw)
      ? recentRaw.map(mapItem).filter((x): x is ApodItem => x !== null && x.mediaType === "image")
      : []

    cache = { at: Date.now(), today, recent }
    return { today, recent }
  } catch {
    return null
  }
}

/**
 * ISS live position — HTTPS, keyless, CORS-open (wheretheiss.at). The engine
 * already propagates the ISS from SGP4; this is an independent cross-check the
 * imagery panel can show as a "where it is right now" line.
 */
export type IssFix = { lat: number; lon: number; altKm: number; velKms: number; at: number }

export async function fetchIssPosition(): Promise<IssFix | null> {
  try {
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544")
    if (!res.ok) return null
    const j = await res.json()
    return {
      lat: Number(j.latitude),
      lon: Number(j.longitude),
      altKm: Number(j.altitude),
      velKms: Number(j.velocity) / 3600, // km/h → km/s
      at: Number(j.timestamp) * 1000,
    }
  } catch {
    return null
  }
}
