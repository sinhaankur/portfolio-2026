/**
 * spacetrack.mjs — the FULL tracked-debris catalogue, past the keyless ceiling.
 *
 * CelesTrak's public feeds expose only the named fragmentation clouds + the
 * `analyst` set (~2.8k debris). The complete ~25k+ on-orbit debris + rocket-body
 * population lives behind a Space-Track.org account. This module logs in with
 * build-time credentials and pulls the full set as TLEs — same object shape the
 * CelesTrak path produces, so the caller merges them transparently.
 *
 * CREDENTIALS (never committed): set env SPACETRACK_USER + SPACETRACK_PASS.
 * In CI they come from GitHub repo secrets; locally from your shell. If EITHER
 * is unset this module is a no-op (returns null) and the build proceeds on the
 * CelesTrak-keyless data — the feature is purely additive.
 *
 * Space-Track etiquette (enforced in their API rules): authenticate ONCE, reuse
 * the session cookie, and DON'T hammer it — a handful of queries per run, well
 * under their rate limits. We make exactly two calls: login, then one GP query.
 */

const BASE = "https://www.space-track.org"

/** Space-Track object types → our compact SatType. */
function mapType(objType) {
  if (objType === "DEBRIS") return "DEB"
  if (objType === "ROCKET BODY") return "R/B"
  if (objType === "PAYLOAD") return "PAY"
  return "DEB" // TBA / unknown on-orbit tracked object → treat as debris
}

/** TLE line-1 epoch (cols 19–32, YYDDD.DDDD…) → ms, for the launch-timeline gate. */
function tleEpochMs(l1) {
  const yy = parseInt(l1.slice(18, 20), 10)
  const doy = parseFloat(l1.slice(20, 32))
  if (!Number.isFinite(yy) || !Number.isFinite(doy)) return Date.UTC(2000, 0, 1)
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return Date.UTC(year, 0, 1) + (doy - 1) * 86400000
}

/**
 * Pull the full on-orbit DEBRIS + ROCKET BODY catalogue from Space-Track.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=26000] hard cap on objects returned (memory guard).
 * @returns {Promise<null | { objects: Array, fetched: number }>} null if no creds.
 */
export async function fetchSpaceTrackDebris({ limit = 26000 } = {}) {
  const user = process.env.SPACETRACK_USER
  const pass = process.env.SPACETRACK_PASS
  if (!user || !pass) {
    console.log("  Space-Track: credentials not set — skipping full-debris enrichment")
    return null
  }

  // 1) Authenticate — Space-Track returns a session cookie we reuse for the query.
  console.log("  Space-Track: authenticating…")
  const loginRes = await fetch(`${BASE}/ajaxauth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity: user, password: pass }).toString(),
  })
  if (!loginRes.ok) throw new Error(`login HTTP ${loginRes.status}`)
  const cookie = loginRes.headers.get("set-cookie")
  if (!cookie) throw new Error("login returned no session cookie")

  // 2) Query the GP class for all ON-ORBIT (DECAY_DATE null) debris + rocket
  //    bodies, as 3LE (name + two TLE lines), ordered by NORAD id (deterministic).
  //    GP carries the freshest element set Space-Track holds for each object.
  const query =
    `/basicspacedata/query/class/gp` +
    `/DECAY_DATE/null-val` +
    `/OBJECT_TYPE/DEBRIS,ROCKET BODY` +
    `/orderby/NORAD_CAT_ID asc` +
    `/format/json`
  console.log("  Space-Track: fetching full debris + rocket-body catalogue…")
  const res = await fetch(`${BASE}${query}`, { headers: { Cookie: cookie.split(";")[0] } })
  if (!res.ok) throw new Error(`GP query HTTP ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error("GP query returned a non-array (rate-limited?)")

  const objects = []
  for (const r of rows) {
    if (objects.length >= limit) break
    const l1 = r.TLE_LINE1
    const l2 = r.TLE_LINE2
    if (!l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue
    const id = parseInt(r.NORAD_CAT_ID, 10)
    if (!Number.isFinite(id)) continue
    const type = mapType(r.OBJECT_TYPE)
    // Prefer the real LAUNCH_DATE for the timeline; fall back to the TLE epoch.
    const launchMs = r.LAUNCH_DATE
      ? Date.parse(`${r.LAUNCH_DATE}T00:00:00Z`)
      : tleEpochMs(l1)
    objects.push({
      id,
      name: r.OBJECT_NAME || "UNKNOWN",
      owner: r.COUNTRY_CODE || r.COUNTRY || "—",
      type,
      group: "spacetrack", // provenance tag → merge + family classification
      launchMs: Number.isFinite(launchMs) ? launchMs : tleEpochMs(l1),
      l1,
      l2,
    })
  }
  console.log(`  Space-Track: ${objects.length} on-orbit debris + rocket bodies`)
  return { objects, fetched: rows.length }
}
