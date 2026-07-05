/**
 * launches — recent + upcoming orbital launches from the Launch Library 2 API
 * (thespacedevs). Free, no key. Real, current launch manifest.
 *
 * Note: the public endpoint is rate-limited (~15 req/hr/IP), so callers should
 * fetch once and cache; this module fetches a single combined view.
 */

export type LaunchItem = {
  id: string
  name: string
  provider: string
  net: string // no-earlier-than ISO time
  status: string
  rocket: string
  padName: string
  locationName: string
  lat: number | null
  lon: number | null
  missionType: string | null
  image: string | null
}

type RawLaunch = {
  id: string
  name: string
  net: string
  status?: { name?: string }
  launch_service_provider?: { name?: string }
  rocket?: { configuration?: { name?: string } }
  pad?: { name?: string; latitude?: string | number; longitude?: string | number; location?: { name?: string } }
  mission?: { type?: string }
  image?: string | null
}

function mapLaunch(r: RawLaunch): LaunchItem {
  const lat = r.pad?.latitude != null ? Number(r.pad.latitude) : null
  const lon = r.pad?.longitude != null ? Number(r.pad.longitude) : null
  return {
    id: r.id,
    name: r.name,
    provider: r.launch_service_provider?.name ?? "—",
    net: r.net,
    status: r.status?.name ?? "—",
    rocket: r.rocket?.configuration?.name ?? "—",
    padName: r.pad?.name ?? "—",
    locationName: r.pad?.location?.name ?? "—",
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    missionType: r.mission?.type ?? null,
    image: r.image ?? null,
  }
}

const BASE = "https://ll.thespacedevs.com/2.2.0/launch"

export async function fetchLaunches(): Promise<{ upcoming: LaunchItem[]; recent: LaunchItem[] } | null> {
  try {
    const [up, prev] = await Promise.all([
      fetch(`${BASE}/upcoming/?limit=5&hide_recent_previous=true`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE}/previous/?limit=3`).then((r) => (r.ok ? r.json() : null)),
    ])
    if (!up && !prev) return null
    const upcoming = Array.isArray(up?.results) ? (up.results as RawLaunch[]).map(mapLaunch) : []
    const recent = Array.isArray(prev?.results) ? (prev.results as RawLaunch[]).map(mapLaunch) : []
    return { upcoming, recent }
  } catch {
    return null
  }
}

/** Compact relative-time string, e.g. "in 6h", "2d ago". */
export function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const h = abs / 3_600_000
  const d = abs / 86_400_000
  const s = diff >= 0 ? "in " : ""
  const e = diff >= 0 ? "" : " ago"
  if (d >= 1) return `${s}${Math.round(d)}d${e}`
  if (h >= 1) return `${s}${Math.round(h)}h${e}`
  return `${s}${Math.max(1, Math.round(abs / 60_000))}m${e}`
}
