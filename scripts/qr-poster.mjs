// Production QR posters: npm run qr-poster  ->  print/qr-posters.html (git-ignored), one A4 poster per page.
// The poster is drawn as the board the 3D map shows for a scanned point (white card, pink frame, pink dot at the
// bottom), dressed in a student scrapbook style: lilac halftone band, torn paper, stickers, tape and pill labels.
// All key text is ink, so it still reads on a black-and-white printer. Only real QR points are printed.
// Needs no network: the fonts are embedded. Check it with: npm run qr-poster:check
//   QR_BASE=https://example.org/siit-map/ npm run qr-poster     (another address, for a test)
import qrcode from 'qrcode-generator'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Pastel Mauve tokens (src/theme/colors.ts) plus the pastel room tints for the rainbow.
const C = {
  ink: '#1D161E',
  muted: '#594C5B',
  pink: '#F6339A', // youAreHere
  pinkSoft: '#FCCEE8', // actionFill
  pinkEdge: '#F9A8D4', // actionEdge
  lilac: '#E6D7FD', // study tint top
  lilacDeep: '#CCBAEC',
  lilacDot: '#B8A4DB',
  mint: '#B7D7B7',
  sky: '#B2D9E0',
  butter: '#FDE68A',
  paper: '#FFFFFF',
  rule: '#EDE4F7',
}

/** The QR code as nested SVG paths with a 4-module quiet zone, error correction M (same as the A5 sheet). */
function qrPaths(url) {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`
  return { d, size: n + quiet * 2 }
}

// Small deterministic noise, so every poster gets the same torn edge.
function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** A torn paper edge along y from x0 to x1, closing downward to yBottom. */
function tornBand(x0, x1, yTop, yEdge, yBottom, seed) {
  const rnd = seeded(seed)
  let d = `M${x0} ${yTop}H${x1}V${yEdge}`
  for (let x = x1; x > x0; ) {
    x = Math.max(x0, x - (2.2 + rnd() * 3.2))
    d += `L${x.toFixed(2)} ${(yEdge + (rnd() - 0.5) * 3.2).toFixed(2)}`
  }
  void yBottom
  return d + 'Z'
}

const star5 = (cx, cy, r, rot = 0) => {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 + rot - 90) * Math.PI) / 180
    const rr = i % 2 ? r * 0.45 : r
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`
  }
  return d + 'Z'
}
const sparkle = (cx, cy, r) =>
  `M${cx} ${cy - r}C${cx + r * 0.12} ${cy - r * 0.2} ${cx + r * 0.2} ${cy - r * 0.12} ${cx + r} ${cy}C${cx + r * 0.2} ${cy + r * 0.12} ${cx + r * 0.12} ${cy + r * 0.2} ${cx} ${cy + r}C${cx - r * 0.12} ${cy + r * 0.2} ${cx - r * 0.2} ${cy + r * 0.12} ${cx - r} ${cy}C${cx - r * 0.2} ${cy - r * 0.12} ${cx - r * 0.12} ${cy - r * 0.2} ${cx} ${cy - r}Z`
const heart = (cx, cy, s) =>
  `M${cx} ${cy + s * 0.9}C${cx - s * 1.5} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.3} ${cx} ${cy - s * 0.5}C${cx + s * 0.9} ${cy - s * 1.3} ${cx + s * 1.5} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`

