// Production QR posters: npm run qr-poster  ->  print/qr-posters.html (git-ignored), one poster per page, A3 by default.
// The poster is drawn as the board the 3D map shows for a scanned point (white card, pink frame, pink dot at the
// bottom), dressed in the map's own style: a lilac dot-grid map tile with a ruler edge, this floor as a
// small map card with a pin on the spot, room blocks, a walking route, a scan frame and legend chips on graph paper.
// All key text is ink, so it still reads on a black-and-white printer. Only real QR points are printed.
// Needs no network: the fonts are embedded. Check it with: npm run qr-poster:check
//   PAPER=A4 npm run qr-poster     (A4 instead; the design scales evenly, A sizes share one shape)
//   QR_BASE=https://example.org/siit-map/ npm run qr-poster     (another address, for a test)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, esc, qrPaths, pin, block, mark, chip, scanFrame, miniMap as miniMapOf, floorStack as floorStackOf, fonts, fitPills } from './poster-kit.mjs'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.env.QR_BASE ?? 'https://ryusakichan.github.io/siit-map/').replace(/\/?$/, '/')
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))
const PLACEHOLDER = 'TU100 student group'
const configured = /groupName:\s*'([^']*)'/.exec(readFileSync(join(root, 'src/config.ts'), 'utf8'))?.[1]
const groupName = configured && configured !== PLACEHOLDER ? configured : '[GROUP NAME]'
if (configured === undefined) console.warn("warning: could not read groupName from src/config.ts (expected groupName: '...'), printing [GROUP NAME]")

const points = data.qrPoints.filter((q) => !q.sample).sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id))
const floors = data.floors.map((f) => f.level ?? f.floor ?? f.number).filter((n) => typeof n === 'number')
const topFloor = floors.length ? Math.max(...floors) : 5
// The page is drawn on an A4 grid in mm and scaled to the paper: A3 is the A4 design at 1.414x.
const PAPER = (process.env.PAPER ?? 'A3').toUpperCase() === 'A4' ? { name: 'A4', w: 210, h: 297 } : { name: 'A3', w: 297, h: 420 }

const miniMap = (q, x, y, w, h, rot) => miniMapOf(data, q, x, y, w, h, rot)
const floorStack = (x, y, here) => floorStackOf(topFloor, x, y, here)


// The A4 design grid in mm. The board: a white card in a pink frame, 7 mm in from the edge (safe for office printers).
const W = 210
const H = 297
const M = 7
const FRAME = 4.2

