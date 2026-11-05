// Shared drawing helpers for the print posters (qr-poster.mjs, booth-poster.mjs): the Pastel Mauve palette,
// the map-style marks, the QR code, and the embedded fonts. All sizes are in the caller's own mm grid.
import qrcode from 'qrcode-generator'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Pastel Mauve tokens (src/theme/colors.ts) plus the pastel room tints.
export const C = {
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
export function qrPaths(url) {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`
  return { d, size: n + quiet * 2 }
}

/** The you-are-here pin, the same pink as the map. */
export function pin(x, y, s, rot = 0, halo = 3.2) {
  const d = `M0 ${s * 1.35}C${-s * 0.25} ${s * 0.85} ${-s} ${s * 0.45} ${-s} ${-s * 0.15}A${s} ${s} 0 1 1 ${s} ${-s * 0.15}C${s} ${s * 0.45} ${s * 0.25} ${s * 0.85} 0 ${s * 1.35}Z`
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    ${halo ? `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="${halo}" stroke-linejoin="round"/>` : ''}
    <path d="${d}" fill="${C.pink}" stroke="${C.ink}" stroke-width="${Math.min(0.8, s * 0.13)}" stroke-linejoin="round"/>
    <circle cx="0" cy="${-s * 0.15}" r="${s * 0.42}" fill="#fff" stroke="${C.ink}" stroke-width="${Math.min(0.6, s * 0.1)}"/>
  </g>`
}

/** A small room block in the map's own 3D style: an isometric box with a tinted top. */
export function block(x, y, s, top, side = C.lilacDot) {
  const h = s * 0.55
  const t = `M${x} ${y}L${x + s} ${y - s * 0.5}L${x + 2 * s} ${y}L${x + s} ${y + s * 0.5}Z`
  const l = `M${x} ${y}L${x + s} ${y + s * 0.5}V${y + s * 0.5 + h}L${x} ${y + h}Z`
  const r = `M${x + s} ${y + s * 0.5}L${x + 2 * s} ${y}V${y + h}L${x + s} ${y + s * 0.5 + h}Z`
  const st = `stroke="${C.ink}" stroke-width="0.45" stroke-linejoin="round"`
  return `<path d="${l}" fill="${side}" ${st}/><path d="${r}" fill="#fff" ${st}/><path d="${t}" fill="${top}" ${st}/>`
}

/** A map marker: a small plus sign, as surveyors and floor plans use. */
export const mark = (x, y, r, fill = C.pink) =>
  `<path d="M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}" stroke="${fill}" stroke-width="${r * 0.55}" stroke-linecap="round"/>`

/** Small ink icons for legend chips, about 4.6 mm across, centred on (cx, cy). */
export function chipIcon(name, cx, cy) {
  const st = `fill="none" stroke="${C.ink}" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"`
  if (name === 'search') return `<circle cx="${cx - 0.4}" cy="${cy - 0.4}" r="1.55" fill="${C.pinkSoft}" stroke="${C.ink}" stroke-width="0.55"/><path d="M${cx + 0.75} ${cy + 0.75}L${cx + 2.1} ${cy + 2.1}" ${st} stroke-width="0.8"/>`
  if (name === 'stairs') return `<path d="M${cx - 2.2} ${cy + 2}H${cx - 0.9}V${cy + 0.7}H${cx + 0.4}V${cy - 0.6}H${cx + 1.7}V${cy - 1.9}H${cx + 2.3}" ${st}/><path d="M${cx - 2.2} ${cy + 2}H${cx + 2.3}V${cy - 1.9}" fill="none" stroke="${C.lilacDeep}" stroke-width="0.4"/><path d="M${cx - 2} ${cy - 0.3}l1.2-1.2m0 0h-0.9m0.9 0v0.9" ${st} stroke="${C.pink}"/>`
  if (name === 'lang') return `<path d="M${cx - 2.2} ${cy - 2}h4.4a0.5 0.5 0 0 1 0.5 0.5v2.6a0.5 0.5 0 0 1-0.5 0.5h-2.5l-1.4 1.2v-1.2h-0.5a0.5 0.5 0 0 1-0.5-0.5v-2.6a0.5 0.5 0 0 1 0.5-0.5z" fill="${C.butter}" stroke="${C.ink}" stroke-width="0.5" stroke-linejoin="round"/><text x="${cx - 1.15}" y="${cy + 0.45}" text-anchor="middle" font-family="Kanit" font-weight="700" font-size="2.2" fill="${C.ink}">A</text><text x="${cx + 1.05}" y="${cy + 0.45}" text-anchor="middle" font-family="Kanit" font-weight="700" font-size="2.6" fill="${C.ink}">ก</text>`
  return ''
}

/** A map legend chip: a colour swatch (or an icon) and ink text in a small rounded box. */
export const chip = (x, y, en, th, rot, swatch, icon) => `<g transform="translate(${x} ${y}) rotate(${rot})" class="pill">
    <rect class="pill-bg" x="0" y="-4.8" width="10" height="9.6" rx="2" fill="#fff" stroke="${C.ink}" stroke-width="0.6"/>
    ${icon ? chipIcon(icon, 4.5, 0) : `<rect x="2.4" y="-2.1" width="4.2" height="4.2" rx="0.8" fill="${swatch}" stroke="${C.ink}" stroke-width="0.45"/>`}
    <text class="pill-t" x="8.8" y="1.35" font-family="Plex" font-weight="600" font-size="3.4" fill="${C.ink}">${esc(en)} <tspan font-weight="500" fill="${C.muted}">· ${esc(th)}</tspan></text>
  </g>`

/** Scan-frame corners around the QR card, like a phone camera's viewfinder. */
export function scanFrame(x, y, w, h, gap, len) {
  const x0 = x - gap
  const y0 = y - gap
  const x1 = x + w + gap
  const y1 = y + h + gap
  const d = `M${x0} ${y0 + len}V${y0}H${x0 + len}M${x1 - len} ${y0}H${x1}V${y0 + len}M${x1} ${y1 - len}V${y1}H${x1 - len}M${x0 + len} ${y1}H${x0}V${y1 - len}`
  return `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${C.pink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
}

export const ROOM_TINT = { library: C.mint, restroom: C.sky, lift: C.lilacDeep, stairs: C.lilacDeep, foodservice: C.butter, classroom: C.lilac }

/** A floor as a small map card: the outline, the rooms, a north arrow and a pin on q.position (q = {floor, position}). */
export function miniMap(data, q, x, y, w, h, rot) {
  const xs = data.building.outline.map((p) => p[0])
  const zs = data.building.outline.map((p) => p[1])
  const minX = Math.min(...xs)
  const minZ = Math.min(...zs)
  const pad = 3.2
  const s = Math.min((w - 2 * pad) / (Math.max(...xs) - minX), (h - 2 * pad - 6) / (Math.max(...zs) - minZ))
  const ox = x + pad
  const oy = y + pad + 2
  const pt = ([px, pz]) => `${(ox + (px - minX) * s).toFixed(2)} ${(oy + (pz - minZ) * s).toFixed(2)}`
  const poly = (ring) => 'M' + ring.map(pt).join('L') + 'Z'
  const rooms = data.rooms
    .filter((r) => r.floor === q.floor)
    .map((r) => `<path d="${poly(r.polygon)}" fill="${ROOM_TINT[r.type] ?? '#F5EFFC'}" stroke="${C.lilacDot}" stroke-width="0.22"/>`)
    .join('')
  const [qx, qz] = q.position
  const px = ox + (qx - minX) * s
  const pz = oy + (qz - minZ) * s
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x + 1.2}" y="${y + 1.4}" width="${w}" height="${h}" rx="2.6" fill="${C.lilacDot}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.6" fill="#fff" stroke="${C.ink}" stroke-width="0.6"/>
    <path d="${poly(data.building.outline)}" fill="#FBF8FE" stroke="${C.ink}" stroke-width="0.4" stroke-linejoin="round"/>
    ${rooms}
    <circle cx="${px}" cy="${pz}" r="3.2" fill="${C.pink}" fill-opacity="0.22"/>
    ${pin(px, pz - 2.6, 2.1, 0, 1.2)}
    <g transform="translate(${x + w - 4.6} ${y + 5})">
      <path d="M0 -3.2L1.6 1.6L0 0.7L-1.6 1.6Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.35" stroke-linejoin="round"/>
      <text y="4.9" text-anchor="middle" font-family="Kanit" font-weight="700" font-size="2.6" fill="${C.ink}">N</text>
    </g>
    ${scaleBar(ox, y + h - 2.6, 5 * s, 2, '10 m')}
  </g>`
}

/** A map scale bar: alternating ink and white segments, true to the map it sits under. */
export function scaleBar(x, y, seg, n, label) {
  let g = ''
  for (let i = 0; i < n; i++) g += `<rect x="${(x + i * seg).toFixed(2)}" y="${y}" width="${seg.toFixed(2)}" height="1.1" fill="${i % 2 ? '#fff' : C.ink}" stroke="${C.ink}" stroke-width="0.25"/>`
  return `${g}<text x="${(x + n * seg + 1.2).toFixed(2)}" y="${y + 1.1}" font-family="PlexMono" font-weight="500" font-size="2.2" fill="${C.muted}">${label}</text>`
}

/** The 3D map's floor stack in miniature: one slab per floor, this floor in pink. */
export function floorStack(topFloor, x, y, here) {
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

const font = (pkg, file, family, weight, range) => {
  const b64 = readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');${range ? `unicode-range:${range};` : ''}}`
}
const THAI = 'U+0E01-0E5B,U+200B-200D,U+25CC'
export const fonts = [
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

/** Browser-side code: sizes the legend chips to their text and keeps .end chips ending at their x. Needs the fonts loaded. */
export const fitPills = `for (const g of document.querySelectorAll('.pill')) {
    const t = g.querySelector('.pill-t'), r = g.querySelector('.pill-bg')
    const w = t.getComputedTextLength() + 10
    r.setAttribute('width', w + 3.6); t.setAttribute('x', 8.8)
  }
  for (const e of document.querySelectorAll('.end')) e.setAttribute('transform', 'translate(' + -e.querySelector('.pill-bg').getAttribute('width') + ' 0)')`
