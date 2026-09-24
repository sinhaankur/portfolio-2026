/**
 * himawari.ts — live full-disk Earth from JAXA/JMA's Himawari-9 geostationary
 * satellite, via NICT's public real-time imagery service.
 *
 * Source: NICT (Japan's National Institute of Information and Communications
 * Technology) publishes Himawari-9's true-colour full disk as free, keyless,
 * near-real-time tiles at himawari8.nict.go.jp. A `latest.json` names the newest
 * available frame (updated every ~10 min); each frame is a tiled true-colour
 * composite of the whole Earth disk from ~35,786 km up over the Asia-Pacific.
 *
 * Static-site constraint: the tile server serves the images over HTTPS but does
 * NOT send `Access-Control-Allow-Origin`, so we can DISPLAY the frame in an
 * <img> (no CORS needed for rendering) but cannot read its pixels back. That is
 * exactly what the WatchLive panel needs. `latest.json` IS readable, so we fetch
 * it to learn the frame's real timestamp and surface honest freshness.
 *
 * Fidelity: real, dated JAXA/JMA imagery relayed by NICT, credited as-is and
 * never restyled. Fails soft (returns null) when the service is slow or offline
 * — the panel then falls back to the fixed JMA still.
 *
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 */

// NICT real-time Himawari base. D531106 is the standard true-colour product.
const NICT_BASE = "https://himawari8.nict.go.jp/img/D531106"

export type HimawariFrame = {
  /** UTC instant of the frame, parsed from latest.json ("YYYY-MM-DD HH:MM:SS"). */
  at: number
  /** Full-disk image URL (1×1 tile = whole disk at 550px), ready for <img src>. */
  url: string
  /** Source label for the credit line. */
  source: string
}

let cache: { at: number; frame: HimawariFrame } | null = null
const TTL = 1000 * 60 * 5 // 5 min — frames refresh ~every 10 min upstream

/** Fetch with a hard timeout so a slow tile server can't hang the panel. */
async function fetchJsonWithTimeout(url: string, ms: number): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Parse NICT's "YYYY-MM-DD HH:MM:SS" (UTC) into a millisecond epoch, and build
 * the full-disk URL for that frame. The path is date-partitioned:
 *   /1d/550/YYYY/MM/DD/HHMMSS_0_0.png   (1×1 grid, level 1d, one 550px tile)
 */
function frameFromLatest(dateStr: string): HimawariFrame | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(dateStr.trim())
  if (!m) return null
  const [, y, mo, d, hh, mm, ss] = m
  const at = Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)
  if (!Number.isFinite(at)) return null
  const url = `${NICT_BASE}/1d/550/${y}/${mo}/${d}/${hh}${mm}${ss}_0_0.png`
  return { at, url, source: "JAXA/JMA Himawari-9 · NICT" }
}

/**
 * Newest available Himawari-9 full-disk frame with its real timestamp. Returns
 * null if the service is slow (>6s) or offline; caller falls back gracefully.
 */
export async function fetchHimawariLatest(): Promise<HimawariFrame | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.frame
  const j = await fetchJsonWithTimeout(`${NICT_BASE}/latest.json`, 6000)
  if (!j || typeof (j as { date?: unknown }).date !== "string") return null
  const frame = frameFromLatest((j as { date: string }).date)
  if (!frame) return null
  cache = { at: Date.now(), frame }
  return frame
}

/** Human "X min ago" for a frame timestamp; honest about staleness. */
export function frameAge(atMs: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - atMs) / 60000))
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 90) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`
}
