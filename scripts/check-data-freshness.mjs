#!/usr/bin/env node
/**
 * check-data-freshness.mjs — the autonomy tripwire.
 *
 * The site keeps its own simulation real via scheduled fetch scripts
 * (fetch-satellites, bake-conjunctions, bake-flights). But those steps fail
 * SOFT (`|| echo "::warning"`) so a third-party outage never breaks a deploy —
 * which means a feed can go quietly stale for weeks and nobody notices (exactly
 * how satellites.json drifted to 12 weeks old).
 *
 * This script is the health signal: it reads each baked data file, works out how
 * old its snapshot is, and reports. It exits non-zero if ANY feed is past its
 * max age, so the workflow surfaces a WARNING (it's wired with
 * `|| echo "::warning"` + continue-on-error — a health signal, never a gate).
 *
 * No network, no deps — just reads the committed JSON. Runs anywhere, free.
 *
 *   node scripts/check-data-freshness.mjs          # report + exit 1 if stale
 *   node scripts/check-data-freshness.mjs --json    # machine-readable
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DATA = path.join(ROOT, "public/data")

const DAY = 24 * 60 * 60 * 1000

// Each feed: the file, how to read its timestamp, and how stale is "too stale".
// Thresholds reflect how fast each thing really changes:
//   - TLEs drift within ~2 weeks → warn at 14 days.
//   - conjunction screen is a 24h look-ahead → warn at 3 days.
//   - flight snapshot is a per-minute volatile capture (NOT committed) → warn
//     at 30 days just to catch a totally dead feed, not day-to-day churn.
const FEEDS = [
  { name: "satellites", file: "satellites.json", maxDays: 14, ts: (d) => isoToMs(d.snapshot) },
  { name: "conjunctions", file: "conjunctions.json", maxDays: 3, ts: (d) => d.generatedMs ?? isoToMs(d.snapshot) },
  { name: "flights", file: "flights.json", maxDays: 30, ts: (d) => isoToMs(d.snapshot) },
]

function isoToMs(s) {
  if (!s) return NaN
  // Accept "YYYY-MM-DD" and full ISO.
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : NaN
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8"))
  } catch {
    return null
  }
}

async function main() {
  const asJson = process.argv.includes("--json")
  const now = Date.now()
  const results = []

  for (const feed of FEEDS) {
    const d = await readJson(feed.file)
    if (!d) {
      results.push({ name: feed.name, status: "missing", ageDays: null, maxDays: feed.maxDays })
      continue
    }
    const ms = feed.ts(d)
    if (!Number.isFinite(ms)) {
      results.push({ name: feed.name, status: "no-timestamp", ageDays: null, maxDays: feed.maxDays })
      continue
    }
    const ageDays = Math.round(((now - ms) / DAY) * 10) / 10
    const status = ageDays > feed.maxDays ? "stale" : "fresh"
    results.push({ name: feed.name, status, ageDays, maxDays: feed.maxDays })
  }

  const stale = results.filter((r) => r.status !== "fresh")

  if (asJson) {
    console.log(JSON.stringify({ checkedAt: new Date(now).toISOString(), results, ok: stale.length === 0 }, null, 2))
  } else {
    for (const r of results) {
      const tag = r.status === "fresh" ? "✓" : "✗"
      const age = r.ageDays == null ? r.status : `${r.ageDays}d old (max ${r.maxDays}d)`
      console.log(`${tag} ${r.name.padEnd(14)} ${age}`)
    }
    if (stale.length) {
      console.log(`\n${stale.length} feed(s) need attention: ${stale.map((r) => r.name).join(", ")}`)
    } else {
      console.log("\nAll data feeds fresh.")
    }
  }

  process.exit(stale.length === 0 ? 0 : 1)
}

main()
