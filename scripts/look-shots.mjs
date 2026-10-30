// Phone-size screenshots for the "Map look v2" before/after comparison. Needs a dev server:
//   npx vite --port 5191        then   APP_URL=http://localhost:5191/ node scripts/look-shots.mjs <prefix> <outDir>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [prefix = 'after', out = 'look-shots'] = process.argv.slice(2)
const base = process.env.APP_URL ?? 'http://localhost:5173/'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function phone(hash = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/removeChild|unmount a root/.test(e.message)) console.log('pageerror:', e.message.slice(0, 120)) })
  await page.goto(`${base}${hash}`)
  await page.waitForFunction(() => window.__store && window.__rig, null, { timeout: 90000 })
  await wait(2500)
  return { ctx, page }
}
const view = (v) => (page) => page.evaluate((v) => window.__store.getState().setView(v), v)
// Camera close to a room's centre (the dev-only rig handle).
const near = (id, dx, dy, dz) => (page) => page.evaluate(async ([id, dx, dy, dz]) => {
  const mod = await import('/src/data/index.ts')
  const r = mod.buildingData.rooms.find((r) => r.id === id)
  const f = mod.buildingData.floors.find((f) => f.level === r.floor)
  const cx = r.polygon.reduce((s, p) => s + p[0], 0) / r.polygon.length
  const cz = r.polygon.reduce((s, p) => s + p[1], 0) / r.polygon.length
  const y = f.elevation * 1.75
  window.__store.getState().setView(r.floor)
  await new Promise((r) => setTimeout(r, 1200))
  const rig = window.__rig
  await rig.moveTo(cx, y + 1, cz, false)
  await rig.rotateTo(Math.atan2(dx, dz), Math.acos(dy / Math.hypot(dx, dy, dz)), false)
  await rig.dollyTo(Math.hypot(dx, dy, dz), false)
  window.__getThree().invalidate()
}, [id, dx, dy, dz])
const shots = [
  { name: '01-floor2', run: view(2) },
  { name: '02-floor3', run: view(3) },
  { name: '03-floor4', run: view(4) },
  { name: '04-stacked', run: view('all') },
  { name: '05-stair-close', run: near('f3-stairs-top-mid', 9, 24, 14), settle: 2500 },
  { name: '06-lifts-close', run: near('f3-lifts', 9, 24, 14), settle: 2500 },
  { name: '07-selected-room', run: async (p) => { await view(3)(p); await wait(1500); await p.evaluate(async () => { window.__store.getState().selectRoom('f3-1-301', { focus: true }); await new Promise((r) => setTimeout(r, 1200)); window.__store.getState().setSnap('full') }) }, settle: 2500 },
  { name: '08-route-stairs-all', hash: '#/route/f2-1-208/f3-1-312', run: async (p) => { await view('all')(p); for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: 'Next' }).click(); await wait(500) } }, settle: 3500 },
  { name: '09-key', run: async (p) => { await view(3)(p); await p.evaluate(() => window.__store.getState().setKeyOpen(true)) } },
  { name: '10-restroom-chip-map', run: near('f3-restroom-top-mid', 6, 24, 18), settle: 3000 },
  { name: '11-search-restroom', run: async (p) => { await p.getByRole('button', { name: /Restrooms/ }).first().click() }, settle: 1500 },
]
for (const s of shots) {
  if (process.env.ONLY && !s.name.startsWith(process.env.ONLY)) continue
  const { ctx, page } = await phone(s.hash ?? '')
  try {
    await s.run?.(page)
    await wait(s.settle ?? 2000)
    await page.screenshot({ path: join(out, `${prefix}-${s.name}.png`) })
    console.log('shot', s.name)
  } catch (e) { console.log('FAILED', s.name, e.message.slice(0, 200)) }
  await ctx.close()
}
await browser.close()
