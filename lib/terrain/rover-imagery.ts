/**
 * rover-imagery — live NASA Mars Rover photos for the terrain engine's landing
 * pins. When you descend to a rover site and open it, this pulls the rover's
 * real, most-recent images straight from NASA (browser-side, CORS-open), so a
 * Jezero or Gale Crater pin shows what Perseverance / Curiosity actually saw.
 *
 * Source: NASA Mars Rover Photos API (api.nasa.gov/mars-photos). Same key policy
 * as the rest of the engine — NEXT_PUBLIC_NASA_KEY (referrer-restricted, ships
 * in the bundle) falling back to DEMO_KEY so the feature is keyless in dev.
 * Static-export safe: pure client fetch, no server.
 */

const NASA_KEY = process.env.NEXT_PUBLIC_NASA_KEY || "DEMO_KEY"
const BASE = "https://api.nasa.gov/mars-photos/api/v1/rovers"

export interface RoverPhoto {
  id: number
  imgSrc: string
  camera: string
  cameraFull: string
  earthDate: string
  sol: number
  rover: string
}

interface RawPhoto {
  id: number
  img_src: string
  earth_date: string
  sol: number
  camera: { name: string; full_name: string }
  rover: { name: string }
}

/**
 * Fetch the latest photos for a rover. NASA's `/latest_photos` returns the most
 * recent sol that has imagery, which is exactly what we want for a "what's it
 * seeing now" panel. Returns [] on any failure — the pin still works, it just
 * shows no live imagery (honest degradation, never a crash).
 */
export async function fetchLatestRoverPhotos(
  roverSlug: string,
  limit = 12,
): Promise<RoverPhoto[]> {
  try {
    const url = `${BASE}/${roverSlug}/latest_photos?api_key=${NASA_KEY}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { latest_photos?: RawPhoto[] }
    const photos = data.latest_photos ?? []
    return photos.slice(0, limit).map(mapPhoto)
  } catch {
    return []
  }
}

/**
 * Fetch photos for a specific Earth date (yyyy-mm-dd) — used if we later want a
 * "on this day" view. Kept small + optional.
 */
export async function fetchRoverPhotosByDate(
  roverSlug: string,
  earthDate: string,
  limit = 12,
): Promise<RoverPhoto[]> {
  try {
    const url = `${BASE}/${roverSlug}/photos?earth_date=${earthDate}&api_key=${NASA_KEY}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { photos?: RawPhoto[] }
    return (data.photos ?? []).slice(0, limit).map(mapPhoto)
  } catch {
    return []
  }
}

function mapPhoto(p: RawPhoto): RoverPhoto {
  return {
    id: p.id,
    // NASA serves many rover images over http; upgrade to https so they load on
    // the https static site without mixed-content blocking.
    imgSrc: p.img_src.replace(/^http:\/\//, "https://"),
    camera: p.camera.name,
    cameraFull: p.camera.full_name,
    earthDate: p.earth_date,
    sol: p.sol,
    rover: p.rover.name,
  }
}
