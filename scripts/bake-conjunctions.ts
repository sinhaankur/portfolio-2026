/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 *
 * Bakes the conjunction screening results for /lab/celestial.
 *
 * Screens the freshly-fetched catalog (public/data/satellites.json) for the
 * next 24 hours and writes the ranked close approaches to
 * public/data/conjunctions.json — the static-site analogue of the server-side
 * screening a commercial SSA shop runs continuously. The UI loads this
 * instantly and the results refer to the exact same objects the explorer
 * renders, so every conjunction is flyable.
 *
 * Run AFTER fetch-satellites.mjs:  node scripts/bake-conjunctions.ts [hours]
 * Honesty: geometry-only screening on public TLEs (no covariance → no Pc);
 * the snapshot + window are recorded in the file and shown in the UI.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { screenConjunctions, type ScreeningObject } from "../lib/conjunction.ts"

async function main() {
  const hours = Number(process.argv[2] ?? 24)
  const url = new URL("../public/data/satellites.json", import.meta.url)
  const catalog = JSON.parse(readFileSync(url, "utf8")) as {
    snapshot: string
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

  const startMs = Date.now()
  console.log(`Screening ${objects.length} objects, ${hours}h from now…`)
  const t0 = Date.now()
  const results = await screenConjunctions(objects, {
    startMs,
    hours,
    coarseStepS: 60,
    reportKm: 5,
    candidateKm: 100,
    onProgress: (f) => {
      const pct = Math.floor(f * 10) * 10
      if (pct % 20 === 0) process.stdout.write(`${pct}% `)
    },
  })
  console.log(`\nScreened in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${results.length} approaches ≤ 5 km`)

  const top = results.slice(0, 150).map((c) => ({
    aId: c.a.id,
    aName: c.a.name,
    aType: c.a.type,
    aOwner: c.a.owner,
    bId: c.b.id,
    bName: c.b.name,
    bType: c.b.type,
    bOwner: c.b.owner,
    tcaMs: Math.round(c.tcaMs),
    missKm: +c.missKm.toFixed(3),
    relSpeedKms: +c.relSpeedKms.toFixed(2),
  }))

  const out = {
    generatedMs: startMs,
    snapshot: catalog.snapshot,
    windowHours: hours,
    reportKm: 5,
    screenedObjects: objects.length,
    totalFound: results.length,
    conjunctions: top,
  }
  const outUrl = new URL("../public/data/conjunctions.json", import.meta.url)
  writeFileSync(outUrl, JSON.stringify(out))
  console.log(`Wrote top ${top.length} → public/data/conjunctions.json`)
}

void main()
