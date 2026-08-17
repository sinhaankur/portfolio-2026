/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * sgp4-worker — off-main-thread SGP4 propagation for the satellite swarm.
 *
 * WHY: propagating ~18.7k objects with satellite.js is the engine's heaviest
 * per-frame CPU cost. Run on the main thread it competes with rendering, so the
 * swarm was time-sliced across many frames to avoid a stutter (fresh, but the
 * work still landed on the render thread). Moving it into a Worker frees the main
 * thread entirely: the render loop just LERPs between the last two position
 * buffers the worker posts back, so pan/zoom stays smooth with the full swarm.
 *
 * CONTRACT — the worker must produce IDENTICAL scene positions to the old inline
 * path, or the swarm would visibly shift when the worker is enabled. It therefore
 * replicates, byte-for-byte, the same transform the field used inline:
 *   ECI(km) → shell-expand (SHELL_EXPAND=4) → axis map (x, z, -y) → × kmToScene.
 * Any change to expandR / the axis map / kmToScene MUST be mirrored here.
 *
 * Messages IN:
 *   { type: "init", tles: {l1,l2}[], kmToScene }  → parse satrecs, alloc buffer
 *   { type: "tick", timeMs }                      → propagate all at timeMs
 * Messages OUT:
 *   { type: "ready", count }                      → satrecs parsed
 *   { type: "positions", timeMs, buffer }         → transferable Float32Array
 *
 * Positions are posted as a TRANSFERABLE ArrayBuffer (zero-copy). The main thread
 * hands a buffer back on the next tick so we ping-pong two buffers and never GC.
 *
 * ── USER JOURNEY ─────────────────────────────────────────────────────────────
 * (What the person at the screen does, and where THIS file fits in.)
 *
 *   1. User opens /lab/celestial. The satellite field mounts and loads the
 *      catalogue (~18.7k objects, each a TLE — two lines of orbital elements).
 *   2. The field creates THIS worker and sends it every TLE ("init"). The worker
 *      parses each TLE into a "satrec" (the math object SGP4 propagates). This is
 *      the heavy part — doing it here means the page DOESN'T freeze while parsing.
 *   3. As the user watches the sky (or scrubs the time slider), the field asks the
 *      worker, a few times a second, "where is every satellite at time T?" ("tick").
 *      The worker runs SGP4 for all of them and sends back one flat array of x/y/z.
 *   4. The render thread simply glides the dots from the last known positions to
 *      the new ones. Because the maths happened HERE (off the render thread), the
 *      user's pan/zoom/scrub stays smooth even with the whole swarm live.
 *   5. If this worker can't start (old browser) the field falls back to doing the
 *      maths itself in small slices — same picture, just less headroom. The user
 *      never sees a difference except on a weak device.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// satellite.js is CJS-ish; the worker imports it dynamically so the bundle only
// loads inside the worker context.
type Vec3 = { x: number; y: number; z: number }
type SatRec = unknown
type Sgp4Lib = {
  twoline2satrec: (l1: string, l2: string) => SatRec
  propagate: (rec: SatRec, date: Date) => { position?: Vec3 | false; velocity?: Vec3 | false } | false
}

// ── the SAME constants the field uses inline (keep in sync) ──────────────────
const EARTH_RADIUS_KM = 6371
const SHELL_EXPAND = 4.0

function expandR(rKm: number): number {
  const alt = rKm - EARTH_RADIUS_KM
  return EARTH_RADIUS_KM + Math.max(0, alt) * SHELL_EXPAND
}

/** finitePos gate — reject non-finite SGP4 output (far-from-epoch scrubs). */
function finitePos(r: { position?: Vec3 | false } | false): Vec3 | null {
  if (!r || !r.position) return null
  const p = r.position
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null
  return p
}

let lib: Sgp4Lib | null = null
let recs: SatRec[] = []
let kmToScene = 1
/** Spare buffer for ping-pong so we never allocate per tick. */
let spare: Float32Array | null = null

async function ensureLib(): Promise<Sgp4Lib> {
  if (lib) return lib
  const mod = (await import("satellite.js")) as unknown as Sgp4Lib
  lib = mod
  return lib
}

function propagateAll(timeMs: number, out: Float32Array) {
  const date = new Date(timeMs)
  const L = lib!
  for (let i = 0; i < recs.length; i++) {
    const j = i * 3
    const rec = recs[i]
    if (!rec) { out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; continue }
    let r: { position?: Vec3 | false } | false = false
    try { r = L.propagate(rec, date) } catch { r = false }
    const p = finitePos(r)
    if (!p) { out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; continue }
    // shell-expand radially, then map ECI(x,y,z) → scene(x, z, -y) × kmToScene.
    const rr = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)
    const s = rr < 1e-6 ? 1 : expandR(rr) / rr
    out[j] = p.x * s * kmToScene
    out[j + 1] = p.z * s * kmToScene
    out[j + 2] = -p.y * s * kmToScene
  }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as
    | { type: "init"; tles: { l1: string; l2: string }[]; kmToScene: number }
    | { type: "tick"; timeMs: number; buffer?: ArrayBuffer }

  if (msg.type === "init") {
    const L = await ensureLib()
    kmToScene = msg.kmToScene
    recs = msg.tles.map((t) => {
      try { return L.twoline2satrec(t.l1, t.l2) } catch { return null }
    })
    spare = new Float32Array(recs.length * 3)
    ;(self as unknown as Worker).postMessage({ type: "ready", count: recs.length })
    return
  }

  if (msg.type === "tick") {
    if (!lib || recs.length === 0) return
    // Reuse the buffer the main thread handed back (ping-pong); else use spare.
    const buf = msg.buffer && msg.buffer.byteLength === recs.length * 3 * 4
      ? new Float32Array(msg.buffer)
      : (spare ??= new Float32Array(recs.length * 3))
    propagateAll(msg.timeMs, buf)
    const out = buf.buffer
    ;(self as unknown as Worker).postMessage({ type: "positions", timeMs: msg.timeMs, buffer: out }, [out])
  }
}
