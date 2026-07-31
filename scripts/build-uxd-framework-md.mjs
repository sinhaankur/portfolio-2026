#!/usr/bin/env node
/**
 * build-uxd-framework-md.mjs — generate the canonical, licensed Markdown of the
 * Universal Experience Framework from the SAME data the /framework page renders
 * (lib/framework-data.ts), so the document and the live page never drift.
 *
 * Output: public/ankur-sinha-uxd-framework.md  (served + linked like the resume)
 * Licence: © Ankur Sinha — Ankur Sinha UXD. See the header block below.
 *
 * Run: node scripts/build-uxd-framework-md.mjs   (or: pnpm framework:md)
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT = join(ROOT, "public", "ankur-sinha-uxd-framework.md")
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc")

// The data file is TypeScript; compile just it to a temp dir and import the JS
// (same zero-dep approach as scripts/verify-sky-position.mjs).
const out = mkdtempSync(join(tmpdir(), "uxd-md-"))
try {
  execFileSync("node", [
    TSC, join(ROOT, "lib", "framework-data.ts"),
    "--target", "ES2020", "--module", "ESNext", "--moduleResolution", "bundler",
    "--outDir", out, "--skipLibCheck",
  ], { stdio: ["ignore", "ignore", "inherit"] })
  const mod = await import(pathToFileURL(join(out, "framework-data.js")).href)
  const { PRINCIPLES, LAW_GROUPS, HEURISTICS, PLANES, CORE_LOOP, METHOD, PRE_SHIP, POUR, CANON } = mod

  const today = new Date().toISOString().slice(0, 10)
  const L = []
  const p = (s = "") => L.push(s)

  // ── licence + front matter ────────────────────────────────────────────────
  p(`# Universal Experience Framework 1.0`)
  p()
  p(`**A working guide — Laws of UX & Cognition, heuristics, standards, and an applied method.**`)
  p()
  p(`Author: **Ankur Sinha** · Design × Engineering × AI · [sinhaankur.com](https://www.sinhaankur.com)`)
  p(`Live, interactive edition: [sinhaankur.com/framework](https://www.sinhaankur.com/framework)`)
  p(`Generated: ${today}`)
  p()
  p(`---`)
  p()
  p(`> **Licence — Ankur Sinha UXD.** © ${new Date().getFullYear()} Ankur Sinha. This`)
  p(`> framework — its structure, curation, principles, mnemonics and applied method —`)
  p(`> is the authored work of Ankur Sinha, released under **Ankur Sinha UXD** for`)
  p(`> personal reference and learning. You may read, share and cite it **with`)
  p(`> attribution to Ankur Sinha**; do not present it as your own or sell it. The`)
  p(`> underlying UX canon it assembles (Nielsen, Norman, Garrett, Yablonski, W3C`)
  p(`> WCAG 2.2, et al.) belongs to its original authors and is cited at the end.`)
  p(`> Structure after the Citi GS+DT "Universal Experience Framework 1.0" (2013).`)
  p(`>`)
  p(`> **Not a substitute for user research.** These are principles and heuristics to`)
  p(`> reason with, not laws of physics — validate with real users.`)
  p()
  p(`---`)
  p()

  // ── how to use ────────────────────────────────────────────────────────────
  p(`## How to use this`)
  p()
  p(`Read it once end-to-end for the model, then return to sections during design`)
  p(`and review. Each item states the **rule**, the **why** (the law or evidence`)
  p(`behind it), and an **apply** note for a real mock. When a spec and a principle`)
  p(`conflict, the principle wins — and the spec gets fixed.`)
  p()

  // ── principles ────────────────────────────────────────────────────────────
  p(`## 1 · The experience principles`)
  p()
  p(`The tie-breakers. When two designs are both plausible, the one that honours`)
  p(`more of these wins.`)
  p()
  PRINCIPLES.forEach((pr, i) => {
    p(`${i + 1}. **${pr.name}** — ${pr.what}`)
  })
  p()

  // ── laws of UX & cognition ────────────────────────────────────────────────
  p(`## 2 · Laws of UX & Cognition`)
  p()
  p(`The *why* behind the rules — the human wiring the framework is built on. Each`)
  p(`law carries a one-line **mnemonic** to remember it by.`)
  p()
  for (const g of LAW_GROUPS) {
    p(`### ${g.no} · ${g.title}`)
    p()
    p(`_${g.lead}_`)
    p()
    for (const law of g.laws) {
      p(`#### ${law.name}`)
      if (law.mnemonic) p(`> _"${law.mnemonic}"_`)
      p()
      p(law.deep || law.what)
      p()
      if (law.helps) p(`**Helps users:** ${law.helps}`)
      if (law.apply) p(`**Apply:** ${law.apply}`)
      p()
    }
  }

  // ── heuristics ────────────────────────────────────────────────────────────
  p(`## 3 · Nielsen's ten usability heuristics`)
  p()
  p(`The evaluation checklist — inspect any screen against these.`)
  p()
  for (const h of HEURISTICS) {
    p(`${h.n}. **${h.name}** — ${h.what}`)
  }
  p()

  // ── foundations ───────────────────────────────────────────────────────────
  p(`## 4 · Foundations`)
  p()
  p(`### The five planes (Garrett) — abstract to concrete`)
  p()
  p(`| # | Plane | Question it answers | What lives here |`)
  p(`| - | ----- | ------------------- | --------------- |`)
  for (const pl of PLANES) p(`| ${pl.n} | ${pl.name} | ${pl.q} | ${pl.lives} |`)
  p()
  p(`### The core loop`)
  p()
  p(CORE_LOOP.map((s) => `**${s.name}** (${s.note})`).join(" → "))
  p()

  // ── accessibility ─────────────────────────────────────────────────────────
  p(`## 5 · Accessibility — POUR & WCAG 2.2 AA`)
  p()
  p(`AA is the floor, not a feature.`)
  p()
  for (const q of POUR) p(`- **${q.name}** — ${q.what}`)
  p()

  // ── the method ────────────────────────────────────────────────────────────
  p(`## 6 · The applied method — run it on every screen`)
  p()
  for (const m of METHOD) p(`${m.n}. **${m.step}** — ${m.detail}`)
  p()
  p(`### Pre-ship checklist`)
  p()
  for (const c of PRE_SHIP) p(`- [ ] ${c}`)
  p()

  // ── canon ─────────────────────────────────────────────────────────────────
  p(`## Appendix · The canon`)
  p()
  p(`The shoulders this stands on:`)
  p()
  for (const c of CANON) p(`- ${c}`)
  p()
  p(`---`)
  p()
  p(`© ${new Date().getFullYear()} Ankur Sinha — **Ankur Sinha UXD**. Attribution required.`)
  p(`Generated from the live framework at sinhaankur.com/framework.`)
  p()

  writeFileSync(OUT, L.join("\n"), "utf8")
  console.log(`wrote ${OUT} (${L.length} lines)`)
} finally {
  rmSync(out, { recursive: true, force: true })
}
