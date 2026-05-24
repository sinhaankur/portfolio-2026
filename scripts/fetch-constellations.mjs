#!/usr/bin/env node
/**
 * fetch-constellations.mjs
 *
 * Downloads d3-celestial's constellation-lines GeoJSON (BSD-3, line
 * data ultimately from a modern compilation of the canonical IAU
 * asterisms — the actual line figures aren't IAU-defined, only the
 * 88 boundary regions are), converts each constellation to the
 * engine's Constellation shape, and writes lib/data/constellations-iau.ts.
 *
 * The engine currently has 7 hand-curated constellations with rich
 * fact text. This generates the OTHER 81 as stub entries — minimal
 * facts, full line geometry — so astronomy.ts can merge them with
 * the curated set and render all 88.
 *
 * Re-run: pnpm data:constellations
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE_DIR = path.join(ROOT, "scripts", ".cache")
const CACHE_FILE = path.join(CACHE_DIR, "d3-celestial-constellations.json")
const OUT_FILE = path.join(ROOT, "lib", "data", "constellations-iau.ts")

const SOURCE_URL =
  "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json"

/**
 * IAU 3-letter abbreviation → { name, designation, blurb }
 *
 * All 88 IAU-recognised constellations. The designation column
 * carries the genitive form astronomers use (e.g. "α Andromedae")
 * plus a short qualifier — useful in the InfoPanel header.
 *
 * Blurbs are deliberately terse: 1–2 sentences of "where + what to
 * notice" rather than mythology. The hand-curated 7 in astronomy.ts
 * carry richer fact text; these are the stubs for the other 81.
 */
