// Printable QR signs: npm run qr-sheet  ->  print/qr-sheet.html (git-ignored).
// Open it in a browser and print on A4, two A5 signs per page. Only real QR points are printed (never `sample`),
// ordered by floor, then id. Ink on white only. Needs no network: the fonts are embedded.
//   QR_BASE=https://example.org/siit-map/ npm run qr-sheet     (another address, for a test)
import qrcode from 'qrcode-generator'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.env.QR_BASE ?? 'https://ryusakichan.github.io/siit-map/').replace(/\/?$/, '/')
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))
// The group name comes from the one config value the app also uses.
// While it is still the placeholder, the signs print [GROUP NAME].
const PLACEHOLDER = 'TU100 student group'
const configured = /groupName:\s*'([^']*)'/.exec(readFileSync(join(root, 'src/config.ts'), 'utf8'))?.[1]
const groupName = configured && configured !== PLACEHOLDER ? configured : '[GROUP NAME]'
if (configured === undefined) console.warn("warning: could not read groupName from src/config.ts (expected groupName: '...'), printing [GROUP NAME]")

const points = data.qrPoints.filter((q) => !q.sample).sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One QR code as a single-path SVG with a 4-module quiet zone, error correction M. */
function qrSvg(url) {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`
  const size = n + quiet * 2
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}

const font = (pkg, file, family, weight, range) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');${range ? `unicode-range:${range};` : ''}}`
}
const fonts = [
  font('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2', 'Plex', 400),
  font('ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2', 'Plex', 600),
  font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-thai-400-normal.woff2', 'Plex', 400, 'U+0E01-0E5B,U+200B-200D,U+25CC'),
  font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-thai-600-normal.woff2', 'Plex', 600, 'U+0E01-0E5B,U+200B-200D,U+25CC'),
  font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2', 'PlexMono', 500),
].join('\n')

const sign = (q) => {
  const url = `${base}#/at/${q.id}`
  return `<section class="sign" data-id="${esc(q.id)}">
  <i class="mark tl"></i><i class="mark tr"></i><i class="mark bl"></i><i class="mark br"></i>
  <h1>You are here <span>· คุณอยู่ที่นี่</span></h1>
  ${qrSvg(url)}
  <p class="scan">Scan for the SIIT Main Building map <span>· สแกนเพื่อดูแผนที่อาคารหลัก SIIT</span></p>
  <p class="place"><b>Floor ${q.floor} · ${esc(q.label)}</b><br><b lang="th">ชั้น ${q.floor} · ${esc(q.labelTh)}</b></p>
  <p class="foot">${esc(groupName)} · TU100 student project, SIIT, Thammasat University · Not an official SIIT service</p>
  <code class="id">${esc(q.id)}</code>
</section>`
}

const pages = []
for (let i = 0; i < points.length; i += 2) pages.push(`<div class="page">${points.slice(i, i + 2).map(sign).join('\n')}</div>`)

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIIT Map QR signs</title>
<style>
${fonts}
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #000; font-family: 'Plex', system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; position: relative; break-after: page; page-break-after: always; overflow: hidden; }
.page:last-child { break-after: auto; page-break-after: auto; }
.sign { position: relative; width: 210mm; height: 148.5mm; padding: 9mm 14mm 7mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
/* the cut line between the two signs, and corner marks for the cut */
.sign + .sign { border-top: 0.3mm dashed #000; }
.mark { position: absolute; width: 4mm; height: 4mm; border: 0 solid #000; }
.tl { left: 4mm; top: 4mm; border-width: 0.3mm 0 0 0.3mm; } .tr { right: 4mm; top: 4mm; border-width: 0.3mm 0.3mm 0 0; }
.bl { left: 4mm; bottom: 4mm; border-width: 0 0 0.3mm 0.3mm; } .br { right: 4mm; bottom: 4mm; border-width: 0 0.3mm 0.3mm 0; }
h1 { margin: 0; font-size: 26pt; line-height: 1.15; font-weight: 600; }
h1 span { font-weight: 400; }
.qr { width: 76mm; height: 76mm; margin: 3mm 0 2mm; display: block; }
.scan { margin: 0; font-size: 11pt; line-height: 1.3; }
.place { margin: 2mm 0 0; font-size: 14pt; line-height: 1.3; }
.foot { position: absolute; left: 14mm; right: 34mm; bottom: 7mm; margin: 0; font-size: 6.5pt; line-height: 1.3; text-align: left; }
.id { position: absolute; right: 9mm; bottom: 7mm; font-family: 'PlexMono', ui-monospace, monospace; font-weight: 500; font-size: 8pt; }
@media screen { body { background: #ddd; } .page { margin: 8mm auto; background: #fff; box-shadow: 0 0 0 1px #999; } }
</style>
</head>
<body>
${pages.join('\n')}
</body>
</html>
`

mkdirSync(join(root, 'print'), { recursive: true })
writeFileSync(join(root, 'print/qr-sheet.html'), html)
console.log(`print/qr-sheet.html: ${points.length} signs on ${pages.length} pages, linking to ${base}#/at/<id>`)
