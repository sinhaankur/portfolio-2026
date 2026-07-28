/**
 * Ephemeris export — a satellite's predicted state (position + velocity) over a
 * window, in the two formats space people actually use: CSV and CCSDS OEM.
 *
 * Propagated with SGP4 from the object's public TLE (the same elements the
 * engine renders). Awareness + education, not operational use — TLEs are a
 * general-perturbations model, good to ~km over days, NOT a precision product.
 *
 * Frame: TEME (True Equator, Mean Equinox) — SGP4's native inertial frame, which
 * is what an OEM from TLE data should honestly declare.
 */

type SatRec = { error: number }
type Vec = { x: number; y: number; z: number }
type SatLib = {
  twoline2satrec: (l1: string, l2: string) => SatRec
  propagate: (rec: SatRec, date: Date) => { position?: Vec | boolean; velocity?: Vec | boolean }
}

let _lib: Promise<SatLib> | null = null
function satLib(): Promise<SatLib> {
  if (!_lib) _lib = import("satellite.js") as unknown as Promise<SatLib>
  return _lib
}

export type EphemerisPoint = {
  /** ISO-8601 UTC. */
  epoch: string
  /** TEME position, km. */
  px: number; py: number; pz: number
  /** TEME velocity, km/s. */
  vx: number; vy: number; vz: number
}

export type EphemerisOptions = {
  startMs: number
  /** Window length, hours. Default 6. */
  hours?: number
  /** Sample step, seconds. Default 60. */
  stepS?: number
}

/** Propagate a TLE into a state-vector table over the window. */
export async function computeEphemeris(
  l1: string,
  l2: string,
  options: EphemerisOptions,
): Promise<EphemerisPoint[]> {
  const sat = await satLib()
  const { startMs, hours = 6, stepS = 60 } = options
  const rec = sat.twoline2satrec(l1, l2)
  if (rec.error !== 0) throw new Error("Invalid TLE — could not parse the orbit.")
  const steps = Math.max(1, Math.round((hours * 3600) / stepS))
  const out: EphemerisPoint[] = []
  for (let s = 0; s <= steps; s++) {
    const tMs = startMs + s * stepS * 1000
    const d = new Date(tMs)
    const pv = sat.propagate(rec, d)
    const p = pv.position, v = pv.velocity
    if (!p || typeof p === "boolean" || !v || typeof v === "boolean") continue
    out.push({
      epoch: d.toISOString(),
      px: p.x, py: p.y, pz: p.z,
      vx: v.x, vy: v.y, vz: v.z,
    })
  }
  return out
}

/** Format an ephemeris table as CSV (epoch + TEME position/velocity, km & km/s). */
export function toCSV(name: string, pts: EphemerisPoint[]): string {
  const head = "# ephemeris for " + name + " · TEME frame · km, km/s · SGP4 from public TLE\n" +
    "epoch_utc,x_km,y_km,z_km,vx_kms,vy_kms,vz_kms\n"
  const rows = pts.map((p) =>
    [p.epoch, p.px, p.py, p.pz, p.vx, p.vy, p.vz].map((v) => (typeof v === "number" ? v.toFixed(6) : v)).join(","),
  ).join("\n")
  return head + rows + "\n"
}

/**
 * Format as CCSDS OEM (Orbit Ephemeris Message, KVN text) — the CCSDS 502.0-B
 * standard operators exchange. Honest metadata: TEME frame, UTC, the real span.
 */
export function toOEM(name: string, objectId: string, pts: EphemerisPoint[]): string {
  const start = pts[0]?.epoch ?? new Date().toISOString()
  const stop = pts[pts.length - 1]?.epoch ?? start
  const now = new Date().toISOString()
  const header =
    "CCSDS_OEM_VERS = 2.0\n" +
    `CREATION_DATE = ${now}\n` +
    "ORIGINATOR = sinhaankur.com (Universe Engine · public-data SSA)\n\n" +
    "META_START\n" +
    `OBJECT_NAME = ${name}\n` +
    `OBJECT_ID = ${objectId}\n` +
    "CENTER_NAME = EARTH\n" +
    "REF_FRAME = TEME\n" +
    "TIME_SYSTEM = UTC\n" +
    `START_TIME = ${start}\n` +
    `STOP_TIME = ${stop}\n` +
    "META_STOP\n\n" +
    "COMMENT SGP4-propagated from a public TLE — general perturbations, not a precision product.\n"
  const body = pts.map((p) =>
    `${p.epoch} ${p.px.toFixed(6)} ${p.py.toFixed(6)} ${p.pz.toFixed(6)} ${p.vx.toFixed(9)} ${p.vy.toFixed(9)} ${p.vz.toFixed(9)}`,
  ).join("\n")
  return header + body + "\n"
}

/** Trigger a client-side file download of a text blob. */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