const IAU_CONSTELLATIONS = {
  And: { name: "Andromeda", designation: "And · Andromedae", blurb: "Northern autumn constellation. Hosts M31, the Andromeda Galaxy — naked-eye at dark sites, the most distant thing the human eye can see unaided." },
  Ant: { name: "Antlia", designation: "Ant · Antliae", blurb: "Faint southern constellation invented by Lacaille in the 18th century. Named for the air pump." },
  Aps: { name: "Apus", designation: "Aps · Apodis", blurb: "Far southern circumpolar constellation. Represents a bird of paradise; faint, requires dark skies." },
  Aql: { name: "Aquila", designation: "Aql · Aquilae", blurb: "The eagle. Bright star Altair forms one vertex of the Summer Triangle with Vega (Lyra) + Deneb (Cygnus)." },
  Aqr: { name: "Aquarius", designation: "Aqr · Aquarii", blurb: "Zodiacal constellation. Contains the Helix Nebula (NGC 7293), one of the closest planetary nebulae." },
  Ara: { name: "Ara", designation: "Ara · Arae", blurb: "Southern constellation, the altar. Best seen from southern hemisphere summer." },
  Ari: { name: "Aries", designation: "Ari · Arietis", blurb: "Zodiacal constellation, the ram. Vernal equinox once lay here; now in Pisces due to precession." },
  Aur: { name: "Auriga", designation: "Aur · Aurigae", blurb: "The charioteer. Pentagon-shaped figure anchored by Capella, the 6th-brightest star in the night sky." },
  Boo: { name: "Boötes", designation: "Boo · Boötis", blurb: "The herdsman. Kite-shaped figure; Arcturus is its alpha star and the brightest in the northern celestial hemisphere." },
  Cae: { name: "Caelum", designation: "Cae · Caeli", blurb: "Small faint southern constellation, the chisel. Lacaille creation, 18th century." },
  Cam: { name: "Camelopardalis", designation: "Cam · Camelopardalis", blurb: "Large but faint northern constellation, the giraffe. Sprawls across a sparse patch of sky between Polaris and Auriga." },
  Cnc: { name: "Cancer", designation: "Cnc · Cancri", blurb: "Zodiacal constellation, the crab. Hosts the Beehive Cluster (M44), one of the closest open clusters to Earth." },
  CVn: { name: "Canes Venatici", designation: "CVn · Canum Venaticorum", blurb: "The hunting dogs. Contains the Whirlpool Galaxy (M51), a face-on spiral interacting with its smaller companion." },
  CMa: { name: "Canis Major", designation: "CMa · Canis Majoris", blurb: "The greater dog. Anchored by Sirius — the brightest star in the night sky." },
  CMi: { name: "Canis Minor", designation: "CMi · Canis Minoris", blurb: "The lesser dog. Small constellation with Procyon, the 8th-brightest star, marking its alpha." },
  Cap: { name: "Capricornus", designation: "Cap · Capricorni", blurb: "Zodiacal constellation, the sea-goat. Faint but ancient — recognised across many ancient cultures." },
  Car: { name: "Carina", designation: "Car · Carinae", blurb: "The keel (of Argo Navis). Contains Canopus — second-brightest star in the night sky — and the Eta Carinae nebula." },
  Cas: { name: "Cassiopeia", designation: "Cas · Cassiopeiae", blurb: "The queen. Distinctive W-shape, circumpolar from mid-northern latitudes; opposite the Big Dipper across Polaris." },
  Cen: { name: "Centaurus", designation: "Cen · Centauri", blurb: "The centaur. Hosts Alpha Centauri (the closest star system to the Sun) and Omega Centauri (the largest known globular cluster in our galaxy)." },
  Cep: { name: "Cepheus", designation: "Cep · Cephei", blurb: "The king. House-shaped figure near Polaris. Hosts the prototype Cepheid variable star δ Cephei, the foundation of cosmic distance scaling." },
  Cet: { name: "Cetus", designation: "Cet · Ceti", blurb: "The whale (or sea monster). Contains Mira — the prototype long-period variable star, ranging from mag 2 to mag 10 over 332 days." },
  Cha: { name: "Chamaeleon", designation: "Cha · Chamaeleontis", blurb: "Far southern constellation, the chameleon. Faint, requires dark southern skies." },
  Cir: { name: "Circinus", designation: "Cir · Circini", blurb: "Small southern constellation, the drafting compass. Adjacent to the Centaurus star fields." },
  Col: { name: "Columba", designation: "Col · Columbae", blurb: "The dove. Southern constellation below Lepus; modern (1592)." },
  Com: { name: "Coma Berenices", designation: "Com · Comae Berenices", blurb: "Berenice's hair. Contains the rich Coma Cluster of galaxies + the closest large galaxy cluster to us, M64 (Black Eye Galaxy)." },
  CrA: { name: "Corona Australis", designation: "CrA · Coronae Australis", blurb: "The southern crown. Small but elegant arc of stars near Sagittarius." },
  CrB: { name: "Corona Borealis", designation: "CrB · Coronae Borealis", blurb: "The northern crown. Distinctive semi-circle of stars; contains the recurrent nova T CrB, expected to flare again imminently." },
  Crv: { name: "Corvus", designation: "Crv · Corvi", blurb: "The crow. Compact quadrilateral; one of the smallest constellations." },
  Crt: { name: "Crater", designation: "Crt · Crateris", blurb: "The cup. Faint southern constellation next to Corvus and Hydra." },
  Cru: { name: "Crux", designation: "Cru · Crucis", blurb: "The Southern Cross. The smallest of the 88 IAU constellations, but the most famous in the southern sky. Used for navigation south of the equator." },
  Cyg: { name: "Cygnus", designation: "Cyg · Cygni", blurb: "The swan. Distinctive cross-shaped figure flying along the Milky Way. Deneb forms one vertex of the Summer Triangle." },
  Del: { name: "Delphinus", designation: "Del · Delphini", blurb: "The dolphin. Small distinctive constellation near Aquila — looks like a tiny kite." },
  Dor: { name: "Dorado", designation: "Dor · Doradus", blurb: "The dolphinfish. Southern constellation containing most of the Large Magellanic Cloud — our nearest galactic neighbour at 163,000 ly." },
  Dra: { name: "Draco", designation: "Dra · Draconis", blurb: "The dragon. Long, winding constellation circling Polaris. Thuban (α Dra) was the pole star ~3000 BCE." },
  Equ: { name: "Equuleus", designation: "Equ · Equulei", blurb: "The little horse. Second-smallest constellation after Crux." },
  Eri: { name: "Eridanus", designation: "Eri · Eridani", blurb: "The river. Long winding constellation stretching from Orion's foot deep into the southern sky. Anchored by Achernar at the river's mouth." },
  For: { name: "Fornax", designation: "For · Fornacis", blurb: "The furnace. Contains the Fornax Cluster of galaxies + the Hubble Ultra-Deep Field, the deepest visible-light image of the universe." },
  Gem: { name: "Gemini", designation: "Gem · Geminorum", blurb: "Zodiacal constellation, the twins. Twin bright stars Castor + Pollux give it its iconic shape." },
  Gru: { name: "Grus", designation: "Gru · Gruis", blurb: "The crane. Southern constellation; modern (1597-8)." },
  Her: { name: "Hercules", designation: "Her · Herculis", blurb: "Hercules. The Keystone asterism marks his torso; hosts M13 — the brightest globular cluster in northern skies." },
  Hor: { name: "Horologium", designation: "Hor · Horologii", blurb: "The pendulum clock. Faint southern Lacaille constellation." },
  Hya: { name: "Hydra", designation: "Hya · Hydrae", blurb: "The water snake. Largest of the 88 constellations by area; long sinuous figure spanning a quarter of the sky." },
  Hyi: { name: "Hydrus", designation: "Hyi · Hydri", blurb: "The lesser water snake (don't confuse with Hydra). Far southern constellation near the south celestial pole." },
  Ind: { name: "Indus", designation: "Ind · Indi", blurb: "The Indian. Southern constellation; modern (1597-8)." },
  Lac: { name: "Lacerta", designation: "Lac · Lacertae", blurb: "The lizard. Small constellation wedged between Andromeda + Cygnus. Modern (Hevelius, 1687)." },
  Leo: { name: "Leo", designation: "Leo · Leonis", blurb: "Zodiacal constellation, the lion. Distinctive 'sickle' asterism marks the head; Regulus is the brightest star." },
  LMi: { name: "Leo Minor", designation: "LMi · Leonis Minoris", blurb: "The lesser lion. Faint constellation just north of Leo; Hevelius (1687)." },
  Lep: { name: "Lepus", designation: "Lep · Leporis", blurb: "The hare. Crouched at Orion's feet — Orion's dogs (Canis Major + Minor) chase it forever." },
  Lib: { name: "Libra", designation: "Lib · Librae", blurb: "Zodiacal constellation, the scales. Once part of Scorpius (the scorpion's claws); the only zodiac constellation not representing a living thing." },
  Lup: { name: "Lupus", designation: "Lup · Lupi", blurb: "The wolf. Adjacent to Centaurus and Scorpius in the southern sky." },
  Lyn: { name: "Lynx", designation: "Lyn · Lyncis", blurb: "The lynx. Faint northern constellation; supposedly named because only the lynx-eyed can see it. Hevelius (1687)." },
  Lyr: { name: "Lyra", designation: "Lyr · Lyrae", blurb: "The lyre. Anchored by Vega — fifth-brightest star + future pole star (~14,000 CE). Hosts the Ring Nebula (M57)." },
  Men: { name: "Mensa", designation: "Men · Mensae", blurb: "Table Mountain. The only constellation named for a geographic feature on Earth (Table Mountain in South Africa)." },
  Mic: { name: "Microscopium", designation: "Mic · Microscopii", blurb: "The microscope. Faint southern Lacaille constellation." },
  Mon: { name: "Monoceros", designation: "Mon · Monocerotis", blurb: "The unicorn. Lies in the winter Milky Way between Orion + Canis Major. Hosts the Rosette Nebula." },
  Mus: { name: "Musca", designation: "Mus · Muscae", blurb: "The fly. Far southern constellation near the Coalsack Dark Nebula and Crux." },
  Nor: { name: "Norma", designation: "Nor · Normae", blurb: "The carpenter's level. Faint southern Lacaille constellation." },
  Oct: { name: "Octans", designation: "Oct · Octantis", blurb: "The octant. Contains the south celestial pole. Sigma Octantis is the closest naked-eye star to it — but barely visible." },
  Oph: { name: "Ophiuchus", designation: "Oph · Ophiuchi", blurb: "The serpent-bearer. The 'thirteenth zodiac' — the sun passes through it in late November/early December despite not being on traditional zodiac lists." },
  Ori: { name: "Orion", designation: "Ori · Orionis", blurb: "The hunter. Most recognisable winter constellation; contains Betelgeuse, Rigel, the three-star Belt, and the Orion Nebula (M42) — the closest large star-forming region to Earth." },
  Pav: { name: "Pavo", designation: "Pav · Pavonis", blurb: "The peacock. Southern constellation; modern (1597-8). Brightest star is Peacock (α Pav)." },
  Peg: { name: "Pegasus", designation: "Peg · Pegasi", blurb: "The winged horse. Defined by the Great Square asterism. 51 Peg b was the first exoplanet ever discovered around a sun-like star (1995)." },
  Per: { name: "Perseus", designation: "Per · Persei", blurb: "Perseus. Distinctive northern figure adjacent to Cassiopeia; source of the Perseid meteor shower in mid-August. Contains Algol — the prototype eclipsing binary." },
  Phe: { name: "Phoenix", designation: "Phe · Phoenicis", blurb: "The phoenix. Southern modern constellation (1597-8)." },
  Pic: { name: "Pictor", designation: "Pic · Pictoris", blurb: "The painter's easel. Faint southern Lacaille constellation. Contains the debris disk around Beta Pictoris — first imaged in the 1980s." },
  Psc: { name: "Pisces", designation: "Psc · Piscium", blurb: "Zodiacal constellation, the fishes. The vernal equinox currently lies here; will move to Aquarius in ~600 years." },
  PsA: { name: "Piscis Austrinus", designation: "PsA · Piscis Austrini", blurb: "The southern fish. Contains Fomalhaut — one of the brightest stars in the sky + the first to have an exoplanet directly imaged (Fomalhaut b, 2008)." },
  Pup: { name: "Puppis", designation: "Pup · Puppis", blurb: "The stern (of Argo Navis). Hosts several rich open clusters embedded in the southern Milky Way." },
  Pyx: { name: "Pyxis", designation: "Pyx · Pyxidis", blurb: "The mariner's compass. Small faint southern constellation adjacent to Puppis. Lacaille (1750s)." },
  Ret: { name: "Reticulum", designation: "Ret · Reticuli", blurb: "The reticle. Small southern Lacaille constellation; brightest stars are unrelated optical binaries." },
  Sge: { name: "Sagitta", designation: "Sge · Sagittae", blurb: "The arrow. Small constellation between Aquila + Cygnus — third-smallest of the 88." },
  Sgr: { name: "Sagittarius", designation: "Sgr · Sagittarii", blurb: "The archer. The 'Teapot' asterism points at the centre of our galaxy — Sgr A* sits in this direction. Densest patch of Milky Way visible from Earth." },
  Sco: { name: "Scorpius", designation: "Sco · Scorpii", blurb: "The scorpion. Distinctive curved figure with the red-supergiant Antares marking its heart." },
  Scl: { name: "Sculptor", designation: "Scl · Sculptoris", blurb: "The sculptor. Faint southern constellation; the south galactic pole sits here, looking 'up' out of the Milky Way's disc." },
  Sct: { name: "Scutum", designation: "Sct · Scuti", blurb: "The shield. Small constellation embedded in the densest part of the southern Milky Way; contains the Wild Duck Cluster (M11)." },
  Ser: { name: "Serpens", designation: "Ser · Serpentis", blurb: "The serpent. The only constellation divided into two non-contiguous parts (Caput + Cauda) — split by Ophiuchus." },
  Sex: { name: "Sextans", designation: "Sex · Sextantis", blurb: "The sextant. Faint constellation just south of Leo. Hevelius (1687)." },
  Tau: { name: "Taurus", designation: "Tau · Tauri", blurb: "Zodiacal constellation, the bull. Contains the Pleiades (M45) and Hyades open clusters + the Crab Nebula (M1) — remnant of the 1054 supernova." },
  Tel: { name: "Telescopium", designation: "Tel · Telescopii", blurb: "The telescope. Faint southern Lacaille constellation." },
  Tri: { name: "Triangulum", designation: "Tri · Trianguli", blurb: "The triangle. Small but distinctive northern constellation; hosts the Triangulum Galaxy (M33) — third-largest in the Local Group." },
  TrA: { name: "Triangulum Australe", designation: "TrA · Trianguli Australis", blurb: "The southern triangle. Bright + distinctive in the far southern sky." },
  Tuc: { name: "Tucana", designation: "Tuc · Tucanae", blurb: "The toucan. Contains the Small Magellanic Cloud + 47 Tucanae, the second-brightest globular cluster after Omega Centauri." },
  UMa: { name: "Ursa Major", designation: "UMa · Ursae Majoris", blurb: "The great bear. Contains the Big Dipper / Plough asterism — the most widely-recognised pattern in the northern sky. Used to find Polaris." },
  UMi: { name: "Ursa Minor", designation: "UMi · Ursae Minoris", blurb: "The little bear. Contains the Little Dipper asterism, anchored by Polaris — the current north pole star." },
  Vel: { name: "Vela", designation: "Vel · Velorum", blurb: "The sails (of Argo Navis). Embedded in the southern Milky Way; contains the Vela Supernova Remnant — debris from a star that exploded ~12,000 years ago." },
  Vir: { name: "Virgo", designation: "Vir · Virginis", blurb: "Zodiacal constellation, the maiden. Largest zodiac constellation; contains Spica + the Virgo Cluster of galaxies. M87 + its imaged black hole sit here." },
  Vol: { name: "Volans", designation: "Vol · Volantis", blurb: "The flying fish. Far southern constellation; modern (1597-8)." },
  Vul: { name: "Vulpecula", designation: "Vul · Vulpeculae", blurb: "The fox. Small faint constellation in the summer Milky Way; contains the Dumbbell Nebula (M27)." },
}

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }) }

