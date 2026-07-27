#!/usr/bin/env node
/**
 * perf-test — an automated smoothness + health check for the Universe Engine.
 *
 * "Feels laggy" is subjective; this makes it measurable and repeatable. It loads
 * the engine in a real browser and reads the frame-time stats the engine
 * publishes on `window.__uePerf` (fps / p50 / p95 / max / tier), asserting the
 * scene is healthy — and, on a real GPU, smooth.
 *
 * Uses the SAME driver as scripts/smoke-site.mjs: Playwright with the system
 * Chrome (channel: "chrome"), local install first then the brew global. No new
 * dependency in the tree.
 *
 * TWO MODES, because headless GPUs lie:
 *
 *   • CORRECTNESS (default) — CI-safe. Plain headless Chrome renders WebGL via a
 *     software path that posts single-digit FPS for ANY heavy 3D scene, so an
 *     FPS threshold would be meaningless. This mode asserts what IS valid there:
 *     no GLSL/WebGL/runtime errors, the engine mounts + publishes stats, and the
 *     adaptive-quality controller converges to a stable tier (no thrashing).
 *
 *   • PERF (`--gpu`) — run locally, headed, on the real GPU. Additionally asserts
 *     the smoothness budget below (p95 frame time + min fps + worst-frame cap).
 *     This is the number that answers "is it smooth?" — only a real GPU can.
 *
 * Usage:
 *   node scripts/perf-test.mjs                         # correctness (CI)
 *   node scripts/perf-test.mjs --gpu                   # perf, real GPU (headed)
 *   node scripts/perf-test.mjs --url http://localhost:3001
 *   node scripts/perf-test.mjs --route /lab/celestial/ --route /
 *
 * A server must already be running (pnpm dev, or a static preview of out/).
 */

// Match smoke-site.mjs: local playwright first, fall back to the brew global.
const { chromium } = await import("playwright").catch(() =>
  import("/opt/homebrew/lib/node_modules/playwright/index.mjs"),
)

// ── Smoothness budgets (real-GPU mode only) ──────────────────────────────────
const BUDGET = {
  // p95 frame time: 95% of frames must land under this. 26 ms ≈ the worst frames
  // still clearing ~38 fps — matches the adaptive controller's DOWN threshold, so
  // a pass means the engine settled on a genuinely smooth tier.
  p95Ms: 26,
  minFps: 45,   // typical frame must be smooth
  maxMs: 60,    // hard ceiling on any single hitch
}

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const collect = (f) => argv.reduce((a, cur, i) => (cur === f && argv[i + 1] ? [...a, argv[i + 1]] : a), [])

const GPU_MODE = has("--gpu")
const BASE_URL = val("--url", "http://localhost:3000").replace(/\/$/, "")
const ROUTES = collect("--route").length ? collect("--route") : ["/lab/celestial/", "/"]
const SETTLE_MS = 12000   // intro + adaptive convergence
const SAMPLE_WINDOWS = 5  // __uePerf windows to collect (~1.2s each)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function testRoute(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()) })
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
    await sleep(SETTLE_MS)
    const samples = []
    for (let i = 0; i < SAMPLE_WINDOWS; i++) {
      const s = await page.evaluate(() => window.__uePerf ?? null)
      if (s) samples.push(s)
      await sleep(1400)
    }
    const glErrors = errors.filter((e) => /shader|glsl|webgl|program|link|compile/i.test(e))
    return { samples, errors, glErrors }
  } finally {
    await context.close()
  }
}

function summarize(samples) {
  if (!samples.length) return null
  const worstP95 = Math.max(...samples.map((s) => s.p95))
  const worstMax = Math.max(...samples.map((s) => s.max))
  const minFps = Math.min(...samples.map((s) => s.fps))
  const tiers = samples.map((s) => s.tier)
  const converged = new Set(tiers.slice(-3)).size === 1 // last windows agree
  return { worstP95, worstMax, minFps, finalTier: samples[samples.length - 1].tier, converged }
}

async function main() {
  console.log(`Universe Engine perf test — ${GPU_MODE ? "PERF mode (real GPU)" : "CORRECTNESS mode (headless/CI)"}`)
  console.log(`  base: ${BASE_URL}\n`)

  // Headed on the real GPU (headless Chrome won't use the discrete/Metal GPU);
  // headless for CI correctness. channel:"chrome" matches smoke-site.mjs.
  const browser = await chromium.launch({ channel: "chrome", headless: !GPU_MODE })
  const problems = []
  try {
    for (const route of ROUTES) {
      const url = BASE_URL + route
      process.stdout.write(`• ${route}  … `)
      const { samples, glErrors, errors } = await testRoute(browser, url)
      const sum = summarize(samples)

      if (glErrors.length) { console.log("GLSL/WebGL ERROR"); problems.push(`${route}: shader/WebGL error → ${glErrors[0]}`); continue }
      if (!sum) { console.log("NO STATS"); problems.push(`${route}: engine never published window.__uePerf (didn't mount / intro stuck?)`); continue }

      console.log(`fps≥${sum.minFps} · p95 ${Math.round(sum.worstP95)}ms · max ${Math.round(sum.worstMax)}ms · tier ${sum.finalTier}${sum.converged ? "" : " (thrashing!)"}`)

      if (!sum.converged) problems.push(`${route}: adaptive tier never converged (thrashing).`)
      const otherErr = errors.filter((e) => !/shader|glsl|webgl|program|link|compile/i.test(e))
      if (otherErr.length) problems.push(`${route}: runtime error → ${otherErr[0]}`)

      if (GPU_MODE) {
        if (sum.worstP95 > BUDGET.p95Ms) problems.push(`${route}: p95 ${Math.round(sum.worstP95)}ms exceeds ${BUDGET.p95Ms}ms — worst frames stutter.`)
        if (sum.minFps < BUDGET.minFps) problems.push(`${route}: min fps ${sum.minFps} below ${BUDGET.minFps}.`)
        if (sum.worstMax > BUDGET.maxMs) problems.push(`${route}: worst frame ${Math.round(sum.worstMax)}ms exceeds ${BUDGET.maxMs}ms hitch cap.`)
      }
    }
  } finally {
    await browser.close()
  }

  console.log("")
  if (problems.length) {
    console.error("❌ Perf test failed:\n")
    for (const p of problems) console.error("  • " + p)
    if (!GPU_MODE) console.error("\n(Correctness mode. For real FPS thresholds run locally with --gpu.)")
    process.exit(1)
  }
  console.log(GPU_MODE ? "✓ Smooth — within perf budget.\n" : "✓ Healthy — no shader/runtime errors, engine renders, tier converges.\n")
}

main().catch((e) => { console.error("perf-test crashed:", e?.message ?? e); process.exit(2) })
