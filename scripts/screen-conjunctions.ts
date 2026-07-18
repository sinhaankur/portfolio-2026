/**
 * Validation harness for lib/conjunction.ts — screens the baked CelesTrak
 * catalog (public/data/satellites.json) and prints the closest approaches.
 *
 * Run: node scripts/screen-conjunctions.ts [hours]
 * (Node 23+ strips types natively; no build step.)
 *
 * Screens from the catalog SNAPSHOT epoch, not "now" — SGP4 error grows
 * km-scale per day of TLE age, so validating near epoch is the honest test.
 */

import { readFileSync } from "node:fs"
import { screenConjunctions, type ScreeningObject } from "../lib/conjunction.ts"

async function main() {
const hours = Number(process.argv[2] ?? 6)

const catalog = JSON.parse(
  readFileSync(new URL("../public/data/satellites.json", import.meta.url), "utf8"),
) as {
  snapshot: string
  count: number
  sats: { id: number; name: string; owner?: string; type?: string; l1: string; l2: string }[]
}

const objects: ScreeningObject[] = catalog.sats.map((s) => ({
  id: s.id,
  name: s.name,
  l1: s.l1,
  l2: s.l2,
  type: s.type,
  owner: s.owner,
}))

const startMs = Date.parse(`${catalog.snapshot}T00:00:00Z`)
console.log(
  `Screening ${objects.length} objects for ${hours}h from ${catalog.snapshot} (snapshot epoch)…`,
)

const t0 = Date.now()
let lastPct = -1
const results = await screenConjunctions(objects, {
  startMs,
  hours,
  coarseStepS: 60,
  reportKm: 5,
  candidateKm: 100,
  onProgress: (f) => {
    const pct = Math.floor(f * 10) * 10
    if (pct !== lastPct) {
      lastPct = pct
      process.stdout.write(`${pct}% `)
    }
  },
})
console.log(`\nScreen took ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`Conjunctions with miss ≤ 5 km: ${results.length}\n`)

for (const c of results.slice(0, 15)) {
  const t = new Date(c.tcaMs).toISOString().slice(0, 19).replace("T", " ")
  console.log(
    `${c.missKm.toFixed(2).padStart(6)} km | ${t}Z | ${c.relSpeedKms.toFixed(1).padStart(4)} km/s | ` +
      `${c.a.name} (${c.a.type ?? "?"}/${c.a.owner ?? "?"}) × ${c.b.name} (${c.b.type ?? "?"}/${c.b.owner ?? "?"})`,
  )
}
}

// Wrapped in main() — Next's type-check covers scripts/ and its module target
// disallows top-level await.
void main()
