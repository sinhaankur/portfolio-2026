/**
 * Site smoke test — boots EVERY route headless, as a FIRST-TIME visitor, and
 * fails on any console error or page exception. Run against the static build:
 *   (cd out && python3 -m http.server 8899 &)   then   pnpm test:site
 * Uses the system Chrome via Playwright (channel: "chrome").
 *
 * First-time-visitor rule (learned the hard way): do NOT pre-seed
 * sessionStorage/localStorage. Seeding `intro-shown-v2` here once masked the
 * ignition curtain holding /lab behind ~7.5s of black for real visitors, and
 * hydration errors (#418) only surface on a genuine cold render. The home
 * route simply gets a settle long enough for the intro + engine hand-off.
 *
 * Also probes: after settling, the page must have real content (body text) and
 * no full-viewport curtain still up — a blank-but-error-free page is a fail.
 */
// Prefer a local playwright install; fall back to the global one (brew).
const { chromium } = await import("playwright").catch(() => import("/opt/homebrew/lib/node_modules/playwright/index.mjs"))

// Every content route from the export (see `pnpm build` output), with a settle
// long enough for what the page actually does. New route? Add it here.
const ROUTES = [
  ["/", 14000],                       // ignition intro (~7.5s) + hero engine
  ["/about/", 3000],
  ["/lab/", 4000],
  ["/lab/big-bang/", 8000],
  ["/lab/brainrot/", 4000],
  ["/lab/celestial/", 9000],
  ["/lab/cognitive-twin/", 2500],
  ["/lab/firmament/", 3000],
  ["/lab/helion-drift/", 10000],
  ["/lab/optical-flow/", 4000],
  ["/lab/star-cleaver/", 4000],       // legacy redirect → /lab/helion-drift (covered above)
  ["/lab/terrain/", 8000],            // 3D tiles terrain
  ["/lab/unhosted/", 2500],
  ["/lab/universe-assistant/", 6000],
  ["/lab/usability-engine/", 2500],
  ["/works/oracle/", 3000],
  ["/works/deloitte/", 3000],
  ["/works/rage/", 3000],
  ["/works/snowtint/", 3000],
  ["/academic/p2p-streaming/", 2500],
  ["/academic/rubik-cube/", 2500],
  ["/games/dave-3d/", 5000],
  ["/games/Gamelist.html", 3000],
  ["/writing/", 2500],
  ["/writing/universe-engine/", 2500],
  ["/writing/how-its-built/", 2500],
  // Short posts (lib/writing-posts.ts) — keep in sync when a post is added.
  ["/writing/adaptive-quality/", 2500],
  ["/writing/cinematic-descent/", 2500],
  ["/writing/dna-deep-time/", 2500],
  ["/writing/dna-tools/", 2500],
  ["/writing/real-glb-bodies/", 2500],
  ["/framework/", 3000],
  ["/skills/", 3000],
  ["/usability/", 3000],
  ["/upcoming/", 2500],
  ["/references/", 2500],
  ["/reference/spacecraft/", 3000],
  ["/reference/satellites/", 3000],
  ["/mirofish/", 3000],
  ["/photos/", 3000],
  ["/dna/", 4000],
  ["/dna/databases/", 2500],
  ["/dna/how-it-works/", 2500],
  ["/dna/tools/", 2500],
  ["/family/", 2500],
  ["/vera/", 3000],
  ["/dr-randhir-sinha/", 5000],       // silk hero video + 3D silkworm
  ["/aero/", 5000],                   // Aero Engine 3D
  ["/sky/", 12000],                   // full-screen sky experience
  ["/story/", 9000],                  // alt home over persistent sky
  ["/tv/", 3000],
  ["/stats/", 3000],                  // owner-only analytics dashboard (noindex)
  ["/ar/", 3000],
  ["/ja/", 3000],
  ["/ko/", 3000],
  ["/zh/", 3000],
  ["/es/", 3000],
  ["/fr/", 3000],
  ["/de/", 3000],
  ["/hi/", 3000],
  ["/embed/satellites/", 6000],       // embeddable satellite tracker
  ["/universe-engine/math/", 2500],
  ["/definitely-not-a-page/", 3000],  // 404 page (static starfield fallback)
]

const base = process.env.SMOKE_BASE ?? "http://localhost:8899"
const browser = await chromium.launch({ channel: "chrome" })
let failures = 0
for (const [route, settle] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push("PAGE:" + String(e).slice(0, 100)))
  page.on("console", (m) => {
    if (m.type() !== "error") return
    // The intentional-404 route's own document (and only that) logs a 404
    // resource error by design; asset 404s are still caught by the response
    // listener below on every route.
    if (route.startsWith("/definitely") && m.text().includes("status of 404")) return
    errs.push("CON:" + m.text().slice(0, 100))
  })
  page.on("response", (r) => {
    // The 404 route legitimately 404s its own document; asset 404s still fail it.
    const isOwnDoc = route.startsWith("/definitely") && r.url() === base + route
    if (r.status() === 404 && r.url().startsWith(base) && !isOwnDoc)
      errs.push("404:" + r.url().slice(base.length, base.length + 60))
  })
  try {
    await page.goto(base + route, { waitUntil: "load", timeout: 45000 })
    await page.waitForTimeout(settle)
    // Content probe: after the settle the visitor must be looking at the page,
    // not a stuck curtain or an empty shell.
    const probe = await page.evaluate(() => ({
      textLen: (document.body.innerText || "").trim().length,
      curtainUp: !!document.querySelector('[aria-hidden="true"].fixed.inset-0.bg-black'),
    }))
    if (probe.curtainUp) errs.push("STUCK: intro curtain still up after settle")
    if (probe.textLen < 40) errs.push(`BLANK: only ${probe.textLen} chars of visible text`)
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
