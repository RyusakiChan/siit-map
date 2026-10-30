// Screenshots of the four places department colours show, for before/after comparison:
//   APP_URL=http://localhost:5173 node scripts/dept-look.mjs <outDir> <prefix>
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'dept-look'
const prefix = process.argv[3] ?? 'now'
const base = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', () => {})
  await page.goto(`${base}/`)
  await page.getByRole('button', { name: /^Key/ }).waitFor()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(out, `${prefix}-map.png`) })
  await page.getByRole('button', { name: /^Key/ }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(out, `${prefix}-key.png`) })
  await page.goto(base + '/')
  await page.locator('button.field').click()
  await page.locator('input').first().fill('Sample')
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(out, `${prefix}-search.png`) })
  await page.goto(`${base}/#/dept/sample-dept-b`)
  await page.reload()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(out, `${prefix}-dept.png`) })
  console.log('done', prefix)
} finally {
  await browser.close()
}
