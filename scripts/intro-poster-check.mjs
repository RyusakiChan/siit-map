// Checks the intro poster: npm run intro-poster:check (after npm run intro-poster).
// Renders print/intro-poster.html in Chrome, decodes the QR code from a 150 dpi raster and asserts it is the exact URL,
// checks the QR is >= 160 mm and no text overflows, then writes print/intro-poster.pdf and .png.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const jsqr = readFileSync(join(root, 'node_modules/jsqr/dist/jsQR.js'), 'utf8')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 2300, height: 3200 }, deviceScaleFactor: 1.5625 })
await page.goto(pathToFileURL(join(root, 'print/intro-poster.html')).href)
await page.waitForFunction(() => document.documentElement.dataset.ready === '1')
await page.addStyleTag({ content: 'body{background:#fff!important}.page{margin:0!important;box-shadow:none!important}' })
const el = await page.$('.page')
const info = await el.evaluate((n) => {
  const svg = n.querySelector('svg')
  const pr = svg.getBoundingClientRect()
  const unit = svg.viewBox.baseVal.width / pr.width // viewBox units = A1 mm
  const q = n.querySelector('[data-qr] svg').getBoundingClientRect()
  const over = []
  for (const b of n.querySelectorAll('.group')) if (b.scrollHeight > b.clientHeight + 0.5 || b.scrollWidth > b.clientWidth + 0.5) over.push('group box')
  // Every text and chip must stay inside the inner frame.
  const lo = 34
  const hi = 594 - 34
  for (const t of n.querySelectorAll('text, .cc')) {
    const r = t.getBoundingClientRect()
    if ((r.left - pr.left) * unit < lo || (r.right - pr.left) * unit > hi) over.push('outside frame: ' + (t.textContent || 'chip').trim().slice(0, 30))
  }
  const chips = [...n.querySelectorAll('.cc')].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.right] })
  for (let i = 1; i < chips.length; i++) if (chips[i][0] < chips[i - 1][1]) over.push('chips overlap')
  // The QR crop in screenshot pixels (page is 1.5625 device px per CSS px), with a margin.
  const crop = [(q.left - pr.left) * 1.5625 - 40, (q.top - pr.top) * 1.5625 - 40, q.width * 1.5625 + 80, q.height * 1.5625 + 80]
  return { url: n.dataset.urlApp, qrMm: q.width * unit, crop, over, shrunk: document.documentElement.dataset.shrunk, chip: document.documentElement.dataset.chipScale }
})
const png = await el.screenshot({ path: join(root, 'print/intro-poster.png'), type: 'png' })
const decoder = await browser.newPage()
await decoder.addScriptTag({ content: jsqr })
const code = await decoder.evaluate(async ([b64, crop]) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const [x, y, w, h] = crop.map((v) => Math.max(0, Math.floor(v)))
  const px = ctx.getImageData(x, y, Math.min(w, img.width - x), Math.min(h, img.height - y))
  return globalThis.jsQR(px.data, px.width, px.height)?.data ?? null
}, [png.toString('base64'), info.crop])
let bad = 0
const fail = (m) => { bad++; console.log(`BAD ${m}`) }
if (code !== info.url) fail(`QR decoded ${code}`)
else console.log(`ok  QR -> ${code}`)
const isA2 = process.env.PAPER === 'A2'
console.log(`${info.qrMm >= 160 ? 'ok ' : 'BAD'} QR ${info.qrMm.toFixed(1)} mm at A1 (${(info.qrMm * (isA2 ? 420 / 594 : 1)).toFixed(1)} mm on ${isA2 ? 'A2' : 'A1'})`)
if (info.qrMm < 160) bad++
console.log(`chip scale ${info.chip}; text shrunk >15%: ${info.shrunk}; overflow: ${info.over.length ? info.over.join(', ') : 'none'}`)
if (info.over.length) bad++
if (Number(info.shrunk) > 0) fail('some text shrank more than 15%')
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: join(root, 'print/intro-poster.pdf'), preferCSSPageSize: true, printBackground: true })
await browser.close()
console.log(bad ? `${bad} problem(s)` : 'intro poster OK; print/intro-poster.pdf and print/intro-poster.png written')
if (bad) process.exit(1)
