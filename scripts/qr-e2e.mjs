// Phone-size browser check of the "You are here" QR screen (two sizes). Needs the dev server only:
//   npm run dev
//   node scripts/qr-e2e.mjs [outDir]            (APP_URL=http://localhost:5199/ for another port)
// Opens #/at/f3-lift, checks the banner and the Near you list, taps a row and checks a route starts from the QR spot;
// then checks "Back to where I am", "Find a room from here", the small pin after closing, and an unknown id.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'qr-shots'
const base = process.env.APP_URL ?? 'http://localhost:5173/'
mkdirSync(out, { recursive: true })

const sizes = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x740', width: 360, height: 740 },
]

const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`)
  console.log(`ok: ${what}`)
}

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  for (const size of sizes) {
    const newPage = async () => {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => {
        if (/removeChild/.test(e.message)) console.log(`note: ${e.message.slice(0, 60)}`)
        else throw e
      })
      return { ctx, page }
    }
    const tag = (n) => `${size.name}-${n}`
    const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

    // 1. The QR screen on each traced floor, one point per floor.
    for (const [id, floor, place] of [['f2-lift', 2, 'Lift lobby'], ['f3-lift', 3, 'Lift lobby'], ['f4-stairs-e', 4, 'Northeast stairs']]) {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/${id}`)
      await page.locator('.here-banner').waitFor()
      await page.waitForTimeout(1500)
      const banner = await page.locator('.here-banner').innerText()
      check(banner.includes('You are here') && banner.includes(`Floor ${floor} · ${place}`) && banner.includes("Map turned the way you're facing"), `${size.name}: ${id} banner`)
      check((await page.locator('.near-sheet .near-row').count()) === 5, `${size.name}: ${id} lists 5 places near you`)
      check((await page.getByRole('button', { name: 'Find a room from here' }).count()) === 1, `${size.name}: ${id} has "Find a room from here"`)
      check((await page.locator('.status-text').textContent()).includes(`Floor ${floor}`), `${size.name}: ${id} shows floor ${floor}`)
      check((await page.locator('.here-back').count()) === 0, `${size.name}: no "Back to where I am" before moving`)
      check(await noOverflow(page), `${size.name}: no sideways scroll`)
      await page.screenshot({ path: join(out, `${tag(`01-${id}`)}.png`) })
      await ctx.close()
    }

    // 1b. East and west facing points: the camera azimuth is minus the facing (a north-facing point cannot tell the sign).
    for (const [id, facing] of [['f2-corr-se', 90], ['f2-corr-nw', 270]]) {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/${id}`)
      await page.locator('.here-banner').waitFor()
      await page.waitForFunction(() => window.__rig)
      await page.waitForTimeout(1500)
      const az = await page.evaluate(() => window.__rig.azimuthAngle)
      const want = Math.atan2(Math.sin((-facing * Math.PI) / 180), Math.cos((-facing * Math.PI) / 180))
      check(Math.abs(Math.atan2(Math.sin(az - want), Math.cos(az - want))) < 0.05, `${size.name}: ${id} looks ${facing}° (azimuth ${az.toFixed(2)})`)
      await ctx.close()
    }

    // 2. Tap a Near-you row: a route starts from the QR spot.
    {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/f3-lift`)
      await page.locator('.near-row').first().waitFor()
      await page.waitForTimeout(1200)
      const second = page.locator('.near-row').nth(1)
      const name = (await second.locator('.row-title').innerText()).trim()
      await second.tap()
      await page.getByTestId('route-header').waitFor()
      await page.waitForTimeout(1200)
      check(/^Floor 3 · about \d+ min$/.test(await page.getByTestId('route-header').innerText()), `${size.name}: route header after tapping "${name}"`)
      check(page.url().includes('#/route/%40f3-lift/'), `${size.name}: the route starts from @f3-lift`)
      check((await page.getByTestId('route-step').innerText()).length > 0, `${size.name}: the first step is shown`)
      await page.screenshot({ path: join(out, `${tag('02-route-from-near-you')}.png`) })
      await ctx.close()
    }

    // 3. Quick chip, "Find a room from here", Back to where I am, close, unknown id.
    {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/f3-lift`)
      await page.locator('.near-row').first().waitFor()
      await page.waitForTimeout(1200)
      await page.waitForFunction(() => window.__rig)
      // Move the map: the "Back to where I am" button appears, and brings the QR view back.
      await page.mouse.move(size.width / 2, size.height * 0.4)
      await page.evaluate(() => {
        const rig = window.__rig
        rig.rotateTo(rig.azimuthAngle + 1.2, rig.polarAngle, false)
        rig.dispatchEvent({ type: 'controlstart' })
      })
      await page.waitForTimeout(500)
      check((await page.locator('.here-back').count()) === 1, `${size.name}: "Back to where I am" shows after moving the map`)
      await page.screenshot({ path: join(out, `${tag('03-back-to-where-i-am')}.png`) })
      const az = await page.evaluate(() => window.__rig.azimuthAngle)
      await page.getByRole('button', { name: 'Back to where I am' }).tap()
      await page.waitForTimeout(1500)
      const az2 = await page.evaluate(() => window.__rig.azimuthAngle)
      check(Math.abs(az2 - az) > 0.5 && Math.abs(az2) < 0.05, `${size.name}: the QR view is back (f3-lift faces north, azimuth ${az2.toFixed(2)})`)
      check((await page.locator('.here-back').count()) === 0, `${size.name}: the button goes away again`)

      // Find a room from here -> search -> a pick starts a route from the QR spot.
      await page.getByRole('button', { name: 'Find a room from here' }).tap()
      await page.locator('.search-screen input').fill('1-301')
      await page.locator('.search-screen .row').first().tap()
      await page.getByTestId('route-header').waitFor()
      check(page.url().includes('#/route/%40f3-lift/'), `${size.name}: a search pick starts a route from @f3-lift`)
      await ctx.close()
    }
    {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/f3-lift`)
      await page.locator('.near-row').first().waitFor()
      await page.waitForTimeout(1000)
      await page.locator('.near-chips').getByRole('button', { name: 'Restrooms' }).tap()
      await page.getByTestId('route-header').waitFor()
      check(page.url().includes('#/route/%40f3-lift/'), `${size.name}: the Restrooms chip starts a route`)
      await ctx.close()
    }
    {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/f3-lift`)
      await page.locator('.here-banner').waitFor()
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: 'Close "You are here"' }).tap()
      await page.waitForTimeout(600)
      check((await page.locator('.here-banner').count()) === 0 && (await page.locator('.near-sheet').count()) === 0, `${size.name}: closing hides the banner and the sheet`)
      check((await page.locator('.bottom-bar').count()) === 1, `${size.name}: the normal bottom bar is back`)
      check(await page.evaluate(() => window.__store.getState().here?.id === 'f3-lift'), `${size.name}: the small pin stays`)
      await page.screenshot({ path: join(out, `${tag('04-closed-small-pin')}.png`) })
      await ctx.close()
    }
    {
      const { ctx, page } = await newPage()
      await page.goto(`${base}#/at/nope-123`)
      await page.locator('.toast').waitFor()
      check((await page.locator('.toast').innerText()) === "This spot isn't on the map any more", `${size.name}: unknown id toast`)
      check(page.url().endsWith('#/'), `${size.name}: unknown id returns to the overview`)
      await page.screenshot({ path: join(out, `${tag('05-unknown-id')}.png`) })
      await ctx.close()
    }
  }
  console.log('qr e2e passed')
} finally {
  await browser.close()
}
