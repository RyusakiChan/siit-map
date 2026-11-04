// Intro poster: npm run intro-poster  ->  print/intro-poster.html (git-ignored), one page, A3 portrait by default (owner, 2026-11-04).
// The project at a glance: title, hook, a phone showing a real screenshot of the live app (npm run intro-phone-shot) with a walking route out of it, one big QR code.
// Same visual language as the other posters (shared helpers in scripts/poster-kit.mjs). Drawn on an A1 grid in mm, scaled to the
// paper, so PAPER=A2 or PAPER=A1 prints the same design larger. Needs no network (fonts embedded). Check it with: npm run intro-poster:check
//   PAPER=A1 npm run intro-poster     (or A2)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, esc, qrPaths, pin, block, mark, chip, scanFrame, floorStack, fonts, fitPills } from './poster-kit.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))
const PLACEHOLDER = 'TU100 student group'
const configured = /groupName:\s*'([^']*)'/.exec(readFileSync(join(root, 'src/config.ts'), 'utf8'))?.[1]
const groupName = configured && configured !== PLACEHOLDER ? configured : '[GROUP NAME]'
if (configured === undefined) console.warn("warning: could not read groupName from src/config.ts (expected groupName: '...'), printing [GROUP NAME]")

const URL_APP = 'https://ryusakichan.github.io/siit-map/'
const SIZES = { A1: { name: 'A1', w: 594, h: 841 }, A2: { name: 'A2', w: 420, h: 594 }, A3: { name: 'A3', w: 297, h: 420 } }
const PAPER = SIZES[(process.env.PAPER ?? 'A3').toUpperCase()] ?? SIZES.A3
const topFloor = Math.max(...data.floors.map((f) => f.level))
const shotPath = join(root, 'scripts/assets/intro-phone.png')
if (!existsSync(shotPath)) throw new Error('scripts/assets/intro-phone.png is missing: run `npm run intro-phone-shot` first (needs network)')
const shot = readFileSync(shotPath).toString('base64')

const W = 594
const H = 841
const M = 20
const FRAME = 12
const ix = M + FRAME
const iy = M + FRAME
const iw = W - 2 * (M + FRAME)
const ih = H - 2 * (M + FRAME)
const bandBottom = 200
const cx0 = ix + 14

// Phone: ink-edged rounded rectangle, speaker slot, screen showing the app screenshot (390x844, so the screen keeps that aspect).
const PX = 62
const PW = 150
const SW = PW - 18
const SH = (SW * 844) / 390
const PY = 220
const PH = SH + 29
const SX = PX + 9
const SY = PY + 20
// The route starts at the tip of the pink arrow on screen (about 63% across, 58% down the screenshot).
const p0 = { x: SX + SW * 0.633, y: SY + SH * 0.585 }
const p1 = { x: 505, y: 470 }
const dy = p0.y - 290
const route = `M${p0.x} ${p0.y}C${p0.x + 22} ${p0.y + 10} ${PX + PW + 8} ${p0.y + 12} ${PX + PW + 34} ${p0.y + 26}S320 ${290 + dy + 90} 360 ${290 + dy + 50}S410 ${300 + dy} 450 ${340 + dy * 0.6}S520 400 ${p1.x} ${p1.y - 14}`

const stackX = 396
const stackY = 62
const stackK = 3.9

const QR = 170
const qrCard = QR + 6
const qrX = cx0 + 8
const qrY = 552
const { d: qd, size: qn } = qrPaths(URL_APP)
const labelX = qrX + qrCard + 24
const labelW = ix + iw - 14 - labelX

let ticks = ''
for (let x = ix + 6; x < ix + iw - 3; x += 4) ticks += `M${x} ${bandBottom}v${(x - ix - 6) % 20 === 0 ? -5.2 : -2.4}`

const chips = [
  ['Find any room', 'หาห้อง', C.mint, 'search'],
  ['Lift or stairs', 'ลิฟต์หรือบันได', C.lilacDeep, 'stairs'],
  ['English and Thai', 'ไทยและอังกฤษ', C.butter, 'lang'],
]
const chipY = 760