function poster(q) {
  const url = `${base}#/at/${q.id}`
  const { d: qd, size } = qrPaths(url)
  const bx = M
  const by = M
  const bw = W - 2 * M
  const bh = H - 2 * M
  const ix = bx + FRAME
  const iy = by + FRAME
  const iw = bw - 2 * FRAME
  const bandBottom = 86

  // QR card.
  const card = 122
  const cx = (W - card) / 2
  const cy = 98
  const qrSize = 110

  // Ruler ticks along the band's lower edge, every 2 mm with a longer one every 10 mm.
  let ticks = ''
  for (let x = ix + 4; x < ix + iw - 2; x += 2) ticks += `M${x} ${bandBottom}v${(x - ix - 4) % 10 === 0 ? -2.6 : -1.2}`
  // The walking route: from the title pin down the margin to the QR code.
  const route = `M17 54C13 80 12 108 16 130S28 156 ${cx - 7} 158`

  return `<section class="page" data-id="${esc(q.id)}" data-url="${esc(url)}">
<svg class="poster" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PAPER.w}mm" height="${PAPER.h}mm">
  <defs>
    <pattern id="dots-${q.id}" width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.42" fill="${C.lilacDot}" fill-opacity="0.75"/>
    </pattern>
    <pattern id="grid-${q.id}" width="5" height="5" patternUnits="userSpaceOnUse">
      <path d="M5 0V5H0" fill="none" stroke="${C.rule}" stroke-width="0.3"/>
    </pattern>
    <clipPath id="inner-${q.id}"><rect x="${ix}" y="${iy}" width="${iw}" height="${bh - 2 * FRAME}" rx="5"/></clipPath>
  </defs>

  <!-- The board: ink edge, pink frame, floor-plan graph paper. -->
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="9" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.7"/>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${bh - 2 * FRAME}" rx="5" fill="${C.paper}" stroke="${C.ink}" stroke-width="0.5"/>
  <g clip-path="url(#inner-${q.id})">
    <rect x="${ix}" y="${bandBottom}" width="${iw}" height="${H}" fill="url(#grid-${q.id})"/>
    <!-- Lilac map tile: dot grid, the building outline, a ruler edge. -->
    <rect x="${ix}" y="${iy}" width="${iw}" height="${bandBottom - iy}" fill="${C.lilac}"/>
    <rect x="${ix}" y="${iy}" width="${iw}" height="${bandBottom - iy}" fill="url(#dots-${q.id})"/>
    <path d="M${ix} ${bandBottom}H${ix + iw}" stroke="${C.ink}" stroke-width="0.5"/>
    <path d="${ticks}" stroke="${C.ink}" stroke-width="0.3"/>
  </g>

  <!-- Map doodles in the band: room blocks and markers. -->
  <g>${block(30, 23, 5.2, C.butter)}${block(40.4, 27.4, 3.6, C.mint)}</g>
  <g>${block(170, 21, 4.4, C.sky)}${block(178.8, 25.2, 3, C.pinkSoft)}</g>
  ${mark(110, 66, 2.4)}
  ${mark(96, 20, 1.8, C.ink)}
  ${mark(130, 74, 1.6, C.ink)}

  <!-- Title: ink letters pushed up in 3D, like the floors on the map. -->
  ${[6, 5, 4, 3, 2, 1].map((i) => `<text x="${29 + i * 0.28}" y="${52 + i * 0.28}" class="title" font-family="Kanit" font-weight="800" font-size="23" fill="${i === 6 ? C.ink : C.lilacDeep}">YOU ARE HERE</text>`).join('')}
  <text x="29" y="52" class="title" font-family="Kanit" font-weight="800" font-size="23" fill="${C.ink}">YOU ARE HERE</text>
  <!-- The walking route from the pin to the code. -->
  <path d="${route}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
  <path d="${route}" fill="none" stroke="${C.pink}" stroke-width="1.1" stroke-dasharray="2.4 1.8" stroke-linecap="round"/>
  <path d="M${cx - 7.5} 154.6L${cx - 2.6} 158L${cx - 7.5} 161.4Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.4" stroke-linejoin="round"/>
  ${pin(17, 44, 6.2, 0)}
  <!-- Thai title as a map callout pointing at the pin. -->
  <rect class="th-pill" x="26" y="60" width="60" height="15" rx="2.4" fill="${C.pinkSoft}" stroke="${C.ink}" stroke-width="0.7"/>
  <path d="M26.4 63.4L21.6 60.2L26.4 67.4" fill="${C.pinkSoft}" stroke="${C.ink}" stroke-width="0.7" stroke-linejoin="round"/>
  <path d="M26.4 63.6V67.2" stroke="${C.pinkSoft}" stroke-width="0.9"/>
  <text class="th-title" x="31" y="71.4" font-family="Kanit" font-weight="700" font-size="10" fill="${C.ink}">คุณอยู่ที่นี่</text>
  <!-- This floor, with the pin on this poster's spot. -->
  ${miniMap(q, 146, 55, 40, 36, 2.5)}

  <!-- QR card in a scan frame. Nothing overlaps the code or its quiet zone. -->
  <rect x="${cx + 1.6}" y="${cy + 2}" width="${card}" height="${card}" rx="4" fill="${C.lilacDeep}"/>
  <rect x="${cx}" y="${cy}" width="${card}" height="${card}" rx="4" fill="#fff" stroke="${C.ink}" stroke-width="0.8"/>
  <svg x="${(W - qrSize) / 2}" y="${cy + (card - qrSize) / 2}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#fff"/><path d="${qd}" fill="#000"/>
  </svg>
  ${scanFrame(cx, cy, card, card, 3.4, 9)}

  <!-- Legend chips that say what the map does. They sit on the card's top and bottom edges, outside the quiet zone. -->
  ${chip(cx + 9, cy - 0.6, 'Find any room', 'หาห้อง', 0, C.lilac)}
  ${chip(cx + 9, cy + card + 0.6, 'Lift or stairs', 'ลิฟต์หรือบันได', 0, C.lilacDeep)}
  <g class="end">${chip(cx + card - 9, cy - 0.6, 'Ask a question', 'ถามได้เลย', 0, C.pink)}</g>
  <g>${block(176, cy + 90, 4, C.mint)}</g>
  ${mark(28, cy + 22, 2.2, C.ink)}
  ${pin(186, cy + 34, 3, 8, 1.6)}

  <!-- Call to action. -->
  <text class="cta" x="${W / 2}" y="${cy + card + 15.5}" text-anchor="middle" font-family="Kanit" font-weight="700" font-size="7.6" fill="${C.ink}">Scan for the building map <tspan fill="${C.muted}" font-weight="500">· สแกนดูแผนที่ตึก</tspan></text>

  <!-- Where this poster is. -->
  <g class="place">
    <rect x="22" y="239" width="166" height="32" rx="6" fill="#fff" stroke="${C.ink}" stroke-width="0.7"/>
    ${floorStack(29, 240.6, q.floor)}
    <text x="76" y="253" class="place-en" font-family="Kanit" font-weight="800" font-size="10" fill="${C.ink}">Floor ${q.floor} · ${esc(q.label)}</text>
    <text x="76" y="265" class="place-th" font-family="Kanit" font-weight="500" font-size="8.4" fill="${C.ink}">ชั้น ${q.floor} · ${esc(q.labelTh)}</text>
  </g>

  <!-- Footer and the id for whoever puts the poster up. -->
  <text class="foot" x="22" y="279.2" font-family="Plex" font-weight="500" font-size="2.9" fill="${C.ink}">${esc(groupName)} · TU100 student project, SIIT, Thammasat University · Not an official SIIT service</text>
  <text x="188" y="279.2" text-anchor="end" font-family="PlexMono" font-weight="500" font-size="3.2" fill="${C.ink}">${esc(q.id)}</text>
  <!-- The pink dot at the bottom centre, as on the 3D board. -->
  <circle cx="${W / 2}" cy="${iy + bh - 2 * FRAME - 3.2}" r="1.5" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.35"/>
</svg>
</section>`
}

