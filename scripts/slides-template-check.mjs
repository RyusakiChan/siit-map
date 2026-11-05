// Checks the slide template: npm run slides-template:check (after npm run slides-template).
// Reopens print/siit-map-final-slides.pptx and asserts: 19 slides at 16:9; every [placeholder] is a native text run (never
// inside a picture's name or alt text); only Kanit and IBM Plex Sans Thai are named anywhere; no text effects; pictures are
// at least 2x the placed size; both QR codes decode back to the exact URLs, from the embedded PNGs and from the thumbnails;
// and the HTML twin's overlap / overflow report is clean.
import JSZip from 'jszip'
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'scripts/slides-template.mjs'), 'utf8')
const URL_APP = /const URL_APP = '([^']+)'/.exec(src)[1]
const URL_SURVEY = /const URL_SURVEY = '([^']+)'/.exec(src)[1]
const zip = await JSZip.loadAsync(readFileSync(join(root, 'print/siit-map-final-slides.pptx')))
let bad = 0
const ok = (m) => console.log(`ok  ${m}`)
const fail = (m) => { bad++; console.log(`BAD ${m}`) }
const text = async (p) => zip.file(p).async('string')

const pres = await text('ppt/presentation.xml')
const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres)
const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)))
if (slideFiles.length === 19) ok('19 slides'); else fail(`${slideFiles.length} slides`)
if (sz && Math.abs(Number(sz[1]) / Number(sz[2]) - 16 / 9) < 0.002) ok(`16:9 (${(Number(sz[1]) / 914400).toFixed(3)} x ${(Number(sz[2]) / 914400).toFixed(3)} in)`); else fail('slide size is not 16:9')

// Placeholders are text runs; pictures carry no bracketed text.
let placeholders = 0
const pics = []
for (const f of slideFiles) {
  const xml = await text(f)
  const n = Number(f.match(/\d+/))
  const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1])
  const found = runs.flatMap((r) => r.match(/\[[^\]]+\]/g) ?? [])
  placeholders += found.length
  for (const m of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
    const pic = m[0]
    const descr = /descr="([^"]*)"/.exec(pic)?.[1] ?? ''
    const name = /<p:cNvPr[^>]*name="([^"]*)"/.exec(pic)?.[1] ?? ''
    if (/\[|\]/.test(descr + name)) fail(`slide ${n}: a picture carries bracketed text (${descr})`)
    const emb = /r:embed="([^"]+)"/.exec(pic)[1]
    const cx = Number(/<a:ext cx="(\d+)" cy="(\d+)"/.exec(pic)[1])
    pics.push({ slide: n, descr, emb, wIn: cx / 914400 })
  }
  if (/<a:(outerShdw|innerShdw|glow|softEdge|reflection)\b/.test(xml)) fail(`slide ${n}: text or shape effect found`)
}
if (placeholders > 0) ok(`${placeholders} [placeholders], all native text runs (none inside pictures)`); else fail('no placeholders found')

// Fonts named anywhere in the file.
const fontNames = new Set()
for (const f of Object.keys(zip.files).filter((x) => /^ppt\/(slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml$/.test(x))) {
  const xml = await text(f)
  for (const m of xml.matchAll(/typeface="([^"]*)"/g)) if (m[1] && !m[1].startsWith('+')) fontNames.add(m[1])
}
const allowed = new Set(['Kanit', 'IBM Plex Sans Thai'])
const extra = [...fontNames].filter((x) => !allowed.has(x))
if (extra.length === 0) ok(`fonts: ${[...fontNames].join(', ')}`); else fail(`other fonts named: ${extra.join(', ')}`)

// Picture resolution: at least 2x the placed size at 96 px/in.
const rels = {}
for (const f of slideFiles) {
  const n = Number(f.match(/\d+/))
  const xml = await text(`ppt/slides/_rels/slide${n}.xml.rels`)
  for (const m of xml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels[`${n}:${m[1]}`] = m[2]
  for (const m of xml.matchAll(/Target="([^"]+)"[^>]*Id="([^"]+)"/g)) rels[`${n}:${m[2]}`] = m[1]
}
const media = async (p) => zip.file(p.replace('../', 'ppt/')).async('nodebuffer')
let lowRes = 0
const qrs = []
for (const p of pics) {
  const buf = await media(rels[`${p.slide}:${p.emb}`])
  const w = buf.readUInt32BE(16)
  if (w < p.wIn * 96 * 2 - 1) { lowRes++; fail(`slide ${p.slide}: ${p.descr} is ${w}px for ${p.wIn.toFixed(2)} in`) }
  if (p.descr.startsWith('QR code')) qrs.push({ ...p, buf })
}
if (!lowRes) ok(`${pics.length} pictures, all at 2x or more`)

// QR decode: from the embedded PNGs and from the rendered thumbnails.
const jsqr = readFileSync(join(root, 'node_modules/jsqr/dist/jsQR.js'), 'utf8')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.addScriptTag({ content: jsqr })
const decode = (b64, crop) => page.evaluate(async ([data, c]) => {
  const img = new Image()
  img.src = `data:image/png;base64,${data}`
  await img.decode()
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.drawImage(img, 0, 0)
  const [x, y, w, h] = c ?? [0, 0, img.width, img.height]
  const px = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.min(w, img.width - x), Math.min(h, img.height - y))
  return globalThis.jsQR(px.data, px.width, px.height)?.data ?? null
}, [b64, crop])
const expect = (descr) => (descr.includes(URL_APP) ? URL_APP : URL_SURVEY)
for (const q of qrs) {
  const got = await decode(q.buf.toString('base64'))
  if (got === expect(q.descr)) ok(`QR on slide ${q.slide} decodes to ${got.slice(0, 48)}${got.length > 48 ? '...' : ''}`); else fail(`QR on slide ${q.slide} decoded ${got}`)
}
const PX = 144
const thumbs = [[8, [1.0, 2.0, 3.8], URL_APP], [14, [9.3, 2.0, 3.0], URL_SURVEY], [19, [1.3, 2.05, 3.1], URL_APP], [19, [7.6, 2.05, 3.1], URL_SURVEY]]
for (const [n, [x, y, s], url] of thumbs) {
  const png = readFileSync(join(root, `print/slides-preview/slide-${String(n).padStart(2, '0')}.png`)).toString('base64')
  const m = 0.2 * PX
  const got = await decode(png, [x * PX - m, y * PX - m, s * PX + 2 * m, s * PX + 2 * m])
  if (got === url) ok(`QR in the slide ${n} thumbnail decodes (${url === URL_APP ? 'site' : 'survey'})`); else fail(`QR in the slide ${n} thumbnail decoded ${got}`)
}
await browser.close()

// The twin's layout report: overflow, text outside the frame, overlapping text.
const twin = JSON.parse(readFileSync(join(root, 'print/slides-preview/twin-check.json'), 'utf8'))
const issues = twin.overflow.length + twin.outside.length + twin.overlap.length
if (issues === 0) ok('layout twin: no overflow, nothing outside the frame, no overlapping text'); else fail(`layout twin: ${[...twin.overflow, ...twin.outside, ...twin.overlap].join('; ')}`)
console.log(bad ? `${bad} problem(s)` : 'all checks passed')
process.exit(bad ? 1 : 0)
