/**
 * neo — near-Earth object close approaches from NASA's NeoWs feed.
 * Free, read-only, rate-limited. Real asteroid flybys with miss distance,
 * size, speed, and the "potentially hazardous" flag.
 */

// NASA key ships in the client bundle (read-only, rate-limited — a leak only
// burns the rate limit). Falls back to DEMO_KEY (30/hr) if the env var is unset.
const NASA_KEY = process.env.NEXT_PUBLIC_NASA_KEY || "DEMO_KEY"

export type NeoApproach = {
  id: string
  name: string
  date: Date
  missLunar: number // miss distance in lunar distances (1 LD = 384,400 km)
  missKm: number
  velocityKms: number
  diameterMinM: number
  diameterMaxM: number
  hazardous: boolean
  jplUrl: string
}

type RawNeo = {
  id: string
  name: string
  nasa_jpl_url: string
  is_potentially_hazardous_asteroid: boolean
  estimated_diameter?: { meters?: { estimated_diameter_min?: number; estimated_diameter_max?: number } }
  close_approach_data?: {
    close_approach_date_full?: string
    epoch_date_close_approach?: number
    miss_distance?: { lunar?: string; kilometers?: string }
    relative_velocity?: { kilometers_per_second?: string }
  }[]
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Fetch NEO close approaches for the next `days` days (max 7 per NeoWs). */
export async function fetchNeoApproaches(days = 7): Promise<NeoApproach[] | null> {
  const start = new Date()
  const end = new Date(start.getTime() + Math.min(days, 7) * 86_400_000)
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${isoDate(start)}&end_date=${isoDate(end)}&api_key=${NASA_KEY}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const j = await res.json()
    const byDay = j.near_earth_objects as Record<string, RawNeo[]> | undefined
    if (!byDay) return null
    const out: NeoApproach[] = []
    for (const list of Object.values(byDay)) {
      for (const n of list) {
        const ca = n.close_approach_data?.[0]
        if (!ca) continue
        const dia = n.estimated_diameter?.meters
        out.push({
          id: n.id,
          name: n.name.replace(/[()]/g, "").trim(),
          date: ca.epoch_date_close_approach ? new Date(ca.epoch_date_close_approach) : new Date(),
          missLunar: Number(ca.miss_distance?.lunar ?? 0),
          missKm: Number(ca.miss_distance?.kilometers ?? 0),
          velocityKms: Number(ca.relative_velocity?.kilometers_per_second ?? 0),
          diameterMinM: dia?.estimated_diameter_min ?? 0,
          diameterMaxM: dia?.estimated_diameter_max ?? 0,
          hazardous: n.is_potentially_hazardous_asteroid,
          jplUrl: n.nasa_jpl_url,
        })
      }
    }
    // sort by soonest approach; closest first among same day
    out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.missLunar - b.missLunar)
    return out
  } catch {
    return null
  }
}

/** A human size band from the estimated diameter. */
export function sizeBand(minM: number, maxM: number): string {
  const mid = (minM + maxM) / 2
  if (mid < 20) return "car-sized"
  if (mid < 50) return "house-sized"
  if (mid < 150) return "building-sized"
  if (mid < 500) return "stadium-sized"
  return "mountain-sized"
}
