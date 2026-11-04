// Exhibition booth poster: npm run booth-poster  ->  print/booth-poster.html (git-ignored), one page, A3 portrait by default (owner, 2026-11-04).
// Same visual language as the QR posters (scripts/qr-poster.mjs, shared helpers in scripts/poster-kit.mjs): pink frame
// with an ink edge, a lilac dot-grid band with a ruler edge, graph-paper body, ink title with a lilac 3D extrusion,
// white cards with legend-style swatches, scan-framed QR codes, the 3D map's floor stack with a pin, a dashed route.
// The page is drawn on an A1 grid in mm and scaled to the paper, so PAPER=A2 or PAPER=A1 prints the same design larger.
// Counts in "What we did" are computed from src/data/building.json at build time. Needs no network (fonts embedded).
// Check it with: npm run booth-poster:check
//   PAPER=A1 npm run booth-poster     (or A2)
//   KPI_VISITORS=120 KPI_FOUND=86 KPI_EASE=4.5 npm run booth-poster
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, esc, qrPaths, pin, block, mark, scanFrame, floorStack, fonts } from './poster-kit.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))
const PLACEHOLDER = 'TU100 student group'
const configured = /groupName:\s*'([^']*)'/.exec(readFileSync(join(root, 'src/config.ts'), 'utf8'))?.[1]
const groupName = configured && configured !== PLACEHOLDER ? configured : '[GROUP NAME]'
if (configured === undefined) console.warn("warning: could not read groupName from src/config.ts (expected groupName: '...'), printing [GROUP NAME]")

const URL_APP = 'https://ryusakichan.github.io/siit-map/'
const URL_SURVEY = 'https://docs.google.com/forms/d/e/1FAIpQLSeAIzBy1H_33zBJu2uWek_YheISU3mOJwCIbZPcMteqrJlzEw/viewform'
const SIZES = { A1: { name: 'A1', w: 594, h: 841 }, A2: { name: 'A2', w: 420, h: 594 }, A3: { name: 'A3', w: 297, h: 420 } }
const PAPER = SIZES[(process.env.PAPER ?? 'A3').toUpperCase()] ?? SIZES.A3
const kpiValue = { visitors: (process.env.KPI_VISITORS ?? '').trim(), found: (process.env.KPI_FOUND ?? '').trim(), ease: (process.env.KPI_EASE ?? '').trim() }

// Numbers come from the data, never typed by hand. Rooms exclude lifts and stairs.
const tracedFloors = data.floors.filter((f) => f.traced).length
const roomCount = data.rooms.filter((r) => !r.sample && r.type !== 'stairs' && r.type !== 'elevator').length
const qrCount = data.qrPoints.filter((q) => !q.sample).length
const topFloor = Math.max(...data.floors.map((f) => f.level))

const W = 594
const H = 841
const M = 20
const FRAME = 12
const ix = M + FRAME
const iy = M + FRAME
const iw = W - 2 * (M + FRAME)
const ih = H - 2 * (M + FRAME)
const bandBottom = 188
const PAD = 14
const cx0 = ix + PAD
const cw = iw - 2 * PAD // 502
const colWL = Number(process.env.CWL ?? 267) // left column: the problem text is long
const colWR = cw - 14 - colWL

const bullets = (items, color) =>
  `<ul>${items.map(([en, th]) => `<li style="--sw:${color}"><i></i><div><b>${esc(en)}</b><span>${esc(th)}</span></div></li>`).join('')}</ul>`

