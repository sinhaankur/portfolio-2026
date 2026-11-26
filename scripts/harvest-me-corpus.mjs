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

/* ── 4. Absolute-path markdown (skills, global house standards — outside repo) ─ */
async function harvestAbsMarkdown(entries) {
  for (const { file, title, prefix } of entries) {
    const src = await readSafe(file)
    if (!src) continue
    // Keep code FENCES here (lightly) — for skills/standards the code idiom IS
    // the pattern worth learning. But strip the triple-backticks so the teacher
    // reads it as content, and cap very long fences.
    const text = deJsx(src.replace(/```(\w+)?\n/g, "\n").replace(/```/g, "\n"))
    if (text.length > 200) docs.push({ name: `${prefix}-${slug(path.basename(path.dirname(file)) + "-" + path.basename(file, ".md"))}`, title, text })
  }
}

/* ── 5. Coding patterns — real code + its comments (HOW I build) ─────────────
   The comments in my code explain the WHY behind a pattern; pairing a comment
   with its code teaches the model my idioms (graceful degradation, device tiers,
   "never fail open", provider cascades, etc.). We pull files rich in explanatory
   comments and keep the comment-to-code pairing intact. */
async function harvestCodePatterns(files) {
  for (const rel of files) {
    const src = await readSafe(path.join(ROOT, rel))
    if (!src) continue
    // Keep the whole file but trim: it's short enough and the comment+code
    // pairing is the lesson. Strip only noise (imports, pure-type lines).
    const kept = src
      .split("\n")
      .filter((l) => !/^\s*import\s/.test(l) && !/^\s*export\s+type\s/.test(l))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    if (kept.length > 300) {
      docs.push({
        name: `pattern-${slug(path.basename(rel).replace(/\.(ts|tsx|mjs|js)$/, ""))}`,
        title: `How I build: ${path.basename(rel)} — a real coding pattern`,
        text: `This is one of my real source files. The comments explain WHY each decision was made — that reasoning is the pattern.\n\n${kept.slice(0, 8000)}`,
      })
    }
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
    "docs/star-cleaver-3d-pipeline.md",
    "components/universe-engine/ENGINE-STANDARDS.md",
    "components/universe-engine/ENGINE-ARCHITECTURE.md",
  ])

  // DESIGN · CODING PATTERNS · CREATIVE + SKILLS — the "how I think and build"
  // half. My skills library + house standards are distilled patterns of how I
  // work; the global CLAUDE.md is my design language (motion tokens, voice,
  // "no AI slop"). This is what makes the model a subset of HOW I build, not
  // just WHAT I built.
  const HOME = path.resolve(ROOT, "..")
  const skillEntries = []
  for (const base of [path.join(HOME, "skills-md/skills"), path.join(ROOT, ".claude/skills")]) {
    try {
      const walk = async (dir) => {
        for (const e of await fs.readdir(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name)
          if (e.isDirectory()) await walk(p)
          else if (e.name === "SKILL.md") skillEntries.push({ file: p, title: `My skill: ${path.basename(path.dirname(p))}`, prefix: "skill" })
        }
      }
      await walk(base)
    } catch { /* dir may not exist */ }
  }
  await harvestAbsMarkdown(skillEntries)
  await harvestAbsMarkdown([
    { file: path.join(HOME, ".claude/CLAUDE.md"), title: "My house standards — how I work, design language, stacks, voice", prefix: "standards" },
  ])

  // Real coding patterns — files whose COMMENTS teach my idioms (graceful
  // degradation, device tiers, provider cascades, "never fail open", honest
  // fallbacks, the room engine). The reasoning in the comments is the lesson.
  await harvestCodePatterns([
    "lib/llm-provider.ts",
    "lib/llm-runner.ts",
    "components/custom-cursor.tsx",
    "components/universe-engine/sky-panorama.tsx",
    "worker/sky-copilot.js",
    "scripts/check-data-freshness.mjs",
    "lib/device-tier.ts",
    "components/systems-status.tsx",
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