/** A pastel rainbow sticker: concentric arcs with an ink outline and white sticker margin. */
function rainbow(cx, cy, r, rot) {
  const bands = [C.pink, C.butter, C.mint, C.sky, C.lilacDeep]
  const w = r * 0.13
  const arc = (rad) => `M${cx - rad} ${cy}A${rad} ${rad} 0 0 1 ${cx + rad} ${cy}`
  const outer = r + w / 2
  const inner = r - w * (bands.length - 0.5)
  const shape = `M${cx - outer} ${cy}A${outer} ${outer} 0 0 1 ${cx + outer} ${cy}H${cx + inner}A${inner} ${inner} 0 0 0 ${cx - inner} ${cy}Z`
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <path d="${shape}" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    ${bands.map((b, i) => `<path d="${arc(r - i * w)}" fill="none" stroke="${b}" stroke-width="${w + 0.05}"/>`).join('')}
    <path d="${shape}" fill="none" stroke="${C.ink}" stroke-width="0.6" stroke-linejoin="round"/>
  </g>`
}

/** The you-are-here pin, the same pink as the map. */
function pin(x, y, s, rot) {
  const d = `M0 ${s * 1.35}C${-s * 0.25} ${s * 0.85} ${-s} ${s * 0.45} ${-s} ${-s * 0.15}A${s} ${s} 0 1 1 ${s} ${-s * 0.15}C${s} ${s * 0.45} ${s * 0.25} ${s * 0.85} 0 ${s * 1.35}Z`
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="${d}" fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="${d}" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <circle cx="0" cy="${-s * 0.15}" r="${s * 0.42}" fill="#fff" stroke="${C.ink}" stroke-width="0.6"/>
  </g>`
}

/** A strip of washi tape. */
const tape = (x, y, w, h, rot, fill = C.pinkEdge) => {
  const z = 1.1
  let d = `M${-w / 2} ${-h / 2}`
  for (let i = 0; i <= 4; i++) d += `L${-w / 2 + (i % 2 ? z : 0)} ${-h / 2 + (i * h) / 4}`
  d += `L${w / 2} ${h / 2}`
  for (let i = 4; i >= 0; i--) d += `L${w / 2 - (i % 2 ? z : 0)} ${-h / 2 + (i * h) / 4}`
  return `<path transform="translate(${x} ${y}) rotate(${rot})" d="${d}Z" fill="${fill}" fill-opacity="0.78"/>`
}

/** A pill label like the committee's survey post: ink text on a pale pill with an ink outline. */
const pill = (x, y, en, th, rot, fill) => `<g transform="translate(${x} ${y}) rotate(${rot})" class="pill" data-fill="${fill}">
    <rect class="pill-bg" x="0" y="-5.4" width="10" height="10.8" rx="5.4" fill="${fill}" stroke="${C.ink}" stroke-width="0.6"/>
    <text class="pill-t" x="5" y="1.5" font-family="Plex" font-weight="600" font-size="4.1" fill="${C.ink}">${esc(en)} <tspan font-weight="500" fill="${C.muted}">· ${esc(th)}</tspan></text>
  </g>`

/** The 3D map's floor stack in miniature: one slab per floor, this floor in pink. */
function floorStack(x, y, here) {
  const w = 28
  const h = 8
  const gap = 4.9
  const t = 2.2
  let g = ''
  for (let f = 1; f <= topFloor; f++) {
    const yy = y + (topFloor - f) * gap
    const on = f === here
    const top = `M${x} ${yy + h / 2}L${x + w / 2} ${yy}L${x + w} ${yy + h / 2}L${x + w / 2} ${yy + h}Z`
    const side = `M${x} ${yy + h / 2}L${x + w / 2} ${yy + h}L${x + w} ${yy + h / 2}V${yy + h / 2 + t}L${x + w / 2} ${yy + h + t}L${x} ${yy + h / 2 + t}Z`
    g += `<path d="${side}" fill="${on ? '#C21E78' : C.lilacDot}" stroke="${C.ink}" stroke-width="0.45" stroke-linejoin="round"/>
      <path d="${top}" fill="${on ? C.pink : f > here ? '#F5EFFC' : C.lilac}" stroke="${C.ink}" stroke-width="0.45" stroke-linejoin="round"/>
      <text x="${x + w + 3}" y="${yy + h / 2 + 2.6}" font-family="Kanit" font-weight="${on ? 800 : 500}" font-size="${on ? 6.4 : 4.2}" fill="${on ? C.ink : C.muted}">${f}</text>`
  }
  return g
}

