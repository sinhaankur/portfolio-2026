#!/usr/bin/env node
/**
 * build-resume-pdf.mjs — render the resume markdown into a clean, single-column,
 * ATS-safe PDF (real selectable text, standard headings, no multi-column
 * sidebar that breaks resume parsers).
 *
 * Pipeline: markdown → minimal HTML (hand-rolled, no deps) → Chrome headless
 * --print-to-pdf. Chrome embeds selectable text (not an image), so both humans
 * and applicant-tracking systems can read it.
 *
 * Usage: node scripts/build-resume-pdf.mjs
 * In:  public/ankur-sinha-resume.md
 * Out: public/ankur-sinha-resume.pdf
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const MD = join(ROOT, "public", "ankur-sinha-resume.md")
const OUT = join(ROOT, "public", "ankur-sinha-resume.pdf")
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// inline: **bold**, *italic*, [text](url) → keep the visible text (links styled)
function inline(s) {
  let t = esc(s)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, url) => {
    const safe = url.replace(/"/g, "%22")
    return `<a href="${safe}">${txt}</a>`
  })
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>")
  return t
}

function mdToHtml(md) {
  const lines = md.split("\n")
  const out = []
  let inList = false
  const closeList = () => {
    if (inList) {
      out.push("</ul>")
      inList = false
    }
  }
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, "")
    if (line === "---") {
      closeList()
      out.push('<hr/>')
    } else if (line.startsWith("# ")) {
      closeList()
      out.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (line.startsWith("## ")) {
      closeList()
      out.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith("### ")) {
      closeList()
      out.push(`<h3>${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>")
        inList = true
      }
      out.push(`<li>${inline(line.slice(2))}</li>`)
    } else if (line.trim() === "") {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join("\n")
}

const body = mdToHtml(readFileSync(MD, "utf8"))

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ankur Sinha — Résumé</title>
<style>
  @page { size: Letter; margin: 0.6in 0.7in; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #1a1a1a; font-size: 10.5pt; line-height: 1.42; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1 { font-size: 22pt; margin: 0 0 2pt; letter-spacing: -0.01em; font-weight: 600; }
  /* the bold line right under H1 = title; the next line = contact */
  h1 + p { font-size: 11pt; color: #333; margin: 0 0 2pt; }
  h1 + p + p { font-size: 9pt; color: #444; margin: 0 0 6pt; }
  h2 {
    font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.08em;
    border-bottom: 1px solid #bbb; padding-bottom: 3pt; margin: 16pt 0 8pt;
    font-weight: 700; color: #111;
  }
  h3 { font-size: 10.8pt; margin: 10pt 0 1pt; font-weight: 700; color: #111; }
  /* the italic/link line under an h3 project = repo/demo links */
  h3 + p { font-size: 9pt; color: #555; margin: 0 0 3pt; }
  p { margin: 0 0 5pt; }
  ul { margin: 3pt 0 6pt; padding-left: 16pt; }
  li { margin: 0 0 2.5pt; }
  a { color: #1a4f8b; text-decoration: none; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 9pt; background: #f2f2f2; padding: 0 2px; border-radius: 2px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10pt 0; }
  strong { font-weight: 700; }
</style></head><body>
${body}
</body></html>`

const tmp = mkdtempSync(join(tmpdir(), "resume-"))
const htmlPath = join(tmp, "resume.html")
writeFileSync(htmlPath, html)

execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${OUT}`,
    `file://${htmlPath}`,
  ],
  { stdio: "ignore" },
)

console.log(`Wrote ${OUT}`)