const svg = `<svg class="poster" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${PAPER.w}mm" height="${PAPER.h}mm">
  <defs>
    <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="0.9" fill="${C.lilacDot}" fill-opacity="0.75"/></pattern>
    <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0V5H0" fill="none" stroke="${C.rule}" stroke-width="0.3"/></pattern>
    <clipPath id="screen"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="9"/></clipPath>
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

  <!-- Band: title, hook, sub, floor stack. -->
  ${block(318, 56, 8, C.butter)}${block(334, 63, 5.4, C.mint)}
  ${mark(372, 148, 3.6)}${mark(300, 46, 2.8, C.ink)}${mark(384, 52, 2.4, C.ink)}
  ${[6, 5, 4, 3, 2, 1].map((i) => `<text x="${cx0 + 10 + i * 0.85}" y="${96 + i * 0.85}" class="t" data-max="330" font-family="Kanit" font-weight="800" font-size="70" fill="${i === 6 ? C.ink : C.lilacDeep}">SIIT Map</text>`).join('')}
  <text x="${cx0 + 10}" y="96" class="t" data-max="330" font-family="Kanit" font-weight="800" font-size="70" fill="${C.ink}">SIIT Map</text>
  <text x="${cx0 + 10}" y="125" class="t" data-max="318" font-family="Kanit" font-weight="800" font-size="19" fill="${C.ink}">The building map that walks with you.</text>
  <text x="${cx0 + 10}" y="148" class="t" data-max="340" font-family="Kanit" font-weight="700" font-size="18" fill="${C.ink}">แผนที่ตึกที่เดินไปพร้อมกับคุณ</text>
  <text x="${cx0 + 10}" y="172" class="t" data-max="340" font-family="Kanit" font-weight="500" font-size="11.5" fill="${C.muted}">A 3D map of the SIIT Main Building, on your phone.</text>
  <text x="${cx0 + 10}" y="187" class="t" data-max="340" font-family="Kanit" font-weight="500" font-size="11" fill="${C.muted}">แผนที่ 3D ของตึกหลัก SIIT บนมือถือคุณ</text>
  <g transform="translate(${stackX} ${stackY}) scale(${stackK})">${floorStack(topFloor, 0, 0, topFloor)}</g>
  ${pin(stackX + 14 * stackK, stackY + 4 * stackK - 3, 8, 0, 3)}

  <!-- Hero: isometric room blocks, then the phone, then the route over both. -->
  ${block(262, 300, 22, C.butter)}${block(385, 478, 20, C.mint)}${block(430, 270, 18, C.sky)}${block(300, 505, 16, C.pinkSoft)}${block(470, 535, 14, C.lilac)}
  ${mark(268, 250, 4.2)}${mark(520, 250, 3.6, C.ink)}${mark(330, 340, 3, C.ink)}${mark(545, 400, 4)}${mark(280, 470, 3.4, C.ink)}
  <rect x="${PX + 2.6}" y="${PY + 3}" width="${PW}" height="${PH}" rx="20" fill="${C.lilacDeep}"/>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="20" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>
  <rect x="${PX + PW / 2 - 14}" y="${PY + 7}" width="28" height="4.4" rx="2.2" fill="${C.ink}"/>
  <image x="${SX}" y="${SY}" width="${SW}" height="${SH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen)" href="data:image/png;base64,${shot}"/>
  <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="9" fill="none" stroke="${C.ink}" stroke-width="0.7"/>
  <path d="${route}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <path d="${route}" fill="none" stroke="${C.pink}" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round"/>
  ${pin(p1.x, p1.y - 12, 11, 0, 4)}

  <!-- QR code in a scan frame, with its label and the group. -->
  <g data-qr="app">
    <rect x="${qrX + 2.4}" y="${qrY + 3}" width="${qrCard}" height="${qrCard}" rx="5" fill="${C.lilacDeep}"/>
    <rect x="${qrX}" y="${qrY}" width="${qrCard}" height="${qrCard}" rx="5" fill="#fff" stroke="${C.ink}" stroke-width="1.1"/>
    <svg x="${qrX + 3}" y="${qrY + 3}" width="${QR}" height="${QR}" viewBox="0 0 ${qn} ${qn}" shape-rendering="crispEdges"><rect width="${qn}" height="${qn}" fill="#fff"/><path d="${qd}" fill="#000"/></svg>
    ${scanFrame(qrX, qrY, qrCard, qrCard, 4.6, 20)}
  </g>
  <text class="t" data-max="${labelW}" x="${labelX}" y="${qrY + 40}" font-family="Kanit" font-weight="800" font-size="27" fill="${C.ink}">Scan to try <tspan font-weight="700" fill="${C.muted}">· สแกนเพื่อลองใช้</tspan></text>
  <path d="M${labelX} ${qrY + 54}h56" stroke="${C.pink}" stroke-width="3" stroke-linecap="round"/>
  <foreignObject x="${labelX}" y="${qrY + 112}" width="${labelW}" height="46"><div xmlns="http://www.w3.org/1999/xhtml" class="group"><div class="gn">${esc(groupName)}</div></div></foreignObject>

  <!-- Legend chips, large, laid out after the fonts load. -->
  <g class="chips" data-y="${chipY}" data-x0="${cx0}" data-x1="${cx0 + iw - 28}">${chips.map(([en, th, sw, ic]) => `<g class="cc">${chip(0, 0, en, th, 0, sw, ic)}</g>`).join('')}</g>

  <text class="t" data-max="500" x="${W / 2}" y="${iy + ih - 7}" text-anchor="middle" font-family="Plex" font-weight="500" font-size="6.2" fill="${C.ink}">TU100 student project, SIIT, Thammasat University · Not an official SIIT service · Building outline © OpenStreetMap contributors</text>
</svg>`

