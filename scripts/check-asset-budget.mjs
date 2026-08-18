#!/usr/bin/env node
/**
 * check-asset-budget — a lightweight CI guard against asset bloat.
 *
 * The site is hosted 100% free (GitHub Pages + Cloudflare + Git LFS). The one
 * place a free ceiling exists is Git LFS (GitHub free tier: ~1 GB storage +
 * 1 GB/month bandwidth), and every version of an LFS-tracked file counts. This
 * script fails the build BEFORE bloat becomes a quota problem, so you get a
 * clear heads-up instead of a surprise "LFS quota exceeded" email.
 *
 * It measures two budgets:
 *   1. GLB models (LFS-tracked *.glb) — the quota-relevant set.
 *   2. Texture images under public/textures — bandwidth on every page load.
 * Plus a hard cap on any SINGLE file, so one accidental 50 MB export can't slip
 * in. Budgets are generous headroom over today's real totals; bump them
 * deliberately (with intent) if the site genuinely grows.
 *
 * Run: `node scripts/check-asset-budget.mjs`  (wired into the deploy build)
 */

import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"

const MB = 1024 * 1024

// ── Budgets (generous headroom over current real totals) ─────────────────────
const BUDGETS = {
  // All *.glb models (LFS). Today ~24 MB after webp-texture compression.
  glbTotalMB: 40,
  // public/textures/*. Today ~13 MB.
  texturesTotalMB: 24,
  // No single asset should exceed this — catches an un-optimized export.
  singleFileMB: 6,
}

/** Recursively collect files under a dir, returning [absPath, sizeBytes]. */
function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out // dir doesn't exist — skip
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push([p, statSync(p).size])
  }
  return out
}

const root = process.cwd()
const publicDir = join(root, "public")

/**
 * Drop gitignored files: they never ship (CI won't even check them out), so they
 * shouldn't count against the LFS/bandwidth budget. This lets a deliberately
 * R2-only asset (e.g. the 11 MB GEBCO height map, kept locally for upload) sit in
 * public/ without failing the local budget check. `git check-ignore --stdin`
 * echoes back only the ignored paths.
 */
function dropGitignored(files) {
  if (files.length === 0) return files
  let ignored = new Set()
  try {
    const input = files.map(([p]) => p).join("\n")
    const out = execFileSync("git", ["check-ignore", "--stdin"], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    ignored = new Set(out.split("\n").filter(Boolean))
  } catch {
    // `git check-ignore` exits non-zero when NOTHING is ignored — that's fine,
    // it means keep everything. Any other failure: don't hide anything.
  }
  return files.filter(([p]) => !ignored.has(p))
}

const allFiles = dropGitignored(walk(publicDir))
const glbFiles = allFiles.filter(([p]) => p.endsWith(".glb"))
const texFiles = dropGitignored(walk(join(publicDir, "textures")))

const sum = (files) => files.reduce((s, [, b]) => s + b, 0)
const glbTotal = sum(glbFiles)
const texTotal = sum(texFiles)

const problems = []

if (glbTotal > BUDGETS.glbTotalMB * MB) {
  problems.push(
    `GLB models total ${(glbTotal / MB).toFixed(1)} MB exceeds budget ${BUDGETS.glbTotalMB} MB.\n` +
    `    → Compress textures to webp with: npx @gltf-transform/cli optimize <in> <out> --compress false --simplify false --texture-compress webp`,
  )
}
if (texTotal > BUDGETS.texturesTotalMB * MB) {
  problems.push(
    `Textures total ${(texTotal / MB).toFixed(1)} MB exceeds budget ${BUDGETS.texturesTotalMB} MB.\n` +
    `    → Re-encode with cwebp -q 82, or drop the resolution tier.`,
  )
}

// Single-file cap applies only to assets loaded during rendering (models +
// images). PDFs/decks are download-on-demand — not page-load weight — so they
// are exempt (a 26 MB case-study deck is fine; it never blocks first paint).
const RENDER_EXT = /\.(glb|webp|png|jpg|jpeg|avif|ktx2)$/i
const bigOnes = allFiles
  .filter(([p, b]) => b > BUDGETS.singleFileMB * MB && RENDER_EXT.test(p) && !p.includes("/games/"))
  .sort((a, b) => b[1] - a[1])
for (const [p, b] of bigOnes) {
  problems.push(`Single file ${(b / MB).toFixed(1)} MB over ${BUDGETS.singleFileMB} MB cap: ${p.replace(root + "/", "")}`)
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log("Asset budget check:")
console.log(`  GLB models : ${(glbTotal / MB).toFixed(1)} MB / ${BUDGETS.glbTotalMB} MB  (${glbFiles.length} files)`)
console.log(`  Textures   : ${(texTotal / MB).toFixed(1)} MB / ${BUDGETS.texturesTotalMB} MB  (${texFiles.length} files)`)

if (problems.length) {
  console.error("\n❌ Asset budget exceeded:\n")
  for (const p of problems) console.error("  • " + p)
  console.error(
    "\nThe site is hosted on free tiers (Git LFS ~1 GB). Trim the assets above, " +
    "or if the growth is intentional, raise the budget in scripts/check-asset-budget.mjs.\n",
  )
  process.exit(1)
}

console.log("✓ Within budget.\n")
