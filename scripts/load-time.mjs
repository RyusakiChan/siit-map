// Load timing on "Fast 4G" with a 4x CPU throttle at 390x844 (a production build served by `vite preview`).
//   APP_URL=http://localhost:5192/siit-map/ node scripts/load-time.mjs [hash] [runs]
// Reports when the first map content shows (SVG placeholder, or the canvas) and when the 3D scene is ready (`[data-scene-ready]`, or the canvas painting).
import { chromium } from 'playwright-core'

const base = process.env.APP_URL ?? 'http://localhost:5192/siit-map/'
const [hash = '', runs = '3'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const rows = []
for (let i = 0; i < Number(runs); i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__t = {}
    const mark = (k, ok) => { if (window.__t[k] === undefined && ok()) window.__t[k] = Math.round(performance.now()) }
    const tick = () => {
      mark('content', () => document.querySelector('#boot, .map-placeholder, canvas'))
      mark('canvas', () => document.querySelector('canvas'))
      mark('ready', () => document.querySelector('[data-scene-ready="true"]'))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto(`${base}${hash}`, { waitUntil: 'commit' })
  await page.waitForFunction(() => window.__t?.canvas !== undefined, null, { timeout: 120000 })
  await new Promise((r) => setTimeout(r, 4000))
  rows.push(await page.evaluate(() => window.__t))
  await ctx.close()
}
console.log(JSON.stringify(rows))
await browser.close()
