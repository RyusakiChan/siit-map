// Screenshots for the traced-floor reports (phone size, touch). Needs `npm run dev` on :5173.
//   node scripts/floor-shots.mjs floor3 <outDir>
//   node scripts/floor-shots.mjs floors24 <outDir>
// The plan photos are only read from D:\SIITMap\docs\source-photos and kept in the page's memory.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [which = 'floor3', out = 'shots'] = process.argv.slice(2)
const base = process.env.APP_URL ?? 'http://localhost:5173/'
mkdirSync(out, { recursive: true })
const POSTER = {
  3: 'D:/SIITMap/docs/source-photos/floor-3/20261030_120623.jpg',
  4: 'D:/SIITMap/docs/source-photos/floor-4/20261030_122017.jpg',
  2: 'D:/SIITMap/docs/source-photos/floor-2/jpg/IMG_2546.jpg',
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/removeChild|unmount a root/.test(e.message)) console.log('pageerror:', e.message.slice(0, 120)) })
  return { ctx, page }
}
async function open(page, hash = '') {
  await page.goto(`${base}${hash}`)
  await page.waitForFunction(() => window.__store, null, { timeout: 60000 })
  await wait(2500)
}
const store = (page, fn, arg) => page.evaluate(fn, arg)

async function appShots(list) {
  for (const s of list) {
    if (process.env.ONLY && !s.name.startsWith(process.env.ONLY)) continue
    const { ctx, page } = await phone()
    try {
      await open(page, s.hash ?? '')
      await s.run?.(page)
      await wait(s.settle ?? 1800)
      await page.screenshot({ path: join(out, `${s.name}.png`) })
      console.log('shot', s.name)
    } catch (e) {
      console.log('FAILED', s.name, e.message.slice(0, 160))
    }
    await ctx.close()
  }
}

async function traceShot(floor, name, align) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.goto(`${base}trace.html`)
  await page.waitForFunction(() => window.__trace, null, { timeout: 60000 })
  await page.getByRole('button', { name: String(floor), exact: true }).click()
  await page.locator('input[type=file]').setInputFiles(POSTER[floor])
  await page.waitForFunction(() => window.__trace.getState().photo, null, { timeout: 60000 })
  await page.evaluate((m) => {
    const st = window.__trace.getState()
    window.__trace.setState({ photo: { ...st.photo, matrix: m, opacity: 0.55 } })
  }, align)
  await wait(1500)
  await page.screenshot({ path: join(out, `${name}.png`) })
  console.log('shot', name)
  await ctx.close()
}

const sel = (id, snap) => async (page) => {
  await store(page, async ([id, snap]) => {
    const s = window.__store.getState()
    s.selectRoom(id, { focus: true })
    await new Promise((r) => setTimeout(r, 1200))
    if (snap) window.__store.getState().setSnap(snap)
  }, [id, snap])
}
const view = (v) => (page) => store(page, (v) => window.__store.getState().setView(v), v)

if (which === 'floor3') {
  const align = JSON.parse(process.env.ALIGN_F3 ?? 'null')
  await appShots([
    { name: '01-floor3-single', run: view(3), settle: 3000 },
    { name: '02-stacked', run: view('all'), settle: 3000 },
    { name: '03-card-1-301', run: async (p) => { await view(3)(p); await wait(1500); await sel('f3-1-301', 'full')(p) }, settle: 2500 },
    { name: '04-card-1-316-shared', run: async (p) => { await view(3)(p); await wait(1500); await sel('f3-1-316', 'full')(p) }, settle: 2500 },
    { name: '05-dept-cet-details', hash: '#/dept/d-cet' },
    {
      name: '06-search-1-310',
      run: async (p) => {
        await p.getByRole('button', { name: /Search/ }).first().click()
        await wait(800)
        await p.keyboard.type('1-310')
      },
    },
    { name: '07-route-1-301-to-1-317', hash: '#/route/f3-1-301/f3-1-317', settle: 3500 },
    { name: '08-route-floor2-sample-to-1-315-all', hash: '#/route/sample-cla-2-02/f3-1-315', run: view('all'), settle: 3500 },
  ])
  if (align && !process.env.ONLY) await traceShot(3, '09-trace-floor3-over-poster', align)
}

if (which === 'floors24') {
  const align = JSON.parse(process.env.ALIGN_F4 ?? 'null')
  await appShots([
    { name: 'f2-01-floor2-single', run: view(2), settle: 3000 },
    { name: 'f4-01-floor4-single', run: view(4), settle: 3000 },
    { name: 'f2-02-stacked-2-3-4', run: view('all'), settle: 3000 },
    { name: 'f2-03-route-1-206-to-1-301', hash: '#/route/f2-1-206/f3-1-301', settle: 3500 },
    { name: 'f4-02-route-1-301-to-1-410-all', hash: '#/route/f3-1-301/f4-1-410', run: view('all'), settle: 3500 },
    { name: 'f4-03-card-1-414-bcet-msme', run: async (p) => { await view(4)(p); await wait(1500); await sel('f4-1-414', 'full')(p) }, settle: 2500 },
  ])
  if (align && !process.env.ONLY) await traceShot(4, 'f4-04-trace-floor4-over-poster', align)
}

await browser.close()
