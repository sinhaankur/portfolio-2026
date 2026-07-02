// Prefer a local playwright install; fall back to the global one (brew).
const { chromium } = await import("playwright").catch(() => import("/opt/homebrew/lib/node_modules/playwright/index.mjs"))
const browser = await chromium.launch({ channel: "chrome" })
for (let lvl = 1; lvl <= 10; lvl++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push("PAGE:" + String(e).slice(0, 90)))
  page.on("console", (m) => { if (m.type() === "error") errs.push("CON:" + m.text().slice(0, 90)) })
  try {
    await page.goto(`http://localhost:8899/games/dave-3d/?level=${lvl}`, { waitUntil: "load", timeout: 30000 })
    await page.waitForTimeout(3500)
    await page.locator("button", { hasText: "Start" }).first().click({ timeout: 6000 })
    await page.waitForTimeout(600)
    // input torture: run right + spam jumps, then left, then both directions fast
    await page.keyboard.down("ArrowRight")
    for (let i = 0; i < 4; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(350) }
    await page.keyboard.up("ArrowRight")
    await page.keyboard.down("ArrowLeft")
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Space"); await page.waitForTimeout(300) }
    await page.keyboard.up("ArrowLeft")
    // rapid direction flip stress
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight")
      await page.keyboard.press("Space")
    }
    await page.waitForTimeout(500)
    // FPS sample over 2s
    const fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now()
      const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(Math.round(n / 2)) }
      requestAnimationFrame(tick)
    }))
    // HUD state: level + deaths
    const hud = await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll("span")).map((s) => s.textContent).filter((x) => x && (x.includes("Lvl") || x.includes("💀")))
      return t.join(" ")
    })
    await page.screenshot({ path: `/tmp/stress-L${lvl}.png` })
    console.log(`L${lvl}: fps=${fps} hud="${hud}" errors=${errs.length}${errs.length ? " " + errs.slice(0, 2).join(" | ") : ""}`)
  } catch (e) {
    console.log(`L${lvl}: FAILED ${String(e).slice(0, 100)} errors=${errs.length}`)
  }
  await ctx.close()
}
await browser.close()