const css = `${fonts}
@page { size: ${PAPER.w}mm ${PAPER.h}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${PAPER.w}mm; height: ${PAPER.h}mm; overflow: hidden; }
.poster { display: block; }
@media screen { body { background: #ccc; } .page { margin: 8mm auto; background: #fff; box-shadow: 0 0 0 1px #999; } }
.group { background: #fff; border: 1.1px solid ${C.ink}; border-radius: 8px; padding: 4px 14px; height: 100%; font-family: Kanit, Plex, sans-serif; color: ${C.ink}; box-shadow: 2.4px 3px 0 ${C.lilacDeep}; display: flex; flex-direction: column; justify-content: center; font-size: 15px; line-height: 1.25; }
.gn { font-weight: 800; font-size: 1.5em; white-space: nowrap; overflow: hidden; }`

// Runs in the browser once the fonts load: shrinks text that is too wide (flagging any that shrank a lot), sizes and spreads the chips.
const fit = `document.fonts.ready.then(() => {
  let shrunk = 0
  for (const el of document.querySelectorAll('.t')) {
    const max = Number(el.dataset.max); const s0 = parseFloat(el.getAttribute('font-size')); let s = s0
    while (el.getComputedTextLength() > max && s > 3) { s -= 0.2; el.setAttribute('font-size', s.toFixed(1)) }
    if (s < s0 * 0.85) shrunk++
  }
  ${fitPills}
  const cg = document.querySelector('.chips'); const cc = [...cg.querySelectorAll('.cc')]
  const x0 = Number(cg.dataset.x0), x1 = Number(cg.dataset.x1), y = Number(cg.dataset.y)
  const ws = cc.map((c) => Number(c.querySelector('.pill-bg').getAttribute('width')))
  const sum = ws.reduce((a, b) => a + b, 0)
  const gap = 8
  const k = Math.min(3.2, (x1 - x0 - 2 * gap) / sum)
  let x = x0 + (x1 - x0 - (sum * k + 2 * gap)) / 2
  cc.forEach((c, i) => { c.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y + ') scale(' + k.toFixed(3) + ')'); x += ws[i] * k + gap })
  document.documentElement.dataset.chipScale = k.toFixed(2)
  document.documentElement.dataset.shrunk = String(shrunk)
  const g = document.querySelector('.group'); let gs = 15
  while ((g.scrollHeight > g.clientHeight + 0.5 || g.scrollWidth > g.clientWidth + 0.5) && gs > 6) { gs -= 0.2; g.style.fontSize = gs.toFixed(1) + 'px' }
  document.documentElement.dataset.ready = '1'
})`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SIIT Map intro poster</title>
<style>
${css}
</style>
</head>
<body>
<section class="page" data-url-app="${esc(URL_APP)}">
${svg}
</section>
<script>${fit}</script>
</body>
</html>
`

mkdirSync(join(root, 'print'), { recursive: true })
writeFileSync(join(root, 'print/intro-poster.html'), html)
console.log(`print/intro-poster.html: ${PAPER.name} intro poster`)