const solution = [
  ['Opens on any phone, no install', 'เปิดบนมือถือได้เลย ไม่ต้องโหลดแอป'],
  ['Search by room name, number or department', 'ค้นหาห้องจากชื่อ เลขห้อง หรือหน่วยงาน'],
  ['Directions across floors, by lift or stairs', 'บอกทางข้ามชั้น จะขึ้นลิฟต์หรือบันไดก็ได้'],
  ['Scan a QR poster to see where you are', 'สแกน QR บนโปสเตอร์ แล้วรู้เลยว่าอยู่ตรงไหน'],
  ['Ask assistant for questions about the building', 'มีผู้ช่วยให้ถามเรื่องในตึกได้'],
  ['English and Thai', 'ใช้ได้ทั้งภาษาไทยและอังกฤษ'],
]
const did = [
  ['Walked and photographed every floor', 'เดินสำรวจและถ่ายรูปตึกครบทุกชั้น'],
  [`Traced all ${tracedFloors} floors from the building's wall plans: ${roomCount} rooms`, `ทำแผนผังจริงครบ ${tracedFloors} ชั้นจากแผนผังในตึก รวม ${roomCount} ห้อง`],
  [`Made QR posters for ${qrCount} spots`, `ทำโปสเตอร์ QR ไว้ ${qrCount} จุด`],
  ['Built and launched the web app', 'สร้างเว็บแอปและเปิดให้ใช้จริงแล้ว'],
]
const kpis = [
  ['Visitors', 'คนที่เข้ามาใช้', kpiValue.visitors],
  ['Survey: found the place', 'หาที่ที่ต้องการเจอ (%)', kpiValue.found],
  ['Ease of use', 'ใช้ง่ายแค่ไหน (1⁠–⁠5)', kpiValue.ease],
]
const kpiHtml = kpis
  .map(([en, th, v]) => `<div class="kpi"><div class="kl"><b>${esc(en)}</b><span>${esc(th)}</span></div><div class="kv">${esc(v)}</div></div>`)
  .join('')

const card = (cls, title, body) => `<section class="card ${cls}"><h2>${esc(title)}</h2>${body}</section>`
const colLeft =
  card('c1', 'The problem · ปัญหา', `<div class="p"><b>A map on the wall can't walk with you. The Main Building's only maps are flat 2D fire-exit plans: hard to read, stuck in one spot, and no help once you walk away. There is no floor plan or room list online either. Your phone goes everywhere you go, so the map should too.</b><span>แผนที่บนผนังเดินตามคุณไปไม่ได้ ในตึกหลัก SIIT มีแค่แผนผังทางหนีไฟแบบ 2D ที่อ่านยากและ<i class="nb">ติดอยู่กับที่</i> พอเดินออกมาแล้วก็ต้อง<i class="nb">จำทางเอาเอง</i> ออนไลน์ก็ยังไม่มีแผนผังหรือรายชื่อห้องให้ค้นเลย แต่มือถือ<i class="nb">อยู่กับคุณทุกที่</i> แผนที่ก็ควร<i class="nb">ไปกับคุณด้วย</i></span></div>`) +
  card('c3', 'What we did · สิ่งที่เราทำ', bullets(did, C.mint))
const colRight = card('c2', 'Our solution · ทางออกของเรา', bullets(solution, C.lilacDeep)) + card('c4', 'Results & impact · ผลที่ได้', kpiHtml)

// Layout of the two columns. Left: problem, what we did, results. Right: solution, then the QR codes below.
const colTop = 254
const colBottom = 654

function qrBlock(url, x, y, size, enHead, thHead, id) {
  const { d, size: n } = qrPaths(url)
  const padc = 3
  const card = size + 2 * padc
  return `<g data-qr="${id}">
  <rect x="${x + 1.8}" y="${y + 2.2}" width="${card}" height="${card}" rx="4" fill="${C.lilacDeep}"/>
  <rect x="${x}" y="${y}" width="${card}" height="${card}" rx="4" fill="#fff" stroke="${C.ink}" stroke-width="0.9"/>
  <svg x="${x + padc}" y="${y + padc}" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>
  ${scanFrame(x, y, card, card, 3.6, 14)}
  <foreignObject x="${x + card + 12}" y="${y + card / 2 - 30}" width="100" height="60"><div xmlns="http://www.w3.org/1999/xhtml" class="cap"><b>${esc(enHead)}</b><span>${esc(thHead)}</span></div></foreignObject>
</g>`
}

const QR = 121
const qrCard = QR + 6
const qrY = 662

// Floor stack hero, scaled up from the QR poster's, with a pin on the top floor.
const stackX = 396
const stackY = 62
const stackK = 3.9

