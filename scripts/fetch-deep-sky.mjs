#!/usr/bin/env node
/**
 * fetch-deep-sky.mjs
 *
 * Pulls the Messier (110 objects) + Caldwell (109 objects) catalogs
 * from OpenNGC and writes them to lib/data/deep-sky.ts as a
 * SkyPoint-shaped array ready to merge with the curated entries in
 * components/universe-engine/astronomy.ts.
 *
 * Source: OpenNGC — https://github.com/mattiaverga/OpenNGC (MIT).
 * The main database file lists every NGC/IC object with cross-IDs
 * (Messier + Caldwell where applicable), accurate J2000 RA/Dec,
 * Hubble morphological types, and apparent magnitudes.
 *
 * Filtering:
 *   - Skip any Messier ID already curated with rich `fact` text in
 *     astronomy.ts: M1, M13, M16, M31, M33, M42, M45, M57.
 *   - Keep Messier first (M1..M110), then Caldwell (C1..C109).
 *   - Map OpenNGC type codes to the engine's kind union
 *     ("galaxy" / "nebula" / "cluster"); skip stars and Other types.
 *
 * Re-run: pnpm data:deepsky
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT_FILE = path.join(ROOT, "lib", "data", "deep-sky.ts")

const OPENNGC_MAIN =
  "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv"
const OPENNGC_ADDENDUM =
  "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC_addendum.csv"

// Already curated in astronomy.ts skyPoints. Skip to avoid duplicates
// AND to preserve the hand-written `fact` copy on those objects.
const CURATED_MESSIER_IDS = new Set([1, 13, 16, 31, 33, 42, 45, 57])

// OpenNGC type code → engine SkyPoint.kind union.
const TYPE_TO_KIND = {
  G: "galaxy",
  AGN: "galaxy",
  GPair: "galaxy",
  GTrpl: "galaxy",
  GGroup: "galaxy",
  OCl: "cluster",
  GCl: "cluster",
  "Cl+N": "cluster",
  "*Ass": "cluster",
  PN: "nebula",
  RfN: "nebula",
  HII: "nebula",
  DrkN: "nebula",
  EmN: "nebula",
  Neb: "nebula",
  SNR: "nebula",
  // Single/double stars + "Other" / "NonEx" / "Dup" are intentionally
  // excluded — the engine's star handling is its own catalog.
}

// Human-readable type label for the auto-generated `fact` string.
const TYPE_LABEL = {
  G: "Galaxy",
  AGN: "Active galaxy",
  GPair: "Galaxy pair",
  GTrpl: "Galaxy triplet",
  GGroup: "Galaxy group",
  OCl: "Open cluster",
  GCl: "Globular cluster",
  "Cl+N": "Cluster with nebulosity",
  "*Ass": "Stellar association",
  PN: "Planetary nebula",
  RfN: "Reflection nebula",
  HII: "HII region",
  DrkN: "Dark nebula",
  EmN: "Emission nebula",
  Neb: "Nebula",
  SNR: "Supernova remnant",
}

const CONSTELLATION_NAMES = {
  And: "Andromeda", Ant: "Antlia", Aps: "Apus", Aql: "Aquila", Aqr: "Aquarius",
  Ara: "Ara", Ari: "Aries", Aur: "Auriga", Boo: "Boötes", Cae: "Caelum",
  Cam: "Camelopardalis", Cnc: "Cancer", CVn: "Canes Venatici", CMa: "Canis Major",
  CMi: "Canis Minor", Cap: "Capricornus", Car: "Carina", Cas: "Cassiopeia",
  Cen: "Centaurus", Cep: "Cepheus", Cet: "Cetus", Cha: "Chamaeleon", Cir: "Circinus",
  Col: "Columba", Com: "Coma Berenices", CrA: "Corona Australis", CrB: "Corona Borealis",
  Crv: "Corvus", Crt: "Crater", Cru: "Crux", Cyg: "Cygnus", Del: "Delphinus",
  Dor: "Dorado", Dra: "Draco", Equ: "Equuleus", Eri: "Eridanus", For: "Fornax",
  Gem: "Gemini", Gru: "Grus", Her: "Hercules", Hor: "Horologium", Hya: "Hydra",
  Hyi: "Hydrus", Ind: "Indus", Lac: "Lacerta", Leo: "Leo", LMi: "Leo Minor",
  Lep: "Lepus", Lib: "Libra", Lup: "Lupus", Lyn: "Lynx", Lyr: "Lyra",
  Men: "Mensa", Mic: "Microscopium", Mon: "Monoceros", Mus: "Musca", Nor: "Norma",
  Oct: "Octans", Oph: "Ophiuchus", Ori: "Orion", Pav: "Pavo", Peg: "Pegasus",
  Per: "Perseus", Phe: "Phoenix", Pic: "Pictor", Psc: "Pisces", PsA: "Piscis Austrinus",
  Pup: "Puppis", Pyx: "Pyxis", Ret: "Reticulum", Sge: "Sagitta", Sgr: "Sagittarius",
  Sco: "Scorpius", Scl: "Sculptor", Sct: "Scutum", Ser: "Serpens", Sex: "Sextans",
  Tau: "Taurus", Tel: "Telescopium", Tri: "Triangulum", TrA: "Triangulum Australe",
  Tuc: "Tucana", UMa: "Ursa Major", UMi: "Ursa Minor", Vel: "Vela", Vir: "Virgo",
  Vol: "Volans", Vul: "Vulpecula",
}

function parseRA(s) {
  if (!s) return null
  // "00:42:44.30" → decimal hours
  const parts = s.split(":")
  if (parts.length < 3) return null
  const [hh, mm, ss] = parts
  const h = Number(hh)
  const m = Number(mm)
  const sec = Number(ss)
  if (!isFinite(h) || !isFinite(m) || !isFinite(sec)) return null
  return h + m / 60 + sec / 3600
}

function parseDec(s) {
  if (!s) return null
  // "+41:16:09.4" or "-69:45:21" → decimal degrees
  const sign = s.startsWith("-") ? -1 : 1
  const stripped = s.replace(/^[-+]/, "")
  const parts = stripped.split(":")
  if (parts.length < 3) return null
  const [dd, mm, ss] = parts
  const d = Number(dd)
  const m = Number(mm)
  const sec = Number(ss)
  if (!isFinite(d) || !isFinite(m) || !isFinite(sec)) return null
  return sign * (d + m / 60 + sec / 3600)
}

async function fetchCSV(url) {
  process.stdout.write(`fetching ${url}…\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return await res.text()
}

function parseCSV(csv) {
  const lines = csv.replace(/\r/g, "").split("\n").filter((l) => l.length)
  const headers = lines[0].split(";")
  const col = (name) => headers.indexOf(name)
  const I = {
    name: col("Name"),
    type: col("Type"),
    ra: col("RA"),
    dec: col("Dec"),
    constellation: col("Const"),
    bMag: col("B-Mag"),
    vMag: col("V-Mag"),
    m: col("M"),
    identifiers: col("Identifiers"),
    common: col("Common names"),
  }
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(";")
    rows.push({
      name: f[I.name],
      type: f[I.type],
      ra: f[I.ra],
      dec: f[I.dec],
      constellation: f[I.constellation],
      bMag: f[I.bMag],
      vMag: f[I.vMag],
      m: f[I.m],
      identifiers: f[I.identifiers],
      common: f[I.common],
    })
  }
  return rows
}

function pickMagnitude(row) {
  const v = parseFloat(row.vMag)
  if (isFinite(v)) return v
  const b = parseFloat(row.bMag)
  if (isFinite(b)) return b
  return null
}

function buildEntry(catKey, catNum, row) {
  const kind = TYPE_TO_KIND[row.type]
  if (!kind) return null
  const raH = parseRA(row.ra)
  const decD = parseDec(row.dec)
  if (raH === null || decD === null) return null
  const mag = pickMagnitude(row)
  const constName = CONSTELLATION_NAMES[row.constellation] || row.constellation || "an unnamed constellation"
  const typeLabel = TYPE_LABEL[row.type] || "Deep-sky object"
  const common = (row.common || "").trim()

  // Display name: prefer common name, fall back to catalog ID.
  const displayName = common || `${catKey}${catNum}`

  // Designation: catalog ID + cross-IDs ("M42 · NGC 1976 · Orion Nebula").
  const designationParts = [`${catKey}${catNum}`]
  if (row.name && !row.name.includes(`${catKey}${catNum}`)) {
    designationParts.push(row.name)
  }
  if (common && common !== displayName) {
    designationParts.push(common)
  }
  const designation = designationParts.join(" · ")

  // Auto-generated fact — terse, factual, no flourish. Curated entries
  // in astronomy.ts carry the editorial copy; these are catalog adds.
  const factParts = [`${typeLabel} in ${constName}`]
  if (mag !== null) factParts.push(`apparent magnitude ${mag.toFixed(1)}`)
  const fact = factParts.join(". ") + "."

  // Visual size: smaller than curated halos so naked-eye sky stays
  // readable. Magnitude-aware — brighter objects render slightly larger.
  const baseSize = kind === "galaxy" ? 1.6 : kind === "nebula" ? 1.8 : 1.2
  const magBoost = mag !== null && isFinite(mag) ? Math.max(0, (8 - mag) * 0.08) : 0
  const visualSize = +(baseSize + magBoost).toFixed(2)

  return {
    id: `${catKey.toLowerCase()}${catNum}`,
    name: displayName,
    designation,
    kind,
    raHours: +raH.toFixed(4),
    decDeg: +decD.toFixed(3),
    magnitude: mag !== null ? +mag.toFixed(2) : 99,
    distance: "—",
    fact,
    visualSize,
  }
}

async function main() {
  const csv1 = await fetchCSV(OPENNGC_MAIN)
  const csv2 = await fetchCSV(OPENNGC_ADDENDUM).catch(() => "")
  const rows = [...parseCSV(csv1), ...(csv2 ? parseCSV(csv2) : [])]
  console.log(`OpenNGC rows: ${rows.length}`)

  const messier = new Map()
  const caldwell = new Map()

  for (const row of rows) {
    if (row.m && row.m.length) {
      const num = parseInt(row.m, 10)
      if (
        isFinite(num) &&
        num >= 1 &&
        num <= 110 &&
        !CURATED_MESSIER_IDS.has(num) &&
        !messier.has(num)
      ) {
        messier.set(num, row)
      }
    }
    if (row.identifiers) {
      const ids = row.identifiers.split(",").map((s) => s.trim())
      for (const id of ids) {
        const match = id.match(/^C\s*(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (isFinite(num) && num >= 1 && num <= 109 && !caldwell.has(num)) {
            caldwell.set(num, row)
          }
        }
      }
    }
  }

  console.log(`Messier (non-curated): ${messier.size}`)
  console.log(`Caldwell: ${caldwell.size}`)

  const entries = []
  for (const [num, row] of [...messier].sort((a, b) => a[0] - b[0])) {
    const e = buildEntry("M", num, row)
    if (e) entries.push(e)
  }
  for (const [num, row] of [...caldwell].sort((a, b) => a[0] - b[0])) {
    const e = buildEntry("C", num, row)
    if (e) entries.push(e)
  }

  console.log(`Built ${entries.length} SkyPoint entries`)

  const banner = `/**
 * AUTO-GENERATED by scripts/fetch-deep-sky.mjs — do not hand-edit.
 *
 * Source: OpenNGC (https://github.com/mattiaverga/OpenNGC), MIT-licensed.
 * Re-run with: pnpm data:deepsky
 *
 * Messier IDs already curated with editorial copy in
 * components/universe-engine/astronomy.ts (M1, M13, M16, M31, M33,
 * M42, M45, M57) are intentionally OMITTED here so the curated
 * entries win when both sets are merged.
 */
`

  const body =
    banner +
    `\nimport type { SkyPoint } from "@/components/universe-engine/types"\n\n` +
    `export const DEEP_SKY_CATALOG: SkyPoint[] = ${JSON.stringify(entries, null, 2)}\n\n` +
    `export const DEEP_SKY_COUNT = ${entries.length}\n`

  await fs.writeFile(OUT_FILE, body, "utf8")
  console.log(`wrote ${OUT_FILE} (${entries.length} entries)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
