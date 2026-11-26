#!/usr/bin/env node
/**
 * harvest-me-corpus.mjs — build the "a subset of me" training corpus.
 *
 * helmsman-4b is meant to be a small model that knows MY world — my projects,
 * my craft, the sky/engine I built, in my voice. The quality of that model is
 * the quality of its training DATA, and the best data is my own real, honest,
 * first-person writing — not generic synthetic pairs.
 *
 * This harvests that real content into a clean directory of .md documents that
 * the distillation pipeline (unhosted-core/models/distill/gen_data.py) turns into
 * grounded (question → answer) pairs. Sources, all first-person and already
 * public on the site:
 *
 *   - lib/writing-posts.ts     short posts (the honest, terse voice)
 *   - app/writing/*            long-form writeups
 *   - app/works/*              case studies (what I actually did)
 *   - docs/*.md                engineering craft notes
 *   - CLAUDE.md                how the site is built (the architecture in my words)
 *   - components/universe-engine/ENGINE-STANDARDS.md   the engine philosophy
 *
 * Output: a flat corpus/ of .md files, one per source, cleaned of JSX/markup so
 * the teacher grounds questions in the PROSE, not the code.
 *
 *   node scripts/harvest-me-corpus.mjs --out ../GitHub/unhosted-core/models/distill/corpus
 *
 * Then, in the distill repo:
 *   python gen_data.py --docs corpus/ --out data/train.jsonl --n 12 ...
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const OUT = path.resolve(ROOT, arg("out", ".me-corpus"))

// Strip JSX/TS/markup noise so the teacher sees prose, not code. Conservative:
// we only pull human sentences, drop import/export lines, tags, and braces-only
// lines. Good enough to ground Q&A; not a general HTML parser.
function deJsx(s) {
  return s
    .replace(/<\/?[A-Za-z][^>]*>/g, " ") // JSX/HTML tags
    .replace(/\{[^{}]*\}/g, " ")          // simple {expressions}
    .replace(/https?:\/\/\S+/g, "")       // bare urls
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

async function readSafe(p) {
  try { return await fs.readFile(p, "utf8") } catch { return null }
}

const docs = [] // { name, title, text }

/* ── 1. Short writing posts (lib/writing-posts.ts) — the honest voice ───────── */
async function harvestShortPosts() {
  const src = await readSafe(path.join(ROOT, "lib/writing-posts.ts"))
  if (!src) return
  // Pull each post's title/lead/blurb/section bodies out of the data literal.
  // Crude but robust: match the string fields we care about, per post block.
  const blocks = src.split(/slug:\s*"/).slice(1)
  for (const b of blocks) {
    const sl = b.slice(0, b.indexOf('"'))
    const title = (b.match(/title:\s*"([^"]+)"/) || [])[1] || sl
    const lead = (b.match(/lead:\s*"([^"]+)"/) || [])[1] || ""
    const blurb = (b.match(/blurb:\s*"([^"]+)"/) || [])[1] || ""
    // section bodies: body: "…" (may be several)
    const bodies = [...b.matchAll(/body:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"))
    const text = [blurb, lead, ...bodies].filter(Boolean).join("\n\n")
    if (text.length > 120) docs.push({ name: `writing-${slug(sl)}`, title: `Writing: ${title}`, text })
  }
}

/* ── 2. Long-form writing + case studies + key pages (extract visible prose) ── */
async function harvestTsxProse(dir, prefix) {
  let entries = []
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      const page = path.join(p, "page.tsx")
      const src = await readSafe(page)
      if (src) {
        // Pull JSX text nodes + string literals that read like prose (>40 chars,
        // has spaces, not a className/import/url).
        const strings = [...src.matchAll(/["'`]([^"'`]{40,})["'`]/g)]
          .map((m) => m[1])
          .filter((s) => /\s/.test(s) && !/[{}<>]/.test(s) && !/^https?:|className|w-|px-|text-|flex|grid|rounded/.test(s))
        const text = deJsx(strings.join("\n\n"))
        if (text.length > 200) docs.push({ name: `${prefix}-${slug(e.name)}`, title: `${prefix}: ${e.name}`, text })
      }
    }
  }
}

/* ── 3. Raw markdown docs (craft notes, architecture) ──────────────────────── */
async function harvestMarkdown(files) {
  for (const rel of files) {
    const src = await readSafe(path.join(ROOT, rel))
    if (!src) continue
    const text = deJsx(src.replace(/```[\s\S]*?```/g, " ")) // drop code fences
    if (text.length > 200) docs.push({ name: `doc-${slug(path.basename(rel, ".md"))}`, title: `Notes: ${path.basename(rel)}`, text })
  }
}

async function main() {
  await harvestShortPosts()
  await harvestTsxProse(path.join(ROOT, "app/works"), "case-study")
  await harvestTsxProse(path.join(ROOT, "app/writing"), "writing")
  await harvestTsxProse(path.join(ROOT, "app/lab"), "lab")
  await harvestMarkdown([
    "CLAUDE.md",
    "README.md",
    "docs/ENGINES.md",
    "docs/webgl-craft-notes.md",
    "docs/pixel-perfect-astronomy-roadmap.md",
    "docs/star-cleaver-aaa-standards.md",
    "components/universe-engine/ENGINE-STANDARDS.md",
    "components/universe-engine/ENGINE-ARCHITECTURE.md",
  ])

  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(OUT, { recursive: true })
  let written = 0, chars = 0
  for (const d of docs) {
    const body = `# ${d.title}\n\n${d.text}\n`
    await fs.writeFile(path.join(OUT, `${d.name}.md`), body)
    written++; chars += body.length
  }
  console.log(`Harvested ${written} documents → ${path.relative(ROOT, OUT)}/`)
  console.log(`~${Math.round(chars / 1000)}k chars of my own content.`)
  console.log(`Next (in the distill repo): python gen_data.py --docs "${OUT}" --out data/train.jsonl --n 12`)
}

main()
