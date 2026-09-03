#!/usr/bin/env node
/**
 * fetch-minor-bodies.mjs
 *
 * Bakes the REAL minor-body catalogue for the Universe Engine's
 * asteroids-and-comets layer, from NASA/JPL's Small-Body Database:
 *
 *   1. Every LARGE asteroid       — H < 8 (≈ every rock ≳ 65 km, ~4.8k,
 *                                   includes the big TNOs + Centaurs)
 *   2. Every km-class NEO         — near-Earth objects with H < 18 (~1.1k)
 *   3. Every catalogued comet     — ~4k (elliptical ones render; hyperbolic
 *                                   one-shot visitors are skipped honestly)
 *
 * Each record keeps the six Keplerian elements + epoch so the engine can
 * propagate every body to its true position for ANY date — the same honest
 * date-accuracy the planets and satellites already have.
 *
 *   public/data/minor-bodies.json
 *     { snapshot, source, counts, bodies: [{ n, a, e, i, om, w, ma, ep, H?, d?, c, k }] }
 *
 * n name · a AU · e ecc · i incl° · om Ω° · w ω° · ma mean anomaly° at ep ·
 * ep epoch (JD) · H abs magnitude · d diameter (km) · c JPL class · k kind
 * (a asteroid / n NEO / c comet).
 *
 * Run:  node scripts/fetch-minor-bodies.mjs
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, "..", "public/data/minor-bodies.json")

const API = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
const FIELDS = "full_name,a,e,i,om,w,ma,epoch,H,diameter,class"

async function query(params) {
  const url = `${API}?fields=${FIELDS}&${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`SBDB ${res.status} for ${params}`)
  const d = await res.json()
  return d.data ?? []
}

function clean(rows, kind) {
  const out = []
  for (const r of rows) {
    const [full, a, e, i, om, w, ma, epoch, H, diameter, cls] = r
    // "     1 Ceres (A801 AA)" → "1 Ceres"; comets keep "1P/Halley". An
    // UNNUMBERED body is only its designation — "(2014 UZ224)" — so when
    // stripping the parenthetical would leave nothing, unwrap it instead
    // (dropping it collapsed every unnumbered body onto one empty name).
    const trimmed = String(full).trim()
    let name = trimmed.replace(/\s*\([^)]*\)\s*$/, "")
    if (!name) name = trimmed.replace(/^\(|\)$/g, "")
    const rec = {
      n: name,
      a: +(+a).toFixed(4),
      e: +(+e).toFixed(4),
      i: +(+i).toFixed(2),
      om: +(+om).toFixed(2),
      w: +(+w).toFixed(2),
      ma: +(+ma).toFixed(2),
      ep: +(+epoch).toFixed(1),
      c: cls || "",
      k: kind,
    }
    if (H != null && H !== "") rec.H = +(+H).toFixed(1)
    if (diameter != null && diameter !== "") rec.d = +(+diameter).toFixed(1)
    // Elliptical, finite, sane orbits only — the engine propagates these with
    // Kepler; hyperbolic one-shot visitors (e ≥ 1) are honestly out of scope.
    if (!Number.isFinite(rec.a) || !Number.isFinite(rec.e) || rec.a <= 0 || rec.e >= 0.99) continue
    if (![rec.i, rec.om, rec.w, rec.ma, rec.ep].every(Number.isFinite)) continue
    out.push(rec)
  }
  return out
}

const cdata = (c) => `sb-cdata=${encodeURIComponent(JSON.stringify({ AND: [c] }))}`

console.log("Fetching large asteroids (H < 8)…")
const large = clean(await query(`sb-kind=a&${cdata("H|LT|8")}`), "a")
console.log(`  ${large.length}`)

console.log("Fetching km-class NEOs (H < 18)…")
const neos = clean(await query(`sb-group=neo&${cdata("H|LT|18")}`), "n")
console.log(`  ${neos.length}`)

console.log("Fetching all catalogued comets…")
const comets = clean(await query("sb-kind=c"), "c")
console.log(`  ${comets.length} (elliptical)`)

// Dedupe (a handful of large NEOs appear in both asteroid sets) — the NEO
// record wins so the class colouring flags them.
const byName = new Map()
for (const b of [...large, ...neos, ...comets]) byName.set(b.n, b)
const bodies = [...byName.values()]

const payload = {
  snapshot: new Date().toISOString().slice(0, 10),
  source:
    "NASA/JPL Small-Body Database (ssd-api.jpl.nasa.gov/sbdb_query.api) — every asteroid H<8, every NEO H<18, every catalogued elliptical comet; Keplerian elements at their JPL epochs",
  counts: { large: large.length, neos: neos.length, comets: comets.length, total: bodies.length },
  bodies,
}
await fs.writeFile(OUT, JSON.stringify(payload))
const kb = Math.round((await fs.stat(OUT)).size / 1024)
console.log(`Wrote ${bodies.length} bodies → ${OUT} (${kb} KB)`)
