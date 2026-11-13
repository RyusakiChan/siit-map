// Checks the progress deck: node scripts/progress-slides-check.mjs (after npm run progress-slides).
// Reopens print/siit-map-progress-2026-11-13.pptx: 7 slides at 16:9; text is native text runs; only Kanit and IBM Plex Sans Thai are
// named; no text effects; body text is at least 18 pt (footer and slide number excepted); the QR decodes to the site URL from the
// embedded PNG and from the slide 7 thumbnail; the twin's overlap / overflow report is clean.
import JSZip from 'jszip'
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL_APP = /const URL_APP = '([^']+)'/.exec(readFileSync(join(root, 'scripts/progress-slides.mjs'), 'utf8'))[1]
const zip = await JSZip.loadAsync(readFileSync(join(root, 'print/siit-map-progress-2026-11-13.pptx')))
let bad = 0
const ok = (m) => console.log(`ok  ${m}`)
const fail = (m) => { bad++; console.log(`BAD ${m}`) }
const text = (p) => zip.file(p).async('string')

const pres = await text('ppt/presentation.xml')
const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres)
const files = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)))
files.length === 7 ? ok('7 slides') : fail(`${files.length} slides`)
sz && Math.abs(Number(sz[1]) / Number(sz[2]) - 16 / 9) < 0.002 ? ok('16:9') : fail('not 16:9')

let small = 0
let runsTotal = 0
let qrPic = null
for (const f of files) {
  const n = Number(f.match(/\d+/))
  const xml = await text(f)
  if (/<a:(outerShdw|innerShdw|glow|softEdge|reflection)\b/.test(xml)) fail(`slide ${n}: effect found`)
  if (/[฀-๿]/.test(xml)) fail(`slide ${n}: Thai text found`)
  for (const sp of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
    const isFooter = /name="Footer"|type="sldNum"|Slide Number/.test(sp[0]) || /<a:fld /.test(sp[0])
    for (const r of sp[0].matchAll(/<a:r>[\s\S]*?<\/a:r>/g)) {
      runsTotal++
      const s = Number(/sz="(\d+)"/.exec(r[0])?.[1] ?? 0)
      if (!isFooter && s < 1800) { small++; fail(`slide ${n}: ${s / 100} pt run "${/<a:t>([^<]*)/.exec(r[0])?.[1]}"`) }
    }
  }
  for (const m of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) if (/descr="QR code/.test(m[0])) qrPic = { n, emb: /r:embed="([^"]+)"/.exec(m[0])[1] }
}
small === 0 ? ok(`${runsTotal} text runs, all body text 18 pt or more`) : fail(`${small} small runs`)

const fontNames = new Set()
for (const f of Object.keys(zip.files).filter((x) => /^ppt\/(slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml$/.test(x))) {
  for (const m of (await text(f)).matchAll(/typeface="([^"]*)"/g)) if (m[1] && !m[1].startsWith('+')) fontNames.add(m[1])
}
const extra = [...fontNames].filter((x) => x !== 'Kanit' && x !== 'IBM Plex Sans Thai')
extra.length === 0 ? ok(`fonts: ${[...fontNames].join(', ')}`) : fail(`other fonts: ${extra.join(', ')}`)

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
if (!qrPic) fail('no QR picture')
else {
  const rels = await text(`ppt/slides/_rels/slide${qrPic.n}.xml.rels`)
  const target = new RegExp(`Id="${qrPic.emb}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${qrPic.emb}"`).exec(rels)
  const buf = await zip.file((target[1] ?? target[2]).replace('../', 'ppt/')).async('nodebuffer')
  const got = await decode(buf.toString('base64'))
  got === URL_APP ? ok(`QR (embedded PNG, slide ${qrPic.n}) decodes to ${got}`) : fail(`QR decoded ${got}`)
}
const PX = 144
const m = 0.2 * PX
const png = readFileSync(join(root, 'print/progress-preview/slide-07.png')).toString('base64')
const got = await decode(png, [8.4 * PX - m, 1.9 * PX - m, 3.6 * PX + 2 * m, 3.6 * PX + 2 * m])
got === URL_APP ? ok('QR in the slide 7 thumbnail decodes') : fail(`thumbnail QR decoded ${got}`)
await browser.close()

const twin = JSON.parse(readFileSync(join(root, 'print/progress-preview/twin-check.json'), 'utf8'))
const issues = twin.overflow.length + twin.outside.length + twin.overlap.length
issues === 0 ? ok('layout twin: no overflow, nothing outside the frame, no overlapping text') : fail([...twin.overflow, ...twin.outside, ...twin.overlap].join('; '))
console.log(bad ? `${bad} problem(s)` : 'all checks passed')
process.exit(bad ? 1 : 0)
