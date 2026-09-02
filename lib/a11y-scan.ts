/**
 * a11y-scan — a live, in-page accessibility evaluator in the spirit of WAVE.
 *
 * Scans the current document's DOM for real WCAG / usability issues and returns
 * structured findings the panel renders WAVE-style (errors · alerts · features).
 * Pure DOM inspection — no network, no external service. It checks the *rendered*
 * page, so it's honest about what a real user's assistive tech would encounter.
 *
 * Categories (WAVE's model):
 *   · error   — a real barrier (missing alt, unlabeled control, contrast fail)
 *   · alert   — likely a problem, needs a human look (redundant/empty link)
 *   · feature — a11y done right (alt text present, landmarks, skip link) — shown
 *               so the report celebrates what's correct, not just what's wrong.
 *
 * © Ankur Sinha.
 */

export type Severity = "error" | "alert" | "feature"

export interface Finding {
  severity: Severity
  code: string
  label: string
  detail: string
  count: number
  /** A short "why it matters" line — the educational part. */
  why: string
}

export interface ScanResult {
  findings: Finding[]
  counts: { error: number; alert: number; feature: number }
  scannedAt: number
}

// ── Contrast helpers (WCAG relative luminance) ───────────────────────────────
function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}
function contrastRatio(fg: number[], bg: number[]): number {
  const l1 = luminance(fg[0], fg[1], fg[2])
  const l2 = luminance(bg[0], bg[1], bg[2])
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}
function parseColor(c: string): number[] | null {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(",").map((p) => parseFloat(p))
  if (parts.length < 3) return null
  // Fully transparent → can't judge; skip.
  if (parts[3] !== undefined && parts[3] === 0) return null
  return [parts[0], parts[1], parts[2]]
}
/** Walk up for the first non-transparent background. */
function effectiveBg(el: Element): number[] {
  let node: Element | null = el
  while (node) {
    const bg = parseColor(getComputedStyle(node).backgroundColor)
    if (bg) return bg
    node = node.parentElement
  }
  return [255, 255, 255]
}