let ticks = ''
for (let x = ix + 6; x < ix + iw - 3; x += 4) ticks += `M${x} ${bandBottom}v${(x - ix - 6) % 20 === 0 ? -5.2 : -2.4}`
const route = `M40 114C34 190 46 300 40 420S34 640 40 ${qrY + qrCard / 2 - 30}C40 ${qrY + qrCard / 2 - 10} 42 ${qrY + qrCard / 2} 48 ${qrY + qrCard / 2}`

const svg = `<svg class="poster" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PAPER.w}mm" height="${PAPER.h}mm">
  <defs>
    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="0.9" fill="${C.lilacDot}" fill-opacity="0.75"/></pattern>
    <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0V5H0" fill="none" stroke="${C.rule}" stroke-width="0.3"/></pattern>
    <clipPath id="inner"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="9"/></clipPath>
  </defs>
  <rect x="${M}" y="${M}" width="${W - 2 * M}" height="${H - 2 * M}" rx="16" fill="${C.pink}" stroke="${C.ink}" stroke-width="1.2"/>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="9" fill="${C.paper}" stroke="${C.ink}" stroke-width="0.9"/>
  <g clip-path="url(#inner)">
    <rect x="${ix}" y="${bandBottom}" width="${iw}" height="${H}" fill="url(#grid)"/>
    <rect x="${ix}" y="${iy}" width="${iw}" height="${bandBottom - iy}" fill="${C.lilac}"/>
    <rect x="${ix}" y="${iy}" width="${iw}" height="${bandBottom - iy}" fill="url(#dots)"/>
    <path d="M${ix} ${bandBottom}H${ix + iw}" stroke="${C.ink}" stroke-width="0.9"/>
    <path d="${ticks}" stroke="${C.ink}" stroke-width="0.5"/>
  </g>

  <!-- Band doodles: room blocks and markers. -->
  ${block(318, 56, 8, C.butter)}${block(334, 63, 5.4, C.mint)}
  ${block(236, 150, 6, C.sky)}${block(247, 156, 4, C.pinkSoft)}
  ${mark(372, 128, 3.6)}${mark(300, 46, 2.8, C.ink)}${mark(384, 52, 2.4, C.ink)}

  <!-- Title: ink letters pushed up in 3D, like the floors on the map. -->
  ${[6, 5, 4, 3, 2, 1].map((i) => `<text x="${cx0 + 10 + i * 0.85}" y="${96 + i * 0.85}" class="title" font-family="Kanit" font-weight="800" font-size="70" fill="${i === 6 ? C.ink : C.lilacDeep}">SIIT Map</text>`).join('')}
  <text x="${cx0 + 10}" y="96" class="title" font-family="Kanit" font-weight="800" font-size="70" fill="${C.ink}">SIIT Map</text>
  <text x="${cx0 + 10}" y="119" class="sub" font-family="Kanit" font-weight="700" font-size="15" fill="${C.ink}">A 3D map of the SIIT Main Building</text>
  <text x="${cx0 + 10}" y="138" class="sub" font-family="Kanit" font-weight="500" font-size="14" fill="${C.ink}">แผนที่ 3D ของตึกหลัก SIIT</text>

  <!-- Hero: the building's floors, stacked like the 3D map, with the pin on the top floor. -->
  <g transform="translate(${stackX} ${stackY}) scale(${stackK})">${floorStack(topFloor, 0, 0, topFloor)}</g>
  ${pin(stackX + 14 * stackK, stackY + 4 * stackK - 3, 8, 0, 3)}

  <!-- Walking route down the margin to the first QR code. -->
  <path d="${route}" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>
  <path d="${route}" fill="none" stroke="${C.pink}" stroke-width="2" stroke-dasharray="5 3.6" stroke-linecap="round"/>
  <path d="M${cx0 - 1} ${qrY + qrCard / 2 - 4.5}L${cx0 + 5} ${qrY + qrCard / 2}L${cx0 - 1} ${qrY + qrCard / 2 + 4.5}Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.7" stroke-linejoin="round"/>
  ${pin(40, 104, 7, 0, 3)}

  <!-- Words: tagline, group line, the cards (HTML inside the page grid so Thai wraps properly). -->
  <foreignObject x="${cx0}" y="148" width="335" height="36"><div xmlns="http://www.w3.org/1999/xhtml" class="group"><div class="gn">${esc(groupName)}</div></div></foreignObject>
  <foreignObject x="${cx0}" y="198" width="${cw}" height="54"><div xmlns="http://www.w3.org/1999/xhtml" class="tag fit"><b>Find any room, office or facility from your phone. No app to install.</b><span>หาห้องเรียน ออฟฟิศ หรือห้องน้ำในตึกหลัก SIIT ได้จากมือถือ <i class="nb">ไม่ต้องโหลดแอป</i></span></div></foreignObject>
  <foreignObject x="${cx0}" y="${colTop}" width="${cw}" height="${colBottom - colTop}"><div xmlns="http://www.w3.org/1999/xhtml" class="cols fit"><div class="col" style="width:${colWL}px">${colLeft}</div><div class="col" style="width:${colWR}px">${colRight}</div></div></foreignObject>

  <!-- QR codes in scan frames. -->
  ${qrBlock(URL_APP, cx0 + 8, qrY, QR, 'Try SIIT Map', 'ลองใช้ SIIT Map', 'app')}
  ${qrBlock(URL_SURVEY, cx0 + 8 + 252, qrY, QR, 'Answer our survey', 'ตอบแบบสำรวจ', 'survey')}

  <text class="foot" x="${W / 2}" y="${iy + ih - 7}" text-anchor="middle" font-family="Plex" font-weight="500" font-size="6.2" fill="${C.ink}">TU100 student project, SIIT, Thammasat University · Not an official SIIT service · Building outline © OpenStreetMap contributors</text>
</svg>`