// The A4 page in mm. The board: a white card in a pink frame, 7 mm in from the edge (safe for office printers).
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

  return `<section class="page" data-id="${esc(q.id)}" data-url="${esc(url)}">
<svg class="poster" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">
  <defs>
    <pattern id="dots-${q.id}" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx="1.6" cy="1.6" r="0.62" fill="${C.lilacDot}" fill-opacity="0.55"/>
    </pattern>
    <pattern id="rules-${q.id}" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 7.6H8" stroke="${C.rule}" stroke-width="0.35"/>
    </pattern>
    <clipPath id="inner-${q.id}"><rect x="${ix}" y="${iy}" width="${iw}" height="${bh - 2 * FRAME}" rx="5"/></clipPath>
  </defs>

  <!-- The board: ink edge, pink frame, white notebook paper. -->
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="9" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.7"/>
  <rect x="${ix}" y="${iy}" width="${iw}" height="${bh - 2 * FRAME}" rx="5" fill="${C.paper}" stroke="${C.ink}" stroke-width="0.5"/>
  <g clip-path="url(#inner-${q.id})">
    <rect x="${ix}" y="${bandBottom}" width="${iw}" height="${H}" fill="url(#rules-${q.id})"/>
    <path d="M${ix + 16} ${bandBottom}V${H}" stroke="${C.pinkEdge}" stroke-width="0.4"/>
    <!-- Lilac halftone band with a torn edge. -->
    <path d="${tornBand(ix - 1, ix + iw + 1, iy - 1, bandBottom, bandBottom + 4, 7)}" fill="${C.lilac}"/>
    <path d="${tornBand(ix - 1, ix + iw + 1, iy - 1, bandBottom, bandBottom + 4, 7)}" fill="url(#dots-${q.id})"/>
    <path d="${tornBand(ix - 1, ix + iw + 1, iy - 1, bandBottom, bandBottom + 4, 7)}" fill="none" stroke="${C.lilacDeep}" stroke-width="0.5"/>
  </g>

  <!-- Doodles in the band. -->
  ${rainbow(160, 79, 16, -6)}
  <path d="${star5(28, 26, 6.5, 8)}" fill="${C.butter}" stroke="${C.ink}" stroke-width="0.6" stroke-linejoin="round"/>
  <path d="${sparkle(108, 68, 4.4)}" fill="#fff" stroke="${C.ink}" stroke-width="0.5"/>
  <path d="${sparkle(20, 72, 3.6)}" fill="${C.pink}"/>
  <path d="${sparkle(150, 22, 2.8)}" fill="#fff" stroke="${C.ink}" stroke-width="0.4"/>
  <path d="${heart(60, 18, 3)}" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.5"/>

  <!-- Title: sticker-cut letters. -->
  <g transform="rotate(-3 105 46)">
    <text x="29" y="52" class="title" font-family="Kanit" font-weight="800" font-size="23" fill="${C.lilacDot}" stroke="${C.lilacDot}" stroke-width="5.2" stroke-linejoin="round" transform="translate(1.2 1.4)">YOU ARE HERE</text>
    <text x="29" y="52" class="title" font-family="Kanit" font-weight="800" font-size="23" fill="#fff" stroke="#fff" stroke-width="5.2" stroke-linejoin="round">YOU ARE HERE</text>
    <text x="29" y="52" class="title" font-family="Kanit" font-weight="800" font-size="23" fill="${C.ink}">YOU ARE HERE</text>
  </g>
  ${pin(17, 44, 6.2, -14)}
  <g transform="rotate(2 70 69)">
    <rect class="th-pill" x="24" y="60" width="62" height="15" rx="7.5" fill="${C.pinkSoft}" stroke="${C.ink}" stroke-width="0.7"/>
    <text class="th-title" x="30" y="71.4" font-family="Kanit" font-weight="700" font-size="10" fill="${C.ink}">คุณอยู่ที่นี่</text>
  </g>

  <!-- QR card, taped down. Nothing overlaps the code or its quiet zone. -->
  <rect x="${cx + 1.6}" y="${cy + 2}" width="${card}" height="${card}" rx="4" fill="${C.lilacDeep}"/>
  <rect x="${cx}" y="${cy}" width="${card}" height="${card}" rx="4" fill="#fff" stroke="${C.ink}" stroke-width="0.8"/>
  <svg x="${(W - qrSize) / 2}" y="${cy + (card - qrSize) / 2}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#fff"/><path d="${qd}" fill="#000"/>
  </svg>
  ${tape(cx + card - 3, cy + 3, 26, 8, 40)}
  ${tape(cx + 3, cy + card - 3, 26, 8, 40, C.lilacDeep)}

  <!-- Pill labels that say what the map does. They sit on the card's top and bottom edges, outside the quiet zone. -->
  ${pill(cx - 14, cy - 1, 'Find any room', 'หาห้อง', -2, '#fff')}
  ${pill(cx + 8, cy + card + 0.6, 'Lift or stairs', 'ลิฟต์หรือบันได', 1.5, C.butter)}
  ${pill(cx + card - 52, cy + card + 0.6, 'Ask a question', 'ถามได้เลย', -1.5, C.lilac)}
  <path d="${heart(184, cy + 96, 3.2)}" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.5"/>
  <path d="${star5(26, cy + 60, 4.2, 20)}" fill="${C.pinkSoft}" stroke="${C.ink}" stroke-width="0.5" stroke-linejoin="round"/>
  <path d="${sparkle(184, cy + 40, 3.4)}" fill="${C.butter}" stroke="${C.ink}" stroke-width="0.45"/>

  <!-- Call to action. -->
  <text class="cta" x="${W / 2}" y="${cy + card + 15.5}" text-anchor="middle" font-family="Kanit" font-weight="700" font-size="7.6" fill="${C.ink}">Scan for the building map <tspan fill="${C.muted}" font-weight="500">· สแกนดูแผนที่อาคาร</tspan></text>

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

const font = (pkg, file, family, weight, range) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');${range ? `unicode-range:${range};` : ''}}`
}
const THAI = 'U+0E01-0E5B,U+200B-200D,U+25CC'
const fonts = [
  font('kanit', 'kanit-latin-500-normal.woff2', 'Kanit', 500),
  font('kanit', 'kanit-latin-700-normal.woff2', 'Kanit', 700),
  font('kanit', 'kanit-latin-800-normal.woff2', 'Kanit', 800),
  font('kanit', 'kanit-thai-500-normal.woff2', 'Kanit', 500, THAI),
  font('kanit', 'kanit-thai-700-normal.woff2', 'Kanit', 700, THAI),
  font('kanit', 'kanit-thai-800-normal.woff2', 'Kanit', 800, THAI),
  font('ibm-plex-sans', 'ibm-plex-sans-latin-500-normal.woff2', 'Plex', 500),
  font('ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2', 'Plex', 600),
  font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-thai-500-normal.woff2', 'Plex', 500, THAI),
  font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-thai-600-normal.woff2', 'Plex', 600, THAI),
  font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2', 'PlexMono', 500),
].join('\n')

// Runs in the browser once the fonts load: sizes pills to their text and shrinks any line that would overflow.
const fit = `document.fonts.ready.then(() => {
  for (const g of document.querySelectorAll('.pill')) {
    const t = g.querySelector('.pill-t'), r = g.querySelector('.pill-bg')
    const w = t.getComputedTextLength() + 10
    r.setAttribute('width', w); t.setAttribute('x', 5)
  }
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
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; break-after: page; page-break-after: always; overflow: hidden; }
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
console.log(`print/qr-posters.html: ${points.length} A4 posters, linking to ${base}#/at/<id>`)