export function scanAccessibility(): ScanResult {
  const findings: Finding[] = []
  const add = (f: Omit<Finding, "count"> & { count?: number }) =>
    findings.push({ count: 1, ...f })

  // 1 · Images without alt text (error) — vs decorative alt="" (fine).
  const imgs = Array.from(document.querySelectorAll("img"))
  const missingAlt = imgs.filter((i) => !i.hasAttribute("alt"))
  if (missingAlt.length)
    add({
      severity: "error", code: "img-alt", label: "Image missing alt text",
      count: missingAlt.length,
      detail: `${missingAlt.length} image(s) have no alt attribute.`,
      why: "Screen readers announce the filename or nothing — the content is lost. Use alt=\"\" only for purely decorative images.",
    })
  const withAlt = imgs.filter((i) => i.hasAttribute("alt")).length
  if (withAlt)
    add({ severity: "feature", code: "img-alt-ok", label: "Images with alt text", count: withAlt, detail: `${withAlt} image(s) provide alternative text.`, why: "Text alternatives make images perceivable to screen-reader users." })

  // 2 · Buttons / links with no accessible name (error).
  const controls = Array.from(document.querySelectorAll("button, a, [role='button']"))
  const unnamed = controls.filter((el) => {
    const text = (el.textContent || "").trim()
    const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")
    const hasImg = el.querySelector("img[alt]:not([alt=''])") || el.querySelector("svg [aria-label], svg title")
    return !text && !aria && !hasImg
  })
  if (unnamed.length)
    add({
      severity: "error", code: "control-name", label: "Control with no label",
      count: unnamed.length,
      detail: `${unnamed.length} button/link(s) have no discernible text or label.`,
      why: "A screen reader announces \"button\" with no purpose. Add visible text, aria-label, or a titled icon.",
    })

  // 3 · Form inputs without a label (error).
  const inputs = Array.from(document.querySelectorAll("input, select, textarea")).filter(
    (el) => !["hidden", "submit", "button", "reset"].includes((el as HTMLInputElement).type)
  )
  const unlabeled = inputs.filter((el) => {
    const id = el.id
    const hasFor = id && document.querySelector(`label[for='${CSS.escape(id)}']`)
    const wrapped = el.closest("label")
    const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")
    return !hasFor && !wrapped && !aria
  })
  if (unlabeled.length)
    add({ severity: "error", code: "input-label", label: "Form field with no label", count: unlabeled.length, detail: `${unlabeled.length} input(s) lack an associated label.`, why: "Users can't tell what to type. Associate a <label>, or use aria-label." })

  // 4 · Heading order — skipped levels (alert) + presence of h1 (feature/error).
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
  const h1s = headings.filter((h) => h.tagName === "H1")
  if (h1s.length === 0)
    add({ severity: "error", code: "no-h1", label: "No first-level heading", count: 1, detail: "The page has no <h1>.", why: "The h1 names the page for assistive tech; every page should have exactly one." })
  else if (h1s.length > 1)
    add({ severity: "alert", code: "multi-h1", label: "Multiple h1 headings", count: h1s.length, detail: `${h1s.length} <h1> elements found.`, why: "Usually a page should have one h1 as its title; multiples can confuse the outline." })
  else
    add({ severity: "feature", code: "h1-ok", label: "Page has one h1", count: 1, detail: "A single first-level heading names the page.", why: "Gives assistive tech a clear page title." })

  let lastLevel = 0, skips = 0
  for (const h of headings) {
    const level = parseInt(h.tagName[1], 10)
    if (lastLevel && level > lastLevel + 1) skips++
    lastLevel = level
  }
  if (skips)
    add({ severity: "alert", code: "heading-skip", label: "Skipped heading level", count: skips, detail: `${skips} place(s) jump a heading level (e.g. h2 → h4).`, why: "Screen-reader users navigate by heading level; skips break the mental outline." })

  // 5 · Landmarks (feature) — main / nav / footer / banner.
  const hasMain = document.querySelector("main, [role='main']")
  if (hasMain)
    add({ severity: "feature", code: "landmark-main", label: "Main landmark present", count: 1, detail: "A <main> region marks the primary content.", why: "Lets users jump straight to the content, past the nav." })
  else
    add({ severity: "alert", code: "no-main", label: "No main landmark", count: 1, detail: "No <main> region found.", why: "Without it, screen-reader users can't skip repeated navigation." })

  // 6 · Skip link (feature).
  const skip = Array.from(document.querySelectorAll("a[href^='#']")).find((a) =>
    /skip/i.test(a.textContent || "")
  )
  if (skip)
    add({ severity: "feature", code: "skip-link", label: "Skip-to-content link", count: 1, detail: "A skip link lets keyboard users bypass the nav.", why: "The first tab stop should let you jump to the content." })

  // 7 · Language on <html> (feature/error).
  const lang = document.documentElement.getAttribute("lang")
  if (lang)
    add({ severity: "feature", code: "html-lang", label: "Page language set", count: 1, detail: `<html lang="${lang}"> is declared.`, why: "Tells screen readers which pronunciation rules to use." })
  else
    add({ severity: "error", code: "no-lang", label: "No page language", count: 1, detail: "The <html> element has no lang attribute.", why: "Screen readers may read text with the wrong accent/pronunciation." })

  // 8 · Text contrast — sample visible text against its background (error/alert).
  const textEls = Array.from(document.querySelectorAll("p, li, a, span, button, h1, h2, h3, h4, label"))
    .filter((el) => {
      const t = (el.textContent || "").trim()
      if (!t || t.length < 2) return false
      // only leaf-ish text nodes (avoid double-counting wrappers)
      const hasElementChild = Array.from(el.childNodes).some((n) => n.nodeType === 1)
      if (hasElementChild) return false
      const rect = (el as HTMLElement).getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    .slice(0, 400) // cap the sample for speed
  let lowContrast = 0
  for (const el of textEls) {
    const cs = getComputedStyle(el as HTMLElement)
    const fg = parseColor(cs.color)
    if (!fg) continue
    const bg = effectiveBg(el)
    const ratio = contrastRatio(fg, bg)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const min = large ? 3 : 4.5
    if (ratio < min) lowContrast++
  }
  if (lowContrast)
    add({ severity: "error", code: "contrast", label: "Low text contrast", count: lowContrast, detail: `${lowContrast} text element(s) fall below WCAG AA contrast.`, why: "Low-vision users can't read low-contrast text. AA needs 4.5:1 (or 3:1 for large text)." })
  else
    add({ severity: "feature", code: "contrast-ok", label: "Text contrast passes", count: 1, detail: "Sampled text meets WCAG AA contrast.", why: "Readable for low-vision users." })

  const counts = { error: 0, alert: 0, feature: 0 }
  for (const f of findings) counts[f.severity] += 1

  // Order: errors first, then alerts, then features.
  const rank: Record<Severity, number> = { error: 0, alert: 1, feature: 2 }
  findings.sort((a, b) => rank[a.severity] - rank[b.severity])

  return { findings, counts, scannedAt: Date.now() }
}