const css = `${fonts}
@page { size: ${PAPER.w}mm ${PAPER.h}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${PAPER.w}mm; height: ${PAPER.h}mm; overflow: hidden; }
.poster { display: block; }
@media screen { body { background: #ccc; } .page { margin: 8mm auto; background: #fff; box-shadow: 0 0 0 1px #999; } }
.fit { font-size: 12px; color: ${C.ink}; font-family: Plex, Kanit, sans-serif; }
.group { background: #fff; border: 0.9px solid ${C.ink}; border-radius: 6px; padding: 3px 9px; height: 100%; font-family: Kanit, Plex, sans-serif; color: ${C.ink}; box-shadow: 1.6px 2px 0 ${C.lilacDeep}; display: flex; flex-direction: column; justify-content: center; font-size: 11px; line-height: 1.25; }
.gn { font-weight: 800; font-size: 1.25em; white-space: nowrap; overflow: hidden; }
.gm { display: flex; gap: 8px; align-items: flex-end; font-weight: 700; }
.gm b { white-space: nowrap; font-weight: 700; }
.wl { flex: 1; border-bottom: 1px solid ${C.ink}; min-height: 1.1em; font-weight: 500; white-space: nowrap; overflow: hidden; }
.tag { height: 100%; line-height: 1.32; }
.nb { font-style: normal; white-space: nowrap; }
.card h2 { white-space: nowrap; }
.tag b { display: block; font-weight: 600; font-size: 1.12em; }
.tag span { display: block; font-weight: 500; font-size: 1.04em; margin-top: 2px; }
.cols { display: flex; gap: 14px; height: 100%; align-items: stretch; }
.col { display: flex; flex-direction: column; gap: 7px; height: 100%; }
.card { background: #fff; border: 0.9px solid ${C.ink}; border-radius: 6px; box-shadow: 1.8px 2.2px 0 ${C.lilacDeep}; display: flex; flex-direction: column; flex: auto; flex-shrink: 0; }
.card h2 { margin: 0; font-family: Kanit, Plex, sans-serif; font-weight: 700; font-size: 1.42em; line-height: 1.25; padding: 0.18em 0.6em; border-radius: 5px 5px 0 0; border-bottom: 0.9px solid ${C.ink}; }
.c1 h2 { background: ${C.pinkSoft}; } .c2 h2 { background: ${C.lilac}; } .c3 h2 { background: ${C.mint}; } .c4 h2 { background: ${C.butter}; }
.card b, .card span { display: block; }
.card b { font-weight: 600; } .card span { font-weight: 500; }
.p { font-size: 1.14em; padding: 0.4em 0.75em; line-height: 1.28; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.35em; }
ul { list-style: none; margin: 0; padding: 0.3em 0.75em; display: flex; flex-direction: column; flex: 1; justify-content: space-around; gap: 0.3em; }
li { display: flex; gap: 0.6em; align-items: flex-start; line-height: 1.2; }
li i { flex: none; width: 0.62em; height: 0.62em; margin-top: 0.34em; background: var(--sw); border: 0.7px solid ${C.ink}; border-radius: 1.4px; }
li span { color: ${C.ink}; }
.kpi { display: flex; gap: 0.6em; align-items: stretch; padding: 0.3em 0.75em; flex: 1; }
.kpi + .kpi { border-top: 0.6px dashed ${C.lilacDot}; }
.kl { flex: 1; align-self: center; line-height: 1.28; }
.cap { font-family: Kanit, Plex, sans-serif; color: ${C.ink}; line-height: 1.2; height: 100%; display: flex; flex-direction: column; justify-content: center; } .cap b { font-weight: 800; font-size: 15px; } .cap span { font-weight: 700; font-size: 13.5px; margin-top: 3px; color: ${C.muted}; }
.kv { flex: none; width: 6.4em; min-height: 2.3em; border: 1.2px dashed ${C.ink}; border-radius: 4px; background: #FBF8FE; display: flex; align-items: center; justify-content: center; font-family: Kanit, sans-serif; font-weight: 800; font-size: 1.5em; color: ${C.ink}; }`

