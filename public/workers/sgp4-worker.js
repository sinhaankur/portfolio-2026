/*
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. https://github.com/sinhaankur/portfolio-2026
 *
 * sgp4-worker.js — off-main-thread SGP4 propagation for the satellite swarm.
 *
 * IMPORTANT: this is a PLAIN, PRE-BUILT CLASSIC worker served from /public — NOT
 * a bundled TypeScript module. The earlier TS module worker (new URL('./x.ts',
 * import.meta.url)) worked in `next dev` but the STATIC EXPORT emitted it as a raw
 * `.ts` file with the wrong MIME type, so the browser silently failed to start it
 * and ALL propagation fell back to the main thread — the lag this file fixes.
 * A classic worker + importScripts has no MIME/module pitfalls under static export.
 *
 * It pulls in satellite.js's UMD build (which sets a global `satellite`) via
 * importScripts, so there's no bundler/import involved at all.
 *
 * WHY off-thread: propagating ~18.7k objects is the engine's heaviest per-frame
 * CPU cost; on the main thread it competes with rendering. Here the render loop
 * just LERPs between the last two position buffers this worker posts back.
 *
 * CONTRACT — must produce IDENTICAL scene positions to the field's inline path:
 *   ECI(km) → shell-expand (SHELL_EXPAND=4) → axis map (x, z, -y) → × kmToScene.
 * If expandR / the axis map / kmToScene change in satellite-field.tsx, mirror here.
 *
 * ── USER JOURNEY ──
 *   1. User opens /lab/celestial → the field posts every TLE here ("init").
 *   2. This worker parses them into satrecs (heavy — off the render thread).
 *   3. As the user watches/scrubs, the field asks "positions at time T?" ("tick");
 *      we run SGP4 for all and post back one flat x/y/z buffer (transferable).
 *   4. The render thread glides the dots between buffers → smooth pan/zoom/scrub.
 */

/* global satellite */
importScripts("/vendor/satellite.min.js")

var EARTH_RADIUS_KM = 6371
var SHELL_EXPAND = 4.0

function expandR(rKm) {
  var alt = rKm - EARTH_RADIUS_KM
  return EARTH_RADIUS_KM + Math.max(0, alt) * SHELL_EXPAND
}

/** Reject non-finite SGP4 output (far-from-epoch scrubs). */
function finitePos(r) {
  if (!r || !r.position) return null
  var p = r.position
  if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return null
  return p
}

var recs = []
var kmToScene = 1
var spare = null

function propagateAll(timeMs, out) {
  var date = new Date(timeMs)
  for (var i = 0; i < recs.length; i++) {
    var j = i * 3
    var rec = recs[i]
    if (!rec) { out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; continue }
    var r = false
    try { r = satellite.propagate(rec, date) } catch (e) { r = false }
    var p = finitePos(r)
    if (!p) { out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; continue }
    // shell-expand radially, then map ECI(x,y,z) → scene(x, z, -y) × kmToScene.
    var rr = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)
    var s = rr < 1e-6 ? 1 : expandR(rr) / rr
    out[j] = p.x * s * kmToScene
    out[j + 1] = p.z * s * kmToScene
    out[j + 2] = -p.y * s * kmToScene
  }
}

self.onmessage = function (e) {
  var msg = e.data
  if (msg.type === "init") {
    kmToScene = msg.kmToScene
    recs = msg.tles.map(function (t) {
      try { return satellite.twoline2satrec(t.l1, t.l2) } catch (err) { return null }
    })
    spare = new Float32Array(recs.length * 3)
    self.postMessage({ type: "ready", count: recs.length })
    return
  }
  if (msg.type === "tick") {
    if (recs.length === 0) return
    // Reuse the buffer the main thread handed back (ping-pong); else use spare.
    var buf
    if (msg.buffer && msg.buffer.byteLength === recs.length * 3 * 4) {
      buf = new Float32Array(msg.buffer)
    } else {
      if (!spare) spare = new Float32Array(recs.length * 3)
      buf = spare
    }
    propagateAll(msg.timeMs, buf)
    var out = buf.buffer
    self.postMessage({ type: "positions", timeMs: msg.timeMs, buffer: out }, [out])
  }
}