async function downloadIfMissing() {
  try {
    await fs.access(CACHE_FILE)
    console.log(`Using cached d3-celestial constellations at ${path.relative(ROOT, CACHE_FILE)}`)
    return
  } catch { /* not cached */ }
  await ensureDir(CACHE_DIR)
  console.log(`Downloading d3-celestial constellation-lines GeoJSON…`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const text = await res.text()
  await fs.writeFile(CACHE_FILE, text, "utf8")
  console.log(`Saved ${(text.length / 1024).toFixed(1)} KB to ${path.relative(ROOT, CACHE_FILE)}`)
}

/**
 * Convert [ra_deg_signed, dec_deg] (d3-celestial format) to the
 * engine's raHours (0-24) + decDeg.
 */
function toEngine(raDeg, decDeg) {
  // d3-celestial uses signed-degree RA; normalise to 0..360, then to hours.
  const raNorm = ((Number(raDeg) % 360) + 360) % 360
  return { raHours: Number((raNorm / 15).toFixed(4)), decDeg: Number(decDeg.toFixed(4)) }
}

/**
 * Build stars[] + edges[] from a MultiLineString. Multiple lines may
 * share endpoints (where one line of the asterism meets another); we
 * dedupe by quantised position so shared stars appear once with all
 * incident edges.
 */
function buildStarsAndEdges(multiLineString) {
  const stars = []
  const indexByKey = new Map()
  const edges = []
  const QUANTIZE = 1e3 // 1/1000 degree tolerance — distinguishes adjacent
                       // figure stars while collapsing within-line repeats
  for (const line of multiLineString) {
    let prevIdx = -1
    for (const point of line) {
      const ra = Number(point[0])
      const dec = Number(point[1])
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue
      const e = toEngine(ra, dec)
      const key = `${Math.round(e.raHours * QUANTIZE)}:${Math.round(e.decDeg * QUANTIZE)}`
      let idx = indexByKey.get(key)
      if (idx == null) {
        idx = stars.length
        stars.push({
          name: "",                 // anonymous figure node; named-star
          designation: "",          // hover layer handles the real names
          raHours: e.raHours,
          decDeg: e.decDeg,
          magnitude: 3.0,           // default visible-brightness; figure
                                    // lines render uniformly regardless
        })
        indexByKey.set(key, idx)
      }
      if (prevIdx >= 0 && prevIdx !== idx) {
        edges.push([prevIdx, idx])
      }
      prevIdx = idx
    }
  }
  return { stars, edges }
}

function iauIdToEngineId(iauCode) {
  // Lowercase + dashed form, matching the existing engine's "ursa-major"
  // style for the hand-curated set.
  return iauCode.toLowerCase()
}

async function main() {
  await downloadIfMissing()
  const text = await fs.readFile(CACHE_FILE, "utf8")
  const geojson = JSON.parse(text)
  if (!geojson?.features || !Array.isArray(geojson.features)) {
    throw new Error("Unexpected GeoJSON shape — no features array")
  }
  console.log(`Parsing ${geojson.features.length} constellation features…`)

  // Group features by IAU code first, then build geometry per group.
  // Serpens (the only IAU constellation split into two non-contiguous
  // pieces, Caput + Cauda) shows up as two features sharing id "Ser".
  // We merge them into one constellation with disconnected line
  // segments — same IAU rule, same Serpens entry.
  const byCode = new Map()
  let missingFromMap = 0
  for (const feat of geojson.features) {
    const iauCode = feat.id
    if (!IAU_CONSTELLATIONS[iauCode]) {
      missingFromMap++
      continue
    }
    const geom = feat.geometry
    if (geom?.type !== "MultiLineString") continue
    if (!byCode.has(iauCode)) byCode.set(iauCode, [])
    byCode.get(iauCode).push(...geom.coordinates)
  }

  const constellations = []
  let totalStars = 0
  let totalEdges = 0
  for (const [iauCode, mergedLines] of byCode) {
    const meta = IAU_CONSTELLATIONS[iauCode]
    const { stars, edges } = buildStarsAndEdges(mergedLines)
    if (!stars.length) continue
    totalStars += stars.length
    totalEdges += edges.length
    constellations.push({
      id: iauIdToEngineId(iauCode),
      iauCode,
      name: meta.name,
      designation: meta.designation,
      fact: meta.blurb,
      stars,
      edges,
    })
  }
  console.log(`  Generated ${constellations.length} constellations · ${totalStars} stars · ${totalEdges} edges`)
  if (missingFromMap > 0) {
    console.log(`  ⚠ ${missingFromMap} features had no IAU mapping (script bug — investigate)`)
  }

  // Sort by name for stable diffs.
  constellations.sort((a, b) => a.name.localeCompare(b.name))

  const out = `// AUTO-GENERATED by scripts/fetch-constellations.mjs. Do not edit by hand.
// Source: d3-celestial constellations.lines.json (BSD-3); IAU 3-letter codes + names per IAU Working Group.
// Re-generate: pnpm data:constellations

import type { Constellation } from "@/components/universe-engine/types"

/**
 * All 88 IAU-recognised constellations with line-figure geometry.
 *
 * astronomy.ts merges this with its 7 hand-curated entries (Ursa
 * Major, Polaris/Ursa Minor, Orion, Cassiopeia, Leo, Lyra, Cygnus),
 * which carry richer fact text + canonical magnitudes for their
 * member stars. For the other 81, this file is the authoritative
 * source — re-run \`pnpm data:constellations\` to refresh.
 *
 * Star nodes here are anonymous figure-points (name + designation
 * empty, magnitude defaulted to 3.0). The Universe Engine's
 * NamedStarHoverLayer (components/universe-engine/named-star-hover-layer.tsx)
 * handles the real naming + tooltip for the 358 named stars in HYG.
 */

export const IAU_CONSTELLATIONS_GENERATED: Constellation[] = ${JSON.stringify(constellations, null, 2)}
`

  await ensureDir(path.dirname(OUT_FILE))
  await fs.writeFile(OUT_FILE, out, "utf8")
  const stat = await fs.stat(OUT_FILE)
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} — ${(stat.size / 1024).toFixed(1)} KB`)
}

main().catch((err) => { console.error(err); process.exit(1) })
