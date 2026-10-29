// Phone-size browser check of the Ask assistant against the local Worker in mock mode.
//   npm run worker:dev                                   (terminal 1)
//   VITE_ASSISTANT_URL=http://127.0.0.1:8787 npm run dev (terminal 2)
//   node scripts/ask-e2e.mjs [outDir]                    (main flow)
//   node scripts/ask-e2e.mjs [outDir] --error            (stop the Worker first: error state)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'ask-shots'
const errorOnly = process.argv.includes('--error')
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
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    const shot = (n) => page.screenshot({ path: join(out, `${size.name}-${n}.png`) })
    await page.goto(base)
    await page.getByRole('button', { name: 'Ask', exact: true }).waitFor()
    await page.waitForTimeout(1500) // let the 3D scene settle

    if (errorOnly) {
      await page.getByRole('button', { name: 'Ask', exact: true }).tap()
      await page.getByRole('button', { name: 'Nearest restroom' }).tap()
      await page.getByRole('alert').waitFor()
      check((await page.getByRole('alert').innerText()).includes('The assistant is resting'), `${size.name}: error state shows the resting line`)
      await shot('06-error')
      await page.getByRole('button', { name: 'Open search' }).tap()
      await page.getByRole('searchbox').or(page.locator('input[type="search"], input[type="text"]').first()).waitFor()
      check((await page.locator('.ask-sheet').count()) === 0, `${size.name}: Open search closes the sheet`)
      await shot('07-error-to-search')
      await ctx.close()
      continue
    }

    await shot('01-map-with-ask')

    await page.getByRole('button', { name: 'Ask', exact: true }).tap()
    await page.getByRole('dialog', { name: 'Ask about SIIT' }).waitFor()
    check(await page.getByText('AI answers can be wrong').isVisible(), `${size.name}: disclaimer shown`)
    check(await page.getByText("Don't type personal information").isVisible(), `${size.name}: privacy line shown`)
    await shot('02-sheet-starters')

    await page.getByRole('button', { name: 'Where do I pay tuition fees?' }).tap()
    await page.getByRole('button', { name: 'Show on map' }).waitFor()
    check((await page.locator('.ask-bot').first().innerText()).includes('Sample Finance Office'), `${size.name}: starter chip gets an answer`)
    check(await page.getByRole('link', { name: /Source/ }).isVisible(), `${size.name}: source link shown`)
    await shot('03-answer')

    await page.getByRole('button', { name: 'Show on map' }).tap()
    await page.locator('.ask-sheet').waitFor({ state: 'detached' })
    await page.waitForTimeout(1500)
    check((await page.locator('.sheet').innerText()).includes('1-05'), `${size.name}: the map opens room 1-05`)
    await shot('04-room-on-map')

    // Thai question: switch the UI language, then ask in Thai.
    await page.getByRole('button', { name: 'Switch language to Thai' }).tap()
    await page.getByRole('button', { name: 'ถาม', exact: true }).tap()
    await page.getByPlaceholder('พิมพ์คำถาม').fill('ห้องน้ำอยู่ที่ไหน')
    await page.getByRole('button', { name: 'ส่ง', exact: true }).tap()
    await page.getByRole('button', { name: 'ดูบนแผนที่' }).last().waitFor()
    check(/[฀-๿]/.test(await page.locator('.ask-bot').last().innerText()), `${size.name}: Thai question gets a Thai answer`)
    await shot('05-thai')
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log('done')
