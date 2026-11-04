// Checks the booth poster: npm run booth-poster:check (after npm run booth-poster).
// Renders print/booth-poster.html in Chrome, decodes both QR codes from a 150 dpi raster and asserts they are the exact
// URLs, checks no text block overflows and the QR codes are >= 120 mm, then writes print/booth-poster.pdf and .png.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jsqr = readFileSync(join(root, 'node_modules/jsqr/dist/jsQR.js'), 'utf8')
const browser = await chromium.launch({ channel: 'chrome' })
// 150 dpi: A1 is 594 mm = 3508 px. CSS px at 96 dpi x 1.5625; the page is 594 mm = 2245 CSS px wide.
const page = await browser.newPage({ viewport: { width: 2300, height: 3200 }, deviceScaleFactor: 1.5625 })
await page.goto(pathToFileURL(join(root, 'print/booth-poster.html')).href)
await page.waitForFunction(() => document.documentElement.dataset.ready === '1')
await page.addStyleTag({ content: 'body{background:#fff!important}.page{margin:0!important;box-shadow:none!important}' })
const el = await page.$('.page')
const info = await el.evaluate((n) => {
  const svg = n.querySelector('svg')
  const mmPerUnit = svg.getBoundingClientRect().width / 25.4 * 25.4 // placeholder, replaced below
  const unit = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width
  const qr = {}
  for (const g of n.querySelectorAll('[data-qr]')) {
    const inner = g.querySelector('svg')
    qr[g.dataset.qr] = inner.getBoundingClientRect().width * unit // viewBox units are A1 mm
  }
  const over = []
  for (const b of n.querySelectorAll('.col, .card, .tag, .group')) if (b.scrollHeight > b.clientHeight + 0.5 || b.scrollWidth > b.clientWidth + 0.5) over.push(b.className)
  return { urls: { app: n.dataset.urlApp, survey: n.dataset.urlSurvey }, qr, over, body: document.documentElement.dataset.bodySize, mmPerUnit }
})
const png = await el.screenshot({ path: join(root, 'print/booth-poster.png'), type: 'png' })
const decoder = await browser.newPage()
await decoder.addScriptTag({ content: jsqr })
const codes = await decoder.evaluate(async (b64) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  // Decode each half separately so both codes are found.
  const out = []
  for (const [x0, x1] of [[0, 0.5], [0.5, 1]]) {
    const px = ctx.getImageData(Math.floor(img.width * x0), Math.floor(img.height * 0.76), Math.floor(img.width * (x1 - x0)), Math.floor(img.height * 0.22))
    out.push(globalThis.jsQR(px.data, px.width, px.height)?.data ?? null)
  }
  return out
}, png.toString('base64'))
let bad = 0
const fail = (m) => { bad++; console.log(`BAD ${m}`) }
if (codes[0] !== info.urls.app) fail(`app QR decoded ${codes[0]}`)
else console.log(`ok  app QR -> ${codes[0]}`)
if (codes[1] !== info.urls.survey) fail(`survey QR decoded ${codes[1]}`)
else console.log(`ok  survey QR -> ${codes[1]}`)
const paperMm = Number(process.env.PAPER === 'A2' ? 420 : 594) / 594 // QR size at the chosen paper = design mm x this
for (const [k, v] of Object.entries(info.qr)) {
  const a1 = v
  console.log(`${a1 >= 120 ? 'ok ' : 'BAD'} ${k} QR ${a1.toFixed(1)} mm at A1 (${(a1 * paperMm).toFixed(1)} mm on ${process.env.PAPER === 'A2' ? 'A2' : 'A1'})`)
  if (a1 < 120) bad++
}
console.log(`body text ${info.body} mm design size (bullets); overflow: ${info.over.length ? info.over.join(', ') : 'none'}`)
if (info.over.length) bad++
if (Number(info.body) < 10) fail('body text shrank below 10 mm')
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: join(root, 'print/booth-poster.pdf'), preferCSSPageSize: true, printBackground: true })
await browser.close()
console.log(bad ? `${bad} problem(s)` : 'booth poster OK; print/booth-poster.pdf and print/booth-poster.png written')
if (bad) process.exit(1)
