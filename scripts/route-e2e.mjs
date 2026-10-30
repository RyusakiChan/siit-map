// Phone-size browser check of route mode (two sizes). Needs the dev server only:
//   VITE_ASSISTANT_URL=http://127.0.0.1:8787 npm run dev
//   node scripts/route-e2e.mjs [outDir]
// The assistant's /chat reply is answered in the browser with what the mock Worker returns for
// "how do I get to 5-02" (show_room + show_route with fromId null), so no Worker has to run.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'route-shots'
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
      // drei's Html raises this on unmount in dev when a floor changes after a deep link; it happens on #/room links
      // too (not caused by route mode) and the page keeps working, so it is logged, not fatal.
      page.on('pageerror', (e) => {
        if (/removeChild/.test(e.message)) console.log(`note: ${e.message.slice(0, 60)}`)
        else throw e
      })
      return { ctx, page }
    }
    const tag = (n) => `${size.name}-${n}`
    const stepText = (page) => page.getByTestId('route-step').innerText()
    const floorText = (page) => page.locator('.status-text').innerText()

    // 1. A route on one floor.
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.goto(`${base}#/route/f2-1-207/f2-1-205`)
      await page.getByTestId('route-header').waitFor()
      await page.waitForTimeout(1500)
      check((await page.getByTestId('route-header').innerText()).startsWith('Floor 2 · about'), `${size.name}: same-floor header`)
      check((await stepText(page)).startsWith('Leave Document Room'), `${size.name}: first step leaves the start room`)
      await shot('01-same-floor-start')
      let guard = 0
      while (!(await page.getByRole('button', { name: 'Done' }).count()) && guard++ < 10) {
        await page.getByRole('button', { name: 'Next', exact: true }).tap()
        await page.waitForTimeout(500)
      }
      check(/Meeting Room is the \d+(st|nd|rd|th) door on your (left|right)/.test(await stepText(page)), `${size.name}: last step names the door`)
      check((await floorText(page)).includes('Floor 2'), `${size.name}: stays on floor 2`)
      await shot('02-same-floor-end')
      await page.getByRole('button', { name: 'Done' }).tap()
      await page.waitForTimeout(800)
      check((await page.locator('.sheet').innerText()).includes('1-205'), `${size.name}: Done returns to the room card`)
      check((await page.locator('.sheet.peek').count()) === 1, `${size.name}: room card is the peek card`)
      await shot('03-back-to-room-card')
      await ctx.close()
    }

    // 2. A route across floors, step by step through each leg.
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.goto(`${base}#/route/f2-lifts/sample-lab-5-02`)
      await page.getByTestId('route-header').waitFor()
      await page.waitForTimeout(1500)
      check((await page.getByTestId('route-header').innerText()).startsWith('Floor 2 → Floor 5'), `${size.name}: cross-floor header`)
      check((await stepText(page)) === 'Take the lift to floor 5', `${size.name}: first step is the lift ride`)
      check((await floorText(page)).includes('Floor 2'), `${size.name}: leg 1 shows floor 2`)
      await shot('04-cross-floor-leg1')
      await page.getByRole('button', { name: 'Next', exact: true }).tap()
      await page.waitForTimeout(900)
      check((await floorText(page)).includes('Floor 5'), `${size.name}: Next switches to floor 5`)
      check((await stepText(page)).startsWith('Leave Sample Lift F5'), `${size.name}: leg 2 starts in the lift`)
      await shot('05-cross-floor-leg2')
      await page.getByRole('button', { name: 'Back', exact: true }).tap()
      await page.waitForTimeout(900)
      check((await floorText(page)).includes('Floor 2'), `${size.name}: Back returns to floor 2`)
      await page.getByRole('button', { name: 'Next', exact: true }).tap()
      await page.getByRole('button', { name: 'Next', exact: true }).tap()
      await page.getByRole('button', { name: 'Next', exact: true }).tap()
      await page.waitForTimeout(600)
      check((await stepText(page)).includes('Sample Lab 5-02'), `${size.name}: final step reaches the lab`)
      await shot('06-cross-floor-end')
      await ctx.close()
    }

    // 3. Avoid stairs.
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.goto(`${base}#/route/sample-f1-lobby/sample-off-5-07`)
      await page.getByTestId('route-header').waitFor()
      await page.waitForTimeout(1200)
      const steps = async () => {
        const seen = []
        await page.getByRole('button', { name: 'Back', exact: true }).waitFor()
        for (let i = 0; i < 12; i++) {
          seen.push(await stepText(page))
          if (await page.getByRole('button', { name: 'Done' }).count()) break
          await page.getByRole('button', { name: 'Next', exact: true }).tap()
          await page.waitForTimeout(250)
        }
        return seen
      }
      const withStairs = await steps()
      check(withStairs.some((s) => s.includes('stairs')), `${size.name}: default route uses the stairs`)
      await shot('07-stairs-route')
      await page.goto(`${base}#/route/sample-f1-lobby/sample-off-5-07`) // same hash: reload the page to start at step 1
      await page.reload()
      await page.getByTestId('route-header').waitFor()
      await page.getByRole('switch', { name: 'Avoid stairs' }).tap()
      await page.waitForTimeout(800)
      check((await page.getByRole('switch', { name: 'Avoid stairs' }).getAttribute('aria-checked')) === 'true', `${size.name}: toggle is on`)
      const withLift = await steps()
      check(withLift.some((s) => s.includes('lift')) && !withLift.some((s) => s.includes('stairs')), `${size.name}: avoid stairs uses only the lift`)
      await shot('08-avoid-stairs')
      await page.reload()
      await page.getByTestId('route-header').waitFor()
      check((await page.getByRole('switch', { name: 'Avoid stairs' }).getAttribute('aria-checked')) === 'true', `${size.name}: the choice is remembered`)
      await ctx.close()
    }

    // 4. A route from the QR spot: scan, open a room, Directions.
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.goto(`${base}#/at/sample-f2-lift`)
      await page.waitForTimeout(1500)
      await page.goto(`${base}#/room/sample-lab-5-02`)
      await page.getByRole('button', { name: 'Directions' }).waitFor()
      await shot('09-room-card-directions')
      await page.getByRole('button', { name: 'Directions' }).tap()
      await page.getByTestId('route-header').waitFor()
      check(page.url().includes('#/route/%40sample-f2-lift/sample-lab-5-02'), `${size.name}: the hash names the QR spot`)
      check((await page.locator('.route-from').innerText()).includes('where you scanned'), `${size.name}: From says where you scanned`)
      await page.waitForTimeout(1200)
      await shot('10-route-from-qr')
      // Without a scan, Directions asks where from.
      const fresh = await newPage()
      await fresh.page.goto(`${base}#/room/sample-lab-5-02`)
      await fresh.page.getByRole('button', { name: 'Directions' }).tap()
      await fresh.page.getByRole('dialog', { name: 'Directions to Sample Lab 5-02' }).waitFor()
      await fresh.page.screenshot({ path: join(out, `${tag('11-from-picker')}.png`) })
      await fresh.page.getByRole('button', { name: 'Main entrance' }).tap()
      await fresh.page.getByTestId('route-header').waitFor()
      check((await fresh.page.getByTestId('route-header').innerText()).startsWith('Floor 1 → Floor 5'), `${size.name}: From picker starts a route`)
      await fresh.ctx.close()
      await ctx.close()
    }

    // 6. Step list, floor picker during a route, "All" view, and stray room taps.
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.goto(`${base}#/route/sample-f1-lobby/sample-off-5-07`)
      await page.getByTestId('route-header').waitFor()
      await page.waitForTimeout(1200)
      await page.getByTestId('route-step').tap()
      await page.locator('.route-list').waitFor()
      const items = await page.locator('.route-list li').count()
      check(items >= 5 && (await page.locator('.route-list li[aria-current="step"]').count()) === 1, `${size.name}: step list shows all steps with the current one marked`)
      const btn = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox()
      check(btn.height >= 44, `${size.name}: Next is at least 44 px tall`)
      await shot('14-step-list')
      await page.locator('.route-list li').last().getByRole('button').tap()
      await page.waitForTimeout(800)
      check((await floorText(page)).includes('Floor 5'), `${size.name}: picking a step jumps to its floor`)
      await page.getByTestId('route-step').tap()
      await page.waitForTimeout(300)
      check((await page.locator('.route-list').count()) === 0, `${size.name}: tapping the step line closes the list`)
      await page.getByRole('button', { name: 'Floor 1', exact: true }).tap()
      await page.waitForTimeout(800)
      check((await stepText(page)).startsWith('Leave Sample Lobby'), `${size.name}: floor picker jumps to that floor's first step`)
      await page.evaluate(() => window.__store.getState().selectRoom('sample-lab-5-02', { focus: true }))
      await page.waitForTimeout(500)
      check((await page.getByTestId('route-header').count()) === 1 && (await page.locator('.sheet').count()) === 0, `${size.name}: a room tap keeps the route and opens no card`)
      await page.getByRole('button', { name: 'All floors' }).tap()
      await page.waitForTimeout(1200)
      await shot('15-all-floors-route')
      await page.getByRole('button', { name: 'Close directions' }).tap()
      await page.waitForTimeout(800)
      check((await page.locator('.sheet.peek').innerText()).includes('5-07'), `${size.name}: Close returns to the destination's peek card`)
      await page.getByRole('button', { name: 'Floor 2', exact: true }).tap()
      await page.evaluate(() => window.__store.getState().selectRoom('sample-lab-5-02', { focus: true, cross: true }))
      await page.waitForTimeout(1200)
      await shot('16-cross-floor-banner')
      await ctx.close()
    }

    // 5. A route started by the assistant's action (mock Worker).
    {
      const { ctx, page } = await newPage()
      const shot = (n) => page.screenshot({ path: join(out, `${tag(n)}.png`) })
      await page.route('**/chat', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            reply: 'Sample Lab 5-02 is on floor 5. This is mock mode with sample data.',
            actions: [{ type: 'show_room', roomId: 'sample-lab-5-02' }, { type: 'show_route', fromId: null, toId: 'sample-lab-5-02' }],
          }),
        }),
      )
      await page.goto(`${base}#/at/sample-f2-lift`)
      await page.getByRole('button', { name: 'Ask', exact: true }).waitFor()
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: 'Ask', exact: true }).tap()
      await page.getByRole('dialog', { name: 'Ask about SIIT' }).waitFor()
      await page.getByPlaceholder('Ask a question').fill('How do I get to 5-02?')
      await page.getByRole('button', { name: 'Send', exact: true }).tap()
      await page.getByRole('button', { name: 'Show route' }).waitFor()
      await shot('12-assistant-show-route')
      await page.getByRole('button', { name: 'Show route' }).tap()
      await page.getByTestId('route-header').waitFor()
      check(page.url().includes('#/route/%40sample-f2-lift/'), `${size.name}: Show route sets the route hash`)
      await page.waitForTimeout(1200)
      await shot('13-assistant-route')
      await page.goBack()
      await page.waitForTimeout(500)
      check((await page.getByTestId('route-header').count()) === 0, `${size.name}: Back leaves route mode`)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
console.log('done')