// Runs in the browser once the fonts load: shrinks text blocks that would overflow their boxes, then flags readiness.
const fit = `document.fonts.ready.then(() => {
  const shrinkText = (el, max) => { let s = parseFloat(el.getAttribute('font-size')); while (el.getComputedTextLength() > max && s > 3) { s -= 0.2; el.setAttribute('font-size', s.toFixed(1)) } }
  for (const el of document.querySelectorAll('.title')) shrinkText(el, 330)
  for (const el of document.querySelectorAll('.sub')) shrinkText(el, 318)
  for (const el of document.querySelectorAll('.foot')) shrinkText(el, 500)
  // HTML blocks: start from the design size, step down until nothing overflows (cols: per-column).
  const over = (el) => el.scrollHeight > el.clientHeight + 0.5
  for (const h of document.querySelectorAll('.card h2')) { let f = 1.42; while (h.scrollWidth > h.clientWidth && f > 1) { f -= 0.02; h.style.fontSize = f.toFixed(2) + 'em' } }
  for (const el of document.querySelectorAll('.tag')) { let s = 12.4; el.style.fontSize = s + 'px'; while ((over(el) || el.scrollWidth > el.clientWidth) && s > 9) { s -= 0.2; el.style.fontSize = s.toFixed(1) + 'px' } }
  const cols = document.querySelector('.cols')
  let s = 13.2
  const bad = () => [...cols.querySelectorAll('.col')].some((c) => c.scrollHeight > c.clientHeight + 0.5 || [...c.querySelectorAll('.card')].some((k) => k.scrollHeight > k.clientHeight + 0.5))
  cols.style.fontSize = s + 'px'
  while (bad() && s > 8) { s -= 0.2; cols.style.fontSize = s.toFixed(1) + 'px' }
  document.documentElement.dataset.bodySize = s.toFixed(1)
  const g = document.querySelector('.group'); let gs = 11
  while ((g.scrollHeight > g.clientHeight + 0.5 || g.scrollWidth > g.clientWidth + 0.5) && gs > 6) { gs -= 0.2; g.style.fontSize = gs.toFixed(1) + 'px' }
  document.documentElement.dataset.ready = '1'
})`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIIT Map booth poster</title>
<style>
${css}
</style>
</head>
<body>
<section class="page" data-url-app="${esc(URL_APP)}" data-url-survey="${esc(URL_SURVEY)}">
${svg}
</section>
<script>${fit}</script>
</body>
</html>
`

mkdirSync(join(root, 'print'), { recursive: true })
writeFileSync(join(root, 'print/booth-poster.html'), html)
console.log(`print/booth-poster.html: ${PAPER.name} booth poster (${tracedFloors} floors, ${roomCount} rooms, ${qrCount} QR points)`)
