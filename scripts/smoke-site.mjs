/**
 * Site smoke test — boots every key route headless and fails on any console
 * error or page exception. Run against the static build:
 *   (cd out && python3 -m http.server 8899 &)   then   pnpm test:site
 * Uses the system Chrome via Playwright (channel: "chrome").
 */
// Prefer a local playwright install; fall back to the global one (brew).
const { chromium } = await import("playwright").catch(() => import("/opt/homebrew/lib/node_modules/playwright/index.mjs"))

const ROUTES = [
  ["/", 12000],            // hero engine needs time to ignite
  ["/lab/", 4000],
  ["/lab/helion-drift/", 10000],
  ["/lab/celestial/", 9000],
  ["/lab/big-bang/", 8000],
  ["/games/dave-3d/", 5000],
  ["/works/oracle/", 3000],
  ["/skills/", 3000],
  ["/usability/", 3000],
  ["/academic/p2p-streaming/", 2500],
  ["/academic/rubik-cube/", 2500],
]

const base = process.env.SMOKE_BASE ?? "http://localhost:8899"
const browser = await chromium.launch({ channel: "chrome" })
let failures = 0
for (const [route, settle] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => sessionStorage.setItem("intro-shown-v2", "1"))
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push("PAGE:" + String(e).slice(0, 100)))
  page.on("console", (m) => { if (m.type() === "error") errs.push("CON:" + m.text().slice(0, 100)) })
  page.on("response", (r) => { if (r.status() === 404 && r.url().startsWith(base)) errs.push("404:" + r.url().slice(base.length, base.length + 60)) })
  try {
    await page.goto(base + route, { waitUntil: "load", timeout: 45000 })
    await page.waitForTimeout(settle)
  } catch (e) {
    errs.push("NAV:" + String(e).slice(0, 80))
  }
  const ok = errs.length === 0
  if (!ok) failures++
  console.log(`${ok ? "✓" : "✗"} ${route} ${ok ? "" : "— " + errs.slice(0, 3).join(" | ")}`)
  await ctx.close()
}
await browser.close()
console.log(failures ? `\n${failures} route(s) failed` : "\nAll routes clean ✓")
process.exit(failures ? 1 : 0)
