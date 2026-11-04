// Captures the live app as a phone screenshot for the intro poster: npm run intro-phone-shot
// Writes scripts/assets/intro-phone.png. Needs network (opens the live GitHub Pages site). ROUTE=<hash> picks another view.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hash = process.env.ROUTE ?? '#/route/@f2-lift/f4-1-413'
const out = join(root, 'scripts/assets/intro-phone.png')
mkdirSync(dirname(out), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('https://ryusakichan.github.io/siit-map/' + hash, { waitUntil: 'load', timeout: 60000 })
await page.waitForSelector('canvas', { timeout: 60000 })
await page.waitForTimeout(9000)
await page.screenshot({ path: out, type: 'png' })
await browser.close()
if (errors.length) console.log('page errors:', errors.join(' | '))
console.log('wrote scripts/assets/intro-phone.png (' + hash + ')')