// Runs in the browser once the fonts load: sizes pills to their text and shrinks any line that would overflow.
const fit = `document.fonts.ready.then(() => {
  ${fitPills}
  const shrink = (el, max) => { let s = parseFloat(el.getAttribute('font-size')); while (el.getComputedTextLength() > max && s > 3) { s -= 0.2; el.setAttribute('font-size', s.toFixed(1)) } }
  for (const el of document.querySelectorAll('.place-en, .place-th')) shrink(el, 106)
  for (const el of document.querySelectorAll('.foot')) shrink(el, 140)
  for (const el of document.querySelectorAll('.cta')) shrink(el, 170)
  document.documentElement.dataset.ready = '1'
})`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIIT Map QR posters</title>
<style>
${fonts}
@page { size: ${PAPER.name} portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${PAPER.w}mm; height: ${PAPER.h}mm; break-after: page; page-break-after: always; overflow: hidden; }
.page:last-child { break-after: auto; page-break-after: auto; }
.poster { display: block; }
@media screen { body { background: #ccc; } .page { margin: 8mm auto; background: #fff; box-shadow: 0 0 0 1px #999; } }
</style>
</head>
<body>
${points.map(poster).join('\n')}
<script>${fit}</script>
</body>
</html>
`

mkdirSync(join(root, 'print'), { recursive: true })
writeFileSync(join(root, 'print/qr-posters.html'), html)
console.log(`print/qr-posters.html: ${points.length} ${PAPER.name} posters, linking to ${base}#/at/<id>`)
