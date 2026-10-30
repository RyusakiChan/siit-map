// Main-thread time (and rAF interval) for a fixed rotate gesture the camera on floor 3, with a 4x CPU throttle at 390x844 (production build).
//   APP_URL=http://localhost:5193/siit-map/ node scripts/frame-time.mjs [runs]
import { chromium } from 'playwright-core'

const base = process.env.APP_URL ?? 'http://localhost:5193/siit-map/'
const runs = Number(process.argv[2] ?? 3)
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const all = []
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await page.goto(`${base}#/`)
  await page.waitForSelector('canvas')
  await page.getByRole('button', { name: 'Floor 3' }).click()
  await new Promise((r) => setTimeout(r, 3500))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.evaluate(() => {
    window.__ft = []
    let last = performance.now()
    const tick = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  await cdp.send('Performance.enable')
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  await page.mouse.move(200, 640)
  await page.mouse.down()
  for (let k = 0; k < 90; k++) {
    await page.mouse.move(200 + Math.sin(k / 8) * 120, 640 + Math.cos(k / 6) * 40)
    await new Promise((r) => setTimeout(r, 16))
  }
  await page.mouse.up()
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const busy = (m1.TaskDuration - m0.TaskDuration) * 1000
  const ft = await page.evaluate(() => window.__ft)
  // Frames while the camera was moving only: drop the idle gaps (demand rendering stops when nothing changes).
  const moving = ft.filter((d) => d < 400)
  const mean = moving.reduce((a, b) => a + b, 0) / moving.length
  all.push(busy)
  console.log(`run ${i + 1}: main thread busy ${busy.toFixed(0)} ms for the same 90 drags; rAF interval ${mean.toFixed(1)} ms over ${moving.length} frames`)
  await ctx.close()
}
console.log(`mean main-thread busy ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(0)} ms`)
await browser.close()
