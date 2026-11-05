// Final-presentation slide template: npm run slides-template
//   -> print/siit-map-final-slides.pptx (git-ignored), 19 slides, 16:9 (13.333 x 7.5 in), meant for Canva import.
//   -> print/slides-preview/slide-NN.png (one thumbnail per slide) and contact.png.
// Same family as the print posters (shared helpers in scripts/poster-kit.mjs): pink frame, lilac dot-grid band with a ruler
// edge, graph paper, isometric room blocks, pins and "+" markers, legend chips, the floor stack, the dashed pink route.
//
// How it is built for Canva: every word is a native, editable PowerPoint text box (fonts Kanit and IBM Plex Sans Thai only,
// no text effects). Decoration is rendered with Playwright from poster-kit SVG as transparent PNGs (2x or more) and placed
// as pictures; plain rectangles and arrows are native shapes. Each slide is described once as layout data (elements in
// inches), then written to the PPTX and drawn again as an HTML twin that Chrome renders to the thumbnails (no LibreOffice
// needed) and runs the overlap / overflow checks on.
// Counts on the solution slide come from src/data/building.json, like the booth poster. Needs no network (fonts embedded).
// Check the finished file with: npm run slides-template:check
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, esc, qrPaths, pin, block, mark, scanFrame, floorStack, miniMap, chipIcon, fonts } from './poster-kit.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'print')
const prevDir = join(outDir, 'slides-preview')
mkdirSync(prevDir, { recursive: true })
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))

const URL_APP = 'https://ryusakichan.github.io/siit-map/'
const URL_SURVEY = 'https://docs.google.com/forms/d/e/1FAIpQLSeAIzBy1H_33zBJu2uWek_YheISU3mOJwCIbZPcMteqrJlzEw/viewform'

// Numbers come from the data, never typed by hand (same rules as booth-poster.mjs). Rooms exclude lifts and stairs.
const tracedFloors = data.floors.filter((f) => f.traced).length
const roomCount = data.rooms.filter((r) => !r.sample && r.type !== 'stairs' && r.type !== 'elevator').length
const realQr = data.qrPoints.filter((q) => !q.sample)
const qrCount = realQr.length
const topFloor = Math.max(...data.floors.map((f) => f.level))

const SW = 13.333
const SH = 7.5
const X0 = 0.75
const XR = 12.58
const XW = XR - X0
const Y0 = 1.82
const IN_L = 0.38 // inner frame (text must stay inside)
const IN_R = SW - 0.38
const IN_T = 0.38
const IN_B = SH - 0.38
const FONT = { K: 'Kanit', P: 'IBM Plex Sans Thai' }
const LH = { K: 1.5, P: 1.65 } // natural line height of each font, em
const MUTED = C.muted
const hex = (c) => c.replace('#', '')

// ---------------------------------------------------------------- layout data
let els = []
const slides = []
const newSlide = (bg, title, thai) => {
  els = []
  const s = { bg, els, title, thai }
  slides.push(s)
  if (bg === 'band') {
    T(0.95, 0.5, 8.9, 0.72, [{ t: title, f: 'K', s: 34, b: true }], { name: 'Title' })
    T(0.95, 1.2, 8.9, 0.42, [{ t: thai, f: 'K', s: 20, c: MUTED }], { name: 'Title (Thai)' })
  }
  return s
}
const R = (x, y, w, h, o = {}) => els.push({ k: 'rect', x, y, w, h, fill: o.fill ?? null, line: o.line === undefined ? C.ink : o.line, lw: o.lw ?? 1, r: o.r ?? 0.0833, dash: o.dash, shape: o.shape ?? 'round' })
const E = (x, y, w, h, o = {}) => R(x, y, w, h, { ...o, shape: 'ellipse' })
const IMG = (name, x, y, w, h, alt) => els.push({ k: 'img', name, x, y, w, h, alt: alt ?? name })
const ARROW = (x1, y1, x2, y2, o = {}) => els.push({ k: 'line', x1, y1, x2, y2, c: o.c ?? C.ink, lw: o.lw ?? 2, dash: o.dash, arrow: o.arrow ?? true })
// Paragraphs: a string, {t, f, s, b, c, after} or {runs:[...]}; [bracketed] text is a placeholder and is set in the muted colour.
function T(x, y, w, h, paras, o = {}) {
  const base = { f: o.f ?? 'P', s: o.s ?? 18, b: o.b ?? false, c: o.c ?? C.ink }
  const ps = paras.map((p) => {
    const sp = typeof p === 'string' ? { t: p } : p
    const src = sp.runs ?? [sp]
    const runs = []
    for (const r of src) {
      const rb = { ...base, ...(sp.runs ? {} : { f: sp.f, s: sp.s, b: sp.b, c: sp.c }), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) }
      for (const part of String(r.t).split(/(\[[^\]]*\])/)) {
        if (!part) continue
        const ph = /^\[[^\]]*\]$/.test(part)
        runs.push({ t: part, f: rb.f ?? base.f, s: rb.s ?? base.s, b: rb.b ?? base.b, c: ph ? MUTED : (rb.c ?? base.c) })
      }
    }
    return { runs, after: sp.after ?? o.after ?? 0 }
  })
  els.push({ k: 'text', x, y, w, h, ps, al: o.al ?? 'left', va: o.va ?? 'top', ls: o.ls ?? 0.85, name: o.name })
}
const CARD_FILLS = [C.pinkSoft, C.lilac, C.mint, C.butter, C.sky]
function card(x, y, w, h, title, fill, o = {}) {
  R(x + 0.04, y + 0.05, w, h, { fill: C.lilacDeep, line: null })
  R(x, y, w, h, { fill: '#FFFFFF', lw: 1 })
  R(x, y, w, 0.5, { fill, shape: 'top', lw: 1 })
  T(x + 0.2, y, w - 0.4, 0.5, [{ t: title, f: 'K', s: o.s ?? 20, b: true }], { va: 'middle', name: 'Card title' })
  return { x: x + 0.2, y: y + 0.62, w: w - 0.4, h: h - 0.72 }
}
function chipBox(x, y, w, h, swatch, paras, o = {}) {
  R(x, y, w, h, { fill: '#FFFFFF', lw: 0.75, r: 0.08 })
  R(x + 0.15, y + h / 2 - 0.12, 0.24, 0.24, { fill: swatch, lw: 0.75, r: 0.03 })
  T(x + 0.52, y + 0.01, w - 0.62, h - 0.02, paras, { va: 'middle', ...o })
}
function slot(x, y, w, h, text, o = {}) {
  R(x, y, w, h, { fill: '#FBF8FE', dash: 'dash', lw: 1.25, r: 0.06 })
  T(x + 0.1, y + 0.05, w - 0.2, h - 0.1, [text], { al: 'center', va: 'middle', ...o })
}
const bil = (en, th, o = {}) => [{ t: en, f: 'K', s: o.s ?? 20, b: true }, { t: th, s: o.ts ?? 18, c: MUTED }]

// 1. Cover
newSlide('cover')
IMG('title-extrusion', 0.95, 0.6, 7.7, 2.3, 'Lilac 3D extrusion behind the title')
T(0.95, 0.6, 7.7, 2.3, [{ t: 'SIIT Map', f: 'K', s: 110, b: true }], { name: 'Title', ls: 1 })
T(0.95, 2.95, 8.3, 0.62, [{ t: 'The building map that walks with you.', f: 'K', s: 28, b: true }], { name: 'Hook' })
T(0.95, 3.52, 8.3, 0.62, [{ t: 'แผนที่ตึกที่เดินไปพร้อมกับคุณ', f: 'K', s: 26, b: true, c: MUTED }], { name: 'Hook (Thai)' })
IMG('floor-stack-hero', 9.1, 0.9, 3.5, 3.13, 'The five floors stacked like the 3D map, with a pin on the top floor')
IMG('route-cover', 0.55, 1.95, 0.6, 4.2, 'Dashed pink walking route')
const coverChips = [
  [C.lilacDeep, 'TU100 Civic Engagement · Section 1', 6.3],
  [C.butter, 'Final presentation · 20 Nov 2026', 5.9],
  [C.mint, '[Group name]', 3.6],
]
coverChips.forEach(([sw, txt, w], i) => chipBox(1.35, 4.95 + i * 0.7, w, 0.58, sw, [{ t: txt, f: 'K', s: 22, b: true }], { name: i === 2 ? 'Group name' : 'Course line' }))
T(8.2, 5.0, 4.4, 1.9, [{ t: 'Find any room, office or facility from your phone. No app to install.', s: 18, b: true }, { t: 'หาห้อง ออฟฟิศ หรือห้องน้ำในตึกหลัก SIIT ได้จากมือถือ ไม่ต้องโหลดแอป', s: 18, c: MUTED }], { after: 6, name: 'Tagline' })

// 2. Agenda
newSlide('band', 'Agenda', 'หัวข้อวันนี้')
{
  const stops = [
    ['The problem', 'ปัญหา', 'Slides 3–5', C.pinkSoft],
    ['Our solution', 'ทางออกของเรา', 'Slides 6–8', C.lilac],
    ['How we made it', 'วิธีที่เราทำ', 'Slides 9–12', C.mint],
    ['Results', 'ผลที่ได้', 'Slides 13–15', C.butter],
    ['Reflection', 'มองย้อนกลับ', 'Slides 16–17', C.sky],
    ['What next', 'ก้าวต่อไป', 'Slides 18–19', C.pinkSoft],
  ]
  const cw = 1.85
  const gap = (XW - 6 * cw) / 5
  const cy = 2.75
  IMG('route-agenda', 0.6, 2.2, 12.1, 1.1, 'Dashed pink route through the six stops')
  stops.forEach(([en, th, sl, fill], i) => {
    const x = X0 + i * (cw + gap)
    E(x + cw / 2 - 0.31, cy - 0.31 + (i % 2 ? -0.1 : 0.1), 0.62, 0.62, { fill: C.pink, lw: 1.5 })
    T(x + cw / 2 - 0.31, cy - 0.31 + (i % 2 ? -0.1 : 0.1), 0.62, 0.62, [{ t: String(i + 1), f: 'K', s: 24, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'Stop number' })
    R(x + 0.04, 3.75 + 0.05, cw, 2.7, { fill: C.lilacDeep, line: null })
    R(x, 3.75, cw, 2.7, { fill: '#FFFFFF' })
    R(x, 3.75, cw, 0.2, { fill, shape: 'top', r: 0.07 })
    T(x + 0.12, 4.05, cw - 0.2, 2.35, [{ t: en, f: 'K', s: 22, b: true, after: 4 }, { t: th, s: 18, c: MUTED, after: 4 }, { t: sl, s: 18, c: MUTED }], { name: 'Agenda stop' })
  })
}

// 3. The problem
newSlide('band', 'The problem', 'ปัญหา')
{
  const b = card(X0, Y0, 5.85, 4.8, 'The problem · ปัญหา', C.pinkSoft)
  T(b.x, b.y, b.w, b.h, [
    { t: "A map on the wall can't walk with you. The Main Building's only maps are flat 2D fire-exit plans: hard to read and stuck in one spot. Your phone goes everywhere you go, so the map should too.", b: true, after: 8 },
    { t: 'แผนที่บนผนังเดินตามคุณไปไม่ได้ ในตึกหลักมีแค่แผนผังทางหนีไฟแบบ 2D ที่อ่านยากและติดอยู่กับที่ มือถืออยู่กับคุณทุกที่ แผนที่ก็ควรไปกับคุณด้วย' },
  ], { name: 'Problem text' })
  const rx = X0 + 5.85 + 0.25
  const rw = XR - rx
  const s = card(rx, Y0, rw, 3.35, 'Problem statement · ข้อความปัญหา', C.lilac)
  T(s.x, s.y, s.w, s.h, [
    { runs: [{ t: 'Visitors and new students ' }, { t: 'need to', b: true }, { t: ' find rooms, offices and facilities quickly, ' }, { t: 'because', b: true }, { t: ' there is no public map or room list and getting lost costs time and stress.' }], after: 6 },
    { runs: [{ t: 'ผู้มาเยือนและนักศึกษาใหม่', c: MUTED }, { t: ' ต้อง', b: true, c: MUTED }, { t: 'หาห้อง ออฟฟิศ และห้องน้ำให้เจอเร็ว ', c: MUTED }, { t: 'เพราะ', b: true, c: MUTED }, { t: 'ไม่มีแผนที่หรือรายชื่อห้องให้ดู และการหลงทางทำให้เสียเวลาและเครียด', c: MUTED }] },
  ], { name: 'Problem statement' })
  const ew = (rw - 0.3) / 3
  ;['[Evidence: signage photo]', '[Evidence: interview quote]', '[Evidence: N people asked]'].forEach((t, i) => slot(rx + i * (ew + 0.15), Y0 + 3.5, ew, 1.3, t, { name: 'Evidence slot' }))
}

// 4. Cause and effect
newSlide('band', 'Cause and effect', 'สาเหตุและผลที่ตามมา')
{
  const causes = ['No public floor plan or room list online', "Room numbers don't show the floor [check]", 'Little signage, mostly one language [check]', "Directions live in people's heads"]
  const effects = ['Late for classes, exams and appointments', 'Staff and guards interrupted for directions', 'Visitors and non-Thai speakers feel unwelcome', 'Restrooms and elevators are hard to find']
  T(X0, Y0 - 0.08, 3.9, 0.38, [{ t: 'Causes · สาเหตุ', f: 'K', s: 18, b: true }], { name: 'Column label' })
  T(8.68, Y0 - 0.08, 3.9, 0.38, [{ t: 'Effects · ผลที่ตามมา', f: 'K', s: 18, b: true }], { name: 'Column label' })
  causes.forEach((t, i) => chipBox(X0, Y0 + 0.3 + i * 0.75, 3.9, 0.72, C.lilacDeep, [t], { name: 'Cause', ls: 0.78 }))
  effects.forEach((t, i) => chipBox(8.68, Y0 + 0.3 + i * 0.75, 3.9, 0.72, C.butter, [t], { name: 'Effect', ls: 0.78 }))
  R(5.1, Y0 + 0.3, 3.1, 2.97, { fill: C.pinkSoft, lw: 1.5 })
  T(5.25, Y0 + 0.4, 2.8, 2.77, [{ t: "People can't find rooms, offices or facilities in the Main Building", f: 'K', s: 20, b: true, after: 4 }, { t: 'หาห้อง ออฟฟิศ และสิ่งอำนวยความสะดวกในตึกหลักไม่เจอ', c: MUTED }], { al: 'center', va: 'middle', name: 'Problem' })
  ARROW(4.7, Y0 + 1.78, 5.05, Y0 + 1.78, { c: C.pink })
  ARROW(8.25, Y0 + 1.78, 8.62, Y0 + 1.78, { c: C.pink })
  const iy = 5.17
  IMG('iceberg', X0, iy, 2.1, 1.45, 'Small iceberg: the event is the tip')
  const ice = [
    ['Event', 'Someone is lost in a corridor', C.pinkSoft],
    ['Pattern', 'It happens every semester start and open day', C.lilac],
    ['Structure', 'No shared, up-to-date room list', C.mint],
    ['Mental model', '"Ask someone" is good enough', C.butter],
  ]
  ice.forEach(([k, v, sw], i) => chipBox(3.05 + (i % 2) * 4.8, iy + Math.floor(i / 2) * 0.77, 4.7, 0.72, sw, [{ runs: [{ t: k + ': ', b: true }, { t: v }] }], { name: 'Iceberg layer', ls: 0.78 }))
}

// 5. Stakeholders
newSlide('band', 'Stakeholders', 'ผู้มีส่วนได้ส่วนเสีย')
{
  const gx = 2.45
  const gy = 2.25
  const qw = 2.9
  const qh = 2.2
  T(gx, Y0 - 0.06, qw, 0.4, [{ t: 'Lower interest', f: 'K', s: 18, b: true, c: MUTED }], { al: 'center', name: 'Axis' })
  T(gx + qw, Y0 - 0.06, qw, 0.4, [{ t: 'Higher interest', f: 'K', s: 18, b: true, c: MUTED }], { al: 'center', name: 'Axis' })
  T(X0, gy, 1.6, qh, [{ t: 'High importance', f: 'K', s: 18, b: true, c: MUTED }], { va: 'middle', al: 'right', name: 'Axis' })
  T(X0, gy + qh, 1.6, qh, [{ t: 'Lower importance', f: 'K', s: 18, b: true, c: MUTED }], { va: 'middle', al: 'right', name: 'Axis' })
  const quads = [
    [0, 0, 'Keep satisfied', C.lilac, [['SIIT administration', C.lilacDeep]]],
    [1, 0, 'Work closely', C.pinkSoft, [['New students', C.pink], ['Visitors, parents', C.pink], ['Our group', C.pink]]],
    [0, 1, 'Monitor', '#F5EFFC', [['[Anyone else?]', '#FFFFFF']]],
    [1, 1, 'Keep informed', C.mint, [['SIIT staff and guards', C.mint], ['Departments and offices', C.mint]]],
  ]
  quads.forEach(([cx, cy, label, fill, items]) => {
    const x = gx + cx * qw
    const y = gy + cy * qh
    R(x, y, qw, qh, { fill, line: C.ink, lw: 0.75, r: 0 })
    T(x + 0.12, y + 0.02, qw - 0.24, 0.4, [{ t: label, f: 'K', s: 18, b: true }], { va: 'middle', ls: 1, name: 'Quadrant' })
    let yy = y + 0.44
    items.forEach(([t, sw]) => {
      const h = t.length > 17 ? 0.68 : 0.46
      chipBox(x + 0.12, yy, qw - 0.24, h, sw, [t], { name: 'Stakeholder', ls: 0.78 })
      yy += h + 0.05
    })
  })
  const rx = gx + 2 * qw + 0.3
  const b = card(rx, Y0, XR - rx, 4.8, 'Concerns · ข้อกังวล', C.butter)
  T(b.x, b.y, b.w, b.h, [
    { t: 'Privacy of staff details', b: true },
    { t: 'No personal data on the map, only room and department info.', after: 8 },
    { t: 'Rooms change', b: true },
    { t: 'All data lives in one editable file.', after: 8 },
    { t: '[Other concerns from interviews]' },
  ], { name: 'Concerns' })
}

// 6. Options we weighed
newSlide('band', 'Options we weighed', 'ทางเลือกที่เราพิจารณา')
{
  const opts = [
    ['Web map · แผนที่เว็บ', C.mint, [['Free, on every phone, bilingual', 'Needs accurate data', 'Can grow to other SIIT buildings', 'Rooms change; data goes stale']]],
    ['Posters · โปสเตอร์', C.butter, [['Simple', 'Fixed place, one language at a time', 'Cheap to print', 'Easy to remove or outdate']]],
    ['Signs · ป้ายทางการ', C.sky, [['Permanent', 'Out of our control, slow', '[Opportunity]', 'No budget']]],
  ]
  const cw = (XW - 0.43) / 3
  opts.forEach(([title, fill, [rows]], i) => {
    const x = X0 + i * (cw + 0.215)
    const b = card(x, Y0, cw, 3.6, title, fill)
    rows.forEach((t, j) => {
      const yy = b.y + j * 0.7
      R(x + 0.2, yy + 0.07, 0.4, 0.4, { fill: [C.mint, C.pinkSoft, C.lilac, C.butter][j], lw: 0.75, r: 0.04 })
      T(x + 0.2, yy + 0.07, 0.4, 0.4, [{ t: 'SWOT'[j], f: 'K', s: 18, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'SWOT letter' })
      T(x + 0.72, yy - 0.02, cw - 0.9, 0.68, [t], { va: 'middle', ls: 0.78, name: 'SWOT text' })
    })
  })
  R(X0 + 0.04, 5.62 + 0.05, XW, 1.0, { fill: C.lilacDeep, line: null })
  R(X0, 5.62, XW, 1.0, { fill: C.pinkSoft, lw: 1.5 })
  T(X0 + 0.25, 5.66, XW - 0.5, 0.94, [
    { t: 'Why a phone map won · ทำไมเราเลือกแผนที่บนมือถือ', f: 'K', s: 20, b: true },
    { t: 'It is free, goes with you, speaks Thai and English, and we update it from one file.' },
    { t: 'ฟรี ไปกับคุณได้ ใช้ได้ทั้งไทยและอังกฤษ และเราแก้ข้อมูลได้จากไฟล์เดียว', c: MUTED },
  ], { va: 'middle', ls: 0.75, name: 'Why' })
}

// 7. Our solution
newSlide('band', 'Our solution: SIIT Map', 'ทางออกของเรา: SIIT Map')
{
  IMG('phone', 0.85, 1.92, 2.2, 4.55, 'Phone showing the live SIIT Map app')
  const feats = [
    ['floors', C.lilac, '3D floors', 'แผนที่ 3 มิติทุกชั้น'],
    ['search', C.mint, 'Search rooms', 'ค้นหาห้อง'],
    ['stairs', C.lilacDeep, 'Directions, avoid stairs', 'บอกทาง เลี่ยงบันไดได้'],
    ['qr', C.pinkSoft, '"You are here" QR', 'สแกน QR รู้ว่าอยู่ตรงไหน'],
    ['lang', C.butter, 'Thai and English', 'ไทยและอังกฤษ'],
    ['chat', C.sky, 'Ask assistant', 'ถามผู้ช่วยเรื่องในตึก'],
  ]
  const fx = 3.5
  const fw = (XR - fx - 0.2) / 2
  feats.forEach(([ic, sw, en, th], i) => {
    const x = fx + (i % 2) * (fw + 0.2)
    const y = Y0 + Math.floor(i / 2) * 1.05
    R(x + 0.03, y + 0.04, fw, 0.92, { fill: C.lilacDeep, line: null })
    R(x, y, fw, 0.92, { fill: '#FFFFFF', lw: 0.75 })
    R(x + 0.14, y + 0.14, 0.64, 0.64, { fill: sw, lw: 0.75, r: 0.08 })
    IMG('icon-' + ic, x + 0.19, y + 0.19, 0.54, 0.54, ic + ' icon')
    T(x + 0.95, y + 0.04, fw - 1.05, 0.84, [{ t: en, f: 'K', s: 18, b: true }, { t: th, c: MUTED }], { va: 'middle', ls: 0.78, name: 'Feature' })
  })
  const stats = [[String(tracedFloors), 'floors traced', 'ชั้นที่ทำแผนผังจริง'], [String(roomCount), 'rooms', 'ห้อง'], [String(qrCount), 'QR points', 'จุด QR']]
  const sw3 = (XR - fx - 0.4) / 3
  stats.forEach(([n, en, th], i) => {
    const x = fx + i * (sw3 + 0.2)
    R(x + 0.03, 5.1 + 0.04, sw3, 1.5, { fill: C.lilacDeep, line: null })
    R(x, 5.1, sw3, 1.5, { fill: '#FBF8FE', lw: 1 })
    T(x + 0.1, 5.12, sw3 - 0.2, 0.85, [{ t: n, f: 'K', s: 40, b: true }], { al: 'center', ls: 1, name: 'Live count' })
    T(x + 0.1, 5.91, sw3 - 0.2, 0.62, [{ t: en, b: true }, { t: th, c: MUTED }], { al: 'center', ls: 0.72, name: 'Count label' })
  })
}

// 8. Live demo
newSlide('band', 'Live demo', 'สาธิตการใช้งานจริง')
{
  IMG('qr-site', 0.7, 1.7, 4.4, 4.4, 'QR code for ' + URL_APP)
  T(0.95, 6.05, 4.3, 0.6, [{ t: 'ryusakichan.github.io/siit-map', f: 'K', s: 18, b: true }], { al: 'center', name: 'Site address' })
  const b = card(5.75, Y0, XR - 5.75, 4.8, 'Demo checklist · เช็กลิสต์สาธิต', C.mint)
  const steps = [['Scan a QR', 'สแกน QR ที่ตึก'], ['Search a room', 'ค้นหาห้อง'], ['Get directions', 'ขอเส้นทาง'], ['Switch language', 'เปลี่ยนภาษา'], ['Ask a question', 'ถามผู้ช่วย']]
  steps.forEach(([en, th], i) => {
    const y = b.y + i * 0.8
    R(b.x, y + 0.14, 0.36, 0.36, { fill: '#FFFFFF', lw: 1.25, r: 0.05 })
    T(b.x + 0.58, y, b.w - 0.58, 0.76, [{ t: en, f: 'K', s: 20, b: true }, { t: th, c: MUTED }], { va: 'middle', ls: 0.75, name: 'Demo step' })
  })
}

// 9. How we mapped the building
newSlide('band', 'How we mapped the building', 'เราทำแผนที่ตึกอย่างไร')
{
  const b = card(X0, Y0, 5.8, 3.0, 'Our sources · แหล่งข้อมูล', C.lilac)
  const src = ['Wall floor plans inside the building', 'Walk-through photos of every floor', 'OpenStreetMap building outline © OpenStreetMap contributors', 'Room names and numbers from our walk']
  const hs = [0.4, 0.4, 0.78, 0.4]
  let yy = b.y - 0.04
  src.forEach((t, i) => {
    R(b.x, yy + hs[i] / 2 - 0.1, 0.2, 0.2, { fill: [C.mint, C.butter, C.sky, C.pinkSoft][i], lw: 0.75, r: 0.03 })
    T(b.x + 0.38, yy, b.w - 0.38, hs[i], [t], { va: 'middle', ls: 0.75, name: 'Source' })
    yy += hs[i] + 0.1
  })
  slot(X0, 5.0, 1.85, 1.62, '[Photo: wall plan]', { name: 'Photo slot', ls: 0.8 })
  slot(X0 + 2.0, 5.0, 1.85, 1.62, '[Photo: corridor]', { name: 'Photo slot', ls: 0.8 })
  IMG('mini-map', X0 + 4.0, 5.0, 1.8, 1.62, 'Floor map card with a pin')
  const steps = [
    ['1', 'Trace · วาดจากแผนผังจริง', 'Floor by floor, into one data file', C.pinkSoft],
    ['2', 'Check on site · ตรวจที่ตึกจริง', 'Walk each floor, check names and numbers', C.mint],
    ['3', 'QR points · ติดจุด QR', 'About 4 to 6 spots per floor, after staff approval', C.butter],
  ]
  const sx = 6.85
  steps.forEach(([n, title, sub, fill], i) => {
    const y = Y0 + i * 1.65
    R(sx + 0.04, y + 0.05, XR - sx, 1.5, { fill: C.lilacDeep, line: null })
    R(sx, y, XR - sx, 1.5, { fill: '#FFFFFF' })
    R(sx, y, 0.18, 1.5, { fill, line: C.ink, lw: 1, r: 0 })
    E(sx + 0.38, y + 0.43, 0.64, 0.64, { fill: C.pink, lw: 1.5 })
    T(sx + 0.38, y + 0.43, 0.64, 0.64, [{ t: n, f: 'K', s: 24, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'Step number' })
    T(sx + 1.2, y + 0.08, XR - sx - 1.3, 1.34, [{ t: title, f: 'K', s: 20, b: true, after: 2 }, { t: sub }], { va: 'middle', ls: 0.78, name: 'Step' })
  })
}

// 10. How it's built
newSlide('band', "How it's built", 'สร้างด้วยอะไร')
{
  IMG('tile-diagram', X0, Y0, XW, 4.1, 'Lilac dot-grid map tile with a ruler edge')
  const node = (x, y, w, title, body, fill) => {
    R(x + 0.04, y + 0.05, w, 1.55, { fill: C.lilacDeep, line: null })
    R(x, y, w, 1.55, { fill: '#FFFFFF' })
    R(x, y, w, 0.5, { fill, shape: 'top' })
    T(x + 0.15, y, w - 0.3, 0.5, [{ t: title, f: 'K', s: 20, b: true }], { va: 'middle', name: 'Node title' })
    T(x + 0.15, y + 0.56, w - 0.3, 0.96, [body], { va: 'middle', ls: 0.78, name: 'Node text' })
  }
  node(1.1, 3.1, 3.1, 'Your phone', 'Browser app: React and Three.js, nothing to install', C.mint)
  node(5.35, 2.15, 3.2, 'GitHub Pages', 'Free hosting, no server to run', C.lilac)
  node(5.35, 4.1, 3.2, 'Cloudflare Worker', 'Passes Ask questions along', C.butter)
  node(9.4, 4.1, 2.9, 'Claude Haiku', "The Ask assistant's AI model", C.pinkSoft)
  node(9.4, 2.15, 2.9, 'GoatCounter', 'Counts visits, no cookies', C.sky)
  ARROW(4.25, 3.65, 5.3, 2.95, { c: C.pink })
  ARROW(4.25, 4.2, 5.3, 4.85, { c: C.pink })
  ARROW(8.6, 4.88, 9.35, 4.88, { c: C.pink })
  ARROW(8.6, 2.93, 9.35, 2.93, { c: C.pink })
  R(X0, 6.05, XW, 0.55, { fill: '#FFFFFF', lw: 1, r: 0.08 })
  T(X0 + 0.2, 6.05, XW - 0.4, 0.55, [{ runs: [{ t: 'Why: ', b: true }, { t: 'free, nothing to install, no server to look after · ' }, { t: 'ฟรี ไม่ต้องติดตั้ง ไม่ต้องดูแลเซิร์ฟเวอร์', c: MUTED }] }], { va: 'middle', ls: 0.8, name: 'Why' })
}

// 11. Plan vs what happened
newSlide('band', 'Plan vs what happened', 'แผนกับสิ่งที่เกิดขึ้นจริง')
{
  const wk = [
    ['Week 1', '3D viewer working on sample rooms', C.pinkSoft],
    ['Week 2', 'Tracing tool and data checks', C.lilac],
    ['Week 3', 'Photos, walk each floor, interviews', C.mint],
    ['Week 4', 'QR codes, Thai and English polish, publish', C.butter],
    ['Fri 20 Nov', 'Final presentation with a live demo', C.sky],
  ]
  const cw = 2.2
  const gap = (XW - 5 * cw) / 4
  IMG('route-timeline', 0.6, 1.85, 12.1, 0.6, 'Dashed pink route along the timeline')
  wk.forEach(([w, plan, fill], i) => {
    const x = X0 + i * (cw + gap)
    E(x + cw / 2 - 0.17, 2.14, 0.34, 0.34, { fill: C.pink, lw: 1.5 })
    R(x + 0.04, 2.7 + 0.05, cw, 2.0, { fill: C.lilacDeep, line: null })
    R(x, 2.7, cw, 2.0, { fill: '#FFFFFF' })
    R(x, 2.7, cw, 0.5, { fill, shape: 'top' })
    T(x + 0.15, 2.7, cw - 0.3, 0.5, [{ t: w, f: 'K', s: 20, b: true }], { va: 'middle', name: 'Week' })
    T(x + 0.15, 3.27, cw - 0.3, 1.38, [plan], { ls: 0.78, name: 'Plan' })
    slot(x, 4.9, cw, 1.7, '[Actual: what happened]', { name: 'Actual slot', ls: 0.8 })
  })
}

// 12. Team and roles
newSlide('band', 'Team and roles', 'ทีมและบทบาท')
{
  const roles = [
    ['Build', 'สร้างเว็บแอปและแผนที่', C.pinkSoft],
    ['Data and photos', 'ข้อมูลและรูปถ่าย', C.lilac],
    ['Survey and interviews', 'แบบสำรวจและสัมภาษณ์', C.mint],
    ['QR and posters', 'QR และโปสเตอร์', C.butter],
    ['Presentation', 'นำเสนอ', C.sky],
  ]
  const cw = (XW - 0.43) / 3
  const ch = 2.3
  roles.forEach(([en, th, fill], i) => {
    const x = X0 + (i % 3) * (cw + 0.215)
    const y = Y0 + Math.floor(i / 3) * (ch + 0.2)
    const b = card(x, y, cw, ch, en, fill)
    T(b.x, b.y - 0.05, b.w, b.h, [{ t: th, c: MUTED, after: 4 }, '[Member name]', '[Member name]'], { ls: 0.8, name: 'Role card' })
  })
  const x = X0 + 2 * (cw + 0.215)
  const y = Y0 + ch + 0.2
  slot(x, y, cw, ch, '[Add a role if you need one]', { name: 'Spare role', ls: 0.8 })
}

// 13. Results: traffic
newSlide('band', 'Results: traffic', 'ผลลัพธ์: คนเข้าใช้งาน')
{
  const b = card(X0, Y0, XW, 2.4, 'SMART objective and KPI · เป้าหมายและตัวชี้วัด', C.lilac)
  T(b.x, b.y - 0.05, b.w, b.h, [
    { t: 'To publish a bilingual map of all 5 floors of the SIIT Main Building, with QR codes at the main stair and elevator lobbies, and reach [N] visits by the live demo on 20 Nov 2026.', after: 4 },
    { t: 'KPI: [N] page views and [N] QR scans by 20 Nov.', b: true },
  ], { ls: 0.8, name: 'SMART objective' })
  const big = [['[N visits]', 'Page views', 'ผู้เข้าชม'], ['[N QR scans]', 'QR scans', 'จำนวนสแกน QR'], ['[top QR spot]', 'Most scanned spot', 'จุด QR ที่สแกนมากสุด']]
  const bw = (XW - 0.5) / 3
  big.forEach(([n, en, th], i) => {
    const x = X0 + i * (bw + 0.25)
    R(x, 4.4, bw, 1.75, { fill: '#FBF8FE', dash: 'dash', lw: 1.25 })
    T(x + 0.1, 4.5, bw - 0.2, 0.85, [{ t: n, f: 'K', s: 34, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'Big number' })
    T(x + 0.1, 5.3, bw - 0.2, 0.8, [{ t: en, b: true }, { t: th, c: MUTED }], { al: 'center', ls: 0.72, name: 'Big number label' })
  })
  T(X0, 6.22, XW, 0.4, [{ t: 'Source: GoatCounter · ที่มา: GoatCounter', c: MUTED }], { va: 'middle', name: 'Source' })
}

// 14. Results: survey
newSlide('band', 'Results: survey', 'ผลลัพธ์: แบบสำรวจ')
{
  slot(X0, Y0, 8.45, 0.75, '[Survey: N respondents]', { f: 'K', s: 24, b: true, name: 'Respondents' })
  const charts = [['How hard is it to find a room?', 'หาห้องยากแค่ไหน'], ['Did the map help?', 'แผนที่ช่วยได้ไหม'], ['How easy is it to use?', 'ใช้ง่ายแค่ไหน'], ['Would you recommend it?', 'จะแนะนำต่อไหม']]
  const cw = (8.45 - 0.15) / 2
  charts.forEach(([en, th], i) => {
    const x = X0 + (i % 2) * (cw + 0.15)
    const y = Y0 + 0.9 + Math.floor(i / 2) * 2.0
    R(x, y, cw, 1.9, { fill: '#FFFFFF', lw: 1 })
    T(x + 0.15, y + 0.05, cw - 0.3, 0.75, [{ t: en, b: true }, { t: th, c: MUTED }], { ls: 0.72, name: 'Chart label' })
    slot(x + 0.15, y + 0.85, cw - 0.3, 0.9, '[chart]', { name: 'Chart slot' })
  })
  IMG('qr-survey', 9.0, 1.7, 3.6, 3.6, 'QR code for the survey')
  T(9.1, 5.35, 3.5, 1.3, [{ t: 'Tell us what you think', f: 'K', s: 20, b: true }, { t: 'บอกเราว่าคิดอย่างไร', c: MUTED }], { al: 'center', ls: 0.8, name: 'Survey QR label' })
}

// 15. Working with others
newSlide('band', 'Working with others', 'ทำงานร่วมกับคนอื่น')
{
  const items = [
    ['SIIT staff · เจ้าหน้าที่ SIIT', 'Approval for QR posters before they go on walls', 'ขออนุมัติก่อนติดโปสเตอร์ QR บนผนัง', '[Who approved, and when]', C.lilac],
    ['Survey respondents · ผู้ตอบแบบสำรวจ', 'People who answered our survey', 'คนที่ตอบแบบสำรวจของเรา', '[N respondents, who they are]', C.mint],
    ['Booth visitors · ผู้มาเยี่ยมบูธ', 'People who stopped by our exhibition booth', 'คนที่แวะมาที่บูธของเรา', '[N visitors, what they said]', C.butter],
    ['Feedback · ความเห็นที่ได้รับ', 'What people told us, and what we changed', 'สิ่งที่ผู้คนบอกเรา และสิ่งที่เราปรับ', '[Feedback and the change it led to]', C.pinkSoft],
  ]
  const cw = (XW - 0.25) / 2
  items.forEach(([title, en, th, ph, fill], i) => {
    const x = X0 + (i % 2) * (cw + 0.25)
    const y = Y0 + Math.floor(i / 2) * 2.5
    const b = card(x, y, cw, 2.3, title, fill)
    T(b.x, b.y - 0.07, b.w, b.h, [{ t: en, b: true }, { t: th, c: MUTED, after: 4 }, ph], { ls: 0.75, name: 'Others card' })
  })
}

// 16. Challenges and lessons
newSlide('band', 'Challenges and lessons', 'อุปสรรคและบทเรียน')
{
  for (let i = 0; i < 3; i++) {
    const y = Y0 + i * 1.65
    const cw = 5.3
    const a = card(X0, y, cw, 1.5, `Challenge ${i + 1} · อุปสรรค`, C.pinkSoft)
    T(a.x, a.y - 0.05, a.w, 0.8, ['[What went wrong]'], { va: 'middle', name: 'Challenge' })
    ARROW(X0 + cw + 0.12, y + 0.95, XR - cw - 0.12, y + 0.95, { c: C.pink })
    const b = card(XR - cw, y, cw, 1.5, 'Fix and lesson · วิธีแก้', C.mint)
    T(b.x, b.y - 0.05, b.w, 0.8, ['[What we did]', '[What we learned]'], { va: 'middle', ls: 0.75, name: 'Fix' })
  }
}

// 17. Civic engagement
newSlide('band', 'Civic engagement', 'ความเป็นพลเมือง')
{
  const cw = (XW - 0.43) / 3
  const q = [
    ['Self-dependence', 'People find their own way instead of asking someone.', 'พึ่งตนเอง: ทุกคนหาทางเองได้ โดยไม่ต้องถามใคร', C.pinkSoft],
    ['Respect for equality', 'Thai and non-Thai speakers get the same access.', 'เคารพความเท่าเทียม: คนไทยและต่างชาติเข้าถึงข้อมูลได้เท่ากัน', C.lilac],
    ['[Another quality]', '[How the project touches it]', '', C.mint],
  ]
  q.forEach(([title, en, th, fill], i) => {
    const x = X0 + i * (cw + 0.215)
    const b = card(x, Y0, cw, 3.1, title, fill)
    T(b.x, b.y - 0.05, b.w, b.h, th ? [{ t: en, b: true, after: 6 }, { t: th, c: MUTED }] : [en], { ls: 0.8, name: 'Quality' })
  })
  R(X0 + 0.04, 5.15 + 0.05, XW, 1.45, { fill: C.lilacDeep, line: null })
  R(X0, 5.15, XW, 1.45, { fill: '#FBF8FE', dash: 'dash', lw: 1.25 })
  T(X0 + 0.25, 5.2, XW - 0.5, 1.35, [{ t: 'Our reflection · สิ่งที่เราได้เรียนรู้', f: 'K', s: 20, b: true }, '[Reflection: what the group learned about helping the community]'], { va: 'middle', ls: 0.8, name: 'Reflection' })
}

// 18. What's next
newSlide('band', "What's next", 'ก้าวต่อไป')
{
  const nx = [
    ['Keep the data current', 'ดูแลข้อมูลให้ทันสมัย', '[Who updates it, and how often]', C.pinkSoft],
    ['More QR spots', 'เพิ่มจุด QR', '[Where, and who approves]', C.lilac],
    ['Other SIIT buildings', 'ตึกอื่นของ SIIT', '[Which building first]', C.mint],
    ['Handover', 'ส่งต่อให้คนดูแลต่อ', '[Who takes it over]', C.butter],
  ]
  IMG('route-next', 0.6, 1.8, 1.2, 4.9, 'Dashed pink route down the list')
  nx.forEach(([en, th, ph, fill], i) => {
    const y = Y0 + i * 1.22
    E(0.93, y + 0.28, 0.5, 0.5, { fill: C.pink, lw: 1.5 })
    T(0.93, y + 0.28, 0.5, 0.5, [{ t: String(i + 1), f: 'K', s: 20, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'Stop number' })
    R(1.85 + 0.04, y + 0.05, XR - 1.85, 1.06, { fill: C.lilacDeep, line: null })
    R(1.85, y, XR - 1.85, 1.06, { fill: '#FFFFFF' })
    R(1.85, y, 0.18, 1.06, { fill, line: C.ink, lw: 1, r: 0 })
    T(2.3, y + 0.04, 5.9, 0.98, [{ t: en, f: 'K', s: 22, b: true }, { t: th, c: MUTED }], { va: 'middle', ls: 0.75, name: 'Next step' })
    T(8.3, y + 0.04, XR - 8.5, 0.98, [ph], { va: 'middle', ls: 0.8, name: 'Next detail' })
  })
}

// 19. Thank you
newSlide('band', 'Thank you · Q&A', 'ขอบคุณที่รับฟัง · ช่วงถามตอบ')
{
  IMG('qr-site-b', 1.0, 1.75, 3.7, 3.7, 'QR code for ' + URL_APP)
  IMG('qr-survey-b', 7.3, 1.75, 3.7, 3.7, 'QR code for the survey')
  T(1.0, 5.6, 3.7, 1.1, [{ t: 'Try it', f: 'K', s: 24, b: true }, { t: 'ลองใช้เลย', f: 'K', s: 20, b: true, c: MUTED }], { ls: 0.85, al: 'center', name: 'QR label' })
  T(7.05, 5.6, 4.2, 1.1, [{ t: 'Tell us what you think', f: 'K', s: 24, b: true }, { t: 'บอกเราว่าคิดอย่างไร', f: 'K', s: 20, b: true, c: MUTED }], { ls: 0.85, al: 'center', name: 'QR label' })
  chipBox(4.65, 3.45, 2.7, 0.6, C.mint, [{ t: '[Group name]', f: 'K', s: 20, b: true }], { name: 'Group name' })
}

// ---------------------------------------------------------------- decoration assets (SVG at 100 units per inch)
const U = 100
const BAND = { band: 168, cover: 455 }
function bgSvg(kind) {
  const W = SW * U
  const H = SH * U
  const bb = BAND[kind]
  let ticks = ''
  for (let x = 44; x < W - 44; x += 9) ticks += `M${x} ${bb}v${-((x - 44) % 45 === 0 ? 13 : 6)}`
  const dec = kind === 'band'
    ? `<g transform="translate(1030 62) scale(2.6)">${block(0, 0, 8, C.butter)}${block(16, 7, 5.4, C.mint)}</g>
       <g transform="translate(905 92) scale(2.2)">${block(0, 0, 6, C.sky)}${block(11, 4, 4, C.pinkSoft)}</g>
       ${mark(1210, 72, 9)}${mark(985, 58, 7, C.ink)}${mark(1250, 128, 6, C.ink)}${mark(860, 70, 6)}`
    : `${mark(850, 60, 10)}${mark(780, 400, 8, C.ink)}${mark(1040, 420, 9)}
       <g transform="translate(840 345) scale(2.6)">${block(0, 0, 8, C.butter)}${block(16, 7, 5.4, C.mint)}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="2.1" fill="${C.lilacDot}" fill-opacity="0.75"/></pattern>
      <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M14 0V14H0" fill="none" stroke="${C.rule}" stroke-width="0.8"/></pattern>
      <clipPath id="inner"><rect x="38" y="38" width="${W - 76}" height="${H - 76}" rx="20"/></clipPath>
    </defs>
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="36" fill="${C.pink}" stroke="${C.ink}" stroke-width="2.6"/>
    <rect x="38" y="38" width="${W - 76}" height="${H - 76}" rx="20" fill="${C.paper}" stroke="${C.ink}" stroke-width="2"/>
    <g clip-path="url(#inner)">
      <rect x="38" y="${bb}" width="${W}" height="${H}" fill="url(#grid)"/>
      <rect x="38" y="38" width="${W}" height="${bb - 38}" fill="${C.lilac}"/>
      <rect x="38" y="38" width="${W}" height="${bb - 38}" fill="url(#dots)"/>
      <path d="M38 ${bb}H${W - 38}" stroke="${C.ink}" stroke-width="2"/>
      <path d="${ticks}" stroke="${C.ink}" stroke-width="1.1"/>
    </g>
    ${dec}
  </svg>`
}

const wrap = (wIn, hIn, vb, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${wIn * U}" height="${hIn * U}">${inner}</svg>`

function qrSvg(url, sideIn, wIn) {
  const { d, size } = qrPaths(url)
  const card = sideIn * U
  const P = (wIn * U - card) / 2
  const pad = 7
  const q = card - 2 * pad
  const frameK = 1.5
  const cx = P + card / 2
  return wrap(wIn, wIn, `0 0 ${wIn * U} ${wIn * U}`, `
    <rect x="${P + 4}" y="${P + 5}" width="${card}" height="${card}" rx="9" fill="${C.lilacDeep}"/>
    <rect x="${P}" y="${P}" width="${card}" height="${card}" rx="9" fill="#fff" stroke="${C.ink}" stroke-width="2"/>
    <svg x="${P + pad}" y="${P + pad}" width="${q}" height="${q}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>
    <g transform="translate(${cx} ${cx}) scale(${frameK})">${scanFrame(-card / 2 / frameK, -card / 2 / frameK, card / frameK, card / frameK, 12 / frameK, 40 / frameK)}</g>`)
}

function routeSvg(pts, box, o = {}) {
  // Smooth dashed route through pts (slide inches), drawn into the asset box [x, y, w, h] (inches).
  const [bx, by, bw, bh] = box
  const P = pts.map(([x, y]) => [(x - bx) * U, (y - by) * U])
  let d = `M${P[0][0]} ${P[0][1]}`
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1]
    const [x1, y1] = P[i]
    d += o.vertical ? `C${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2} ${x1} ${y1}` : `C${(x0 + x1) / 2} ${y0} ${(x0 + x1) / 2} ${y1} ${x1} ${y1}`
  }
  const [lx, ly] = P[P.length - 1]
  const tri = o.vertical ? `M${lx - 11} ${ly - 4}L${lx} ${ly + 14}L${lx + 11} ${ly - 4}Z` : `M${lx - 4} ${ly - 11}L${lx + 14} ${ly}L${lx - 4} ${ly + 11}Z`
  return wrap(bw, bh, `0 0 ${bw * U} ${bh * U}`, `
      <path d="${d}" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="${C.pink}" stroke-width="6" stroke-dasharray="15 11" stroke-linecap="round"/>
      <path d="${tri}" fill="${C.pink}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
      ${o.pin ? pin(P[0][0], P[0][1] - 12, 14, 0, 5) : ''}`)
}

const slab = (cx, cy, w, h, t, top, side) => {
  const tp = `M${cx - w / 2} ${cy}L${cx} ${cy - h / 2}L${cx + w / 2} ${cy}L${cx} ${cy + h / 2}Z`
  const sd = `M${cx - w / 2} ${cy}L${cx} ${cy + h / 2}L${cx + w / 2} ${cy}V${cy + t}L${cx} ${cy + h / 2 + t}L${cx - w / 2} ${cy + t}Z`
  return `<path d="${sd}" fill="${side}" stroke="${C.ink}" stroke-width="0.5" stroke-linejoin="round"/><path d="${tp}" fill="${top}" stroke="${C.ink}" stroke-width="0.5" stroke-linejoin="round"/>`
}
const icoSt = `fill="none" stroke="${C.ink}" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"`
const ICONS = {
  search: (m) => chipIcon('search', 0, 0) + m,
  stairs: (m) => chipIcon('stairs', 0, 0) + m,
  lang: (m) => chipIcon('lang', 0, 0) + m,
  floors: () => slab(0, 1.6, 4.6, 1.8, 0.5, C.lilac, C.lilacDot) + slab(0, 0.2, 4.6, 1.8, 0.5, C.lilac, C.lilacDot) + slab(0, -1.2, 4.6, 1.8, 0.5, C.pink, '#C21E78'),
  qr: () => `<path d="M-2.4 -1.2V-2.4H-1.2M1.2 -2.4H2.4V-1.2M2.4 1.2V2.4H1.2M-1.2 2.4H-2.4V1.2" ${icoSt} stroke-width="0.6"/><rect x="-1.5" y="-1.5" width="1.2" height="1.2" fill="${C.ink}"/><rect x="0.3" y="-1.5" width="1.2" height="1.2" fill="${C.ink}"/><rect x="-1.5" y="0.3" width="1.2" height="1.2" fill="${C.ink}"/>${pin(0.9, 0.7, 0.75, 0, 0.3)}`,
  chat: () => `<path d="M-2.3 -2h4.6a0.5 0.5 0 0 1 0.5 0.5v3a0.5 0.5 0 0 1-0.5 0.5h-2.8l-1.5 1.4v-1.4h-0.3a0.5 0.5 0 0 1-0.5-0.5v-3a0.5 0.5 0 0 1 0.5-0.5z" fill="#fff" stroke="${C.ink}" stroke-width="0.5" stroke-linejoin="round"/><circle cx="-1" cy="0" r="0.28" fill="${C.ink}"/><circle cx="0" cy="0" r="0.28" fill="${C.ink}"/><circle cx="1" cy="0" r="0.28" fill="${C.ink}"/>`,
}
const iconSvg = (n) => wrap(0.54, 0.54, '-3.1 -3.1 6.2 6.2', ICONS[n]('')).replace('<svg ', '<svg overflow="visible" ')

function phoneSvg(shot) {
  const PW = 150
  const SWp = PW - 18
  const SHp = (SWp * 844) / 390
  const PH = SHp + 29
  return wrap(2.2, (2.2 * (PH + 4)) / (PW + 4), `0 0 ${PW + 4} ${PH + 4}`, `
    <defs><clipPath id="screen"><rect x="9" y="20" width="${SWp}" height="${SHp}" rx="9"/></clipPath></defs>
    <rect x="2.6" y="3" width="${PW}" height="${PH}" rx="20" fill="${C.lilacDeep}"/>
    <rect x="0" y="0" width="${PW}" height="${PH}" rx="20" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>
    <rect x="${PW / 2 - 14}" y="7" width="28" height="4.4" rx="2.2" fill="${C.ink}"/>
    <image x="9" y="20" width="${SWp}" height="${SHp}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen)" href="data:image/png;base64,${shot}"/>
    <rect x="9" y="20" width="${SWp}" height="${SHp}" rx="9" fill="none" stroke="${C.ink}" stroke-width="0.7"/>`)
}

function tileSvg(wIn, hIn) {
  const W = wIn * U
  const H = hIn * U
  let ticks = ''
  for (let x = 18; x < W - 14; x += 9) ticks += `M${x} ${H - 2}v${-((x - 18) % 45 === 0 ? 13 : 6)}`
  return wrap(wIn, hIn, `0 0 ${W} ${H}`, `
    <defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="2.1" fill="${C.lilacDot}" fill-opacity="0.75"/></pattern><clipPath id="c"><rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14"/></clipPath></defs>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="${C.lilac}"/>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="url(#dots)"/>
    <g clip-path="url(#c)"><path d="${ticks}" stroke="${C.ink}" stroke-width="1.1"/><path d="M0 ${H - 2}H${W}" stroke="${C.ink}" stroke-width="2"/></g>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="none" stroke="${C.ink}" stroke-width="2"/>`)
}

const icebergSvg = () => wrap(2.1, 1.45, '0 0 210 145', `
  <rect x="0" y="52" width="210" height="93" rx="10" fill="${C.sky}" fill-opacity="0.55" stroke="${C.ink}" stroke-width="1.6"/>
  <path d="M20 55L70 6L92 28L112 14L170 55Z" fill="#fff" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M20 55L48 128L110 140L170 112L198 55Z" fill="${C.lilac}" fill-opacity="0.9" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M0 52H210" stroke="${C.ink}" stroke-width="2" stroke-dasharray="7 5"/>
  ${mark(190, 30, 8)}`)

const stackSvg = () => wrap(3.5, (3.5 * 34) / 38, '-1 -2.5 38 34', `${floorStack(topFloor, 0, 0, topFloor)}${pin(14, 3.2, 2.05, 0, 0.8)}`)


// ---------------------------------------------------------------- render the decoration PNGs
const shot = readFileSync(join(root, 'scripts/assets/intro-phone.png')).toString('base64')
const q0 = realQr[0]
const miniSvg = wrap(1.8, (1.8 * 56) / 62, '0 0 62 56', miniMap(data, q0, 0.5, 0.5, 60, 54, 0))
const A = {
  'bg-band': { svg: bgSvg('band'), dpr: 2 },
  'bg-cover': { svg: bgSvg('cover'), dpr: 2 },
  'floor-stack-hero': { svg: stackSvg() },
  'route-cover': { svg: routeSvg([[0.7, 2.2], [0.66, 3.8], [0.72, 5.55]], [0.55, 1.95, 0.6, 4.2], { vertical: true, pin: true }) },
  'route-agenda': { svg: routeSvg([[1.675, 2.85], [3.671, 2.65], [5.667, 2.85], [7.663, 2.65], [9.659, 2.85], [11.655, 2.65], [12.3, 2.7]], [0.6, 2.2, 12.1, 1.1]) },
  'route-timeline': { svg: routeSvg([[1.85, 2.31], [4.2575, 2.31], [6.665, 2.31], [9.0725, 2.31], [11.48, 2.31], [12.4, 2.31]], [0.6, 1.85, 12.1, 0.6]) },
  'route-next': { svg: routeSvg([[1.18, 2.0], [1.18, 3.57], [1.18, 4.79], [1.18, 6.01], [1.18, 6.45]], [0.6, 1.8, 1.2, 4.9], { vertical: true }) },
  iceberg: { svg: icebergSvg() },
  phone: { svg: phoneSvg(shot) },
  'mini-map': { svg: miniSvg },
  'tile-diagram': { svg: tileSvg(XW, 4.1) },
  'qr-site': { svg: qrSvg(URL_APP, 3.8, 4.4) },
  'qr-survey': { svg: qrSvg(URL_SURVEY, 3.0, 3.6) },
  'qr-site-b': { svg: qrSvg(URL_APP, 3.1, 3.7) },
  'qr-survey-b': { svg: qrSvg(URL_SURVEY, 3.1, 3.7) },
  ...Object.fromEntries(['floors', 'search', 'stairs', 'qr', 'lang', 'chat'].map((n) => [`icon-${n}`, { svg: iconSvg(n), dpr: 4 }])),
}
const loadFonts = (page) => page.evaluate(() => Promise.all(['500 20px Kanit', '700 20px Kanit', '800 20px Kanit', '500 20px Plex', '600 20px Plex'].map((f) => document.fonts.load(f, 'Aก1'))))
const browser = await chromium.launch({ channel: 'chrome' })
const ctxs = {}
const ctxFor = async (dpr) => (ctxs[dpr] ??= await browser.newContext({ deviceScaleFactor: dpr }))
async function renderPng(html, wPx, hPx, dpr) {
  const page = await (await ctxFor(dpr)).newPage()
  await page.setViewportSize({ width: Math.ceil(wPx), height: Math.ceil(hPx) })
  await page.setContent(`<!doctype html><style>${fonts} html,body{margin:0;background:transparent}svg{display:block}</style>${html}`)
  await loadFonts(page)
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: wPx, height: hPx } })
  await page.close()
  return buf
}
const PNG = {}
for (const [name, a] of Object.entries(A)) {
  const m = /width="([\d.]+)" height="([\d.]+)"/.exec(a.svg)
  PNG[name] = await renderPng(a.svg, Number(m[1]), Number(m[2]), a.dpr ?? 3)
}
// Cover title: the lilac 3D extrusion as a picture layer; the title itself stays editable ink text on top (same box, same font).
{
  const sh = (i, col) => `${(i * 0.0121).toFixed(4)}em ${(i * 0.0121).toFixed(4)}em 0 ${col}`
  const shadows = [1, 2, 3, 4, 5].map((i) => sh(i, C.lilacDeep)).concat(sh(6, C.ink)).join(',')
  PNG['title-extrusion'] = await renderPng(
    `<div style="width:${7.7 * 96}px;height:${2.3 * 96}px;font:700 ${110 * (96 / 72)}px/1.5 Kanit;color:transparent;text-shadow:${shadows};white-space:nowrap">SIIT Map</div>`,
    7.7 * 96, 2.3 * 96, 3)
}
const b64 = (n) => PNG[n].toString('base64')

// ---------------------------------------------------------------- footer and slide numbers (layout data, then both outputs)
const FOOT = 'SIIT Map · TU100 student project, SIIT, Thammasat University · Not an official SIIT service'
slides.forEach((s, i) => {
  if (s.bg !== 'band') return
  s.els.push({ k: 'text', x: X0, y: 6.82, w: 10.4, h: 0.26, ps: [{ runs: [{ t: FOOT, f: 'P', s: 10, b: false, c: C.ink }], after: 0 }], al: 'left', va: 'middle', ls: 0.85, name: 'Footer' })
  s.num = i + 1
})
const NUM = { x: 11.68, y: 6.82, w: 0.9, h: 0.26 }

// ---------------------------------------------------------------- PPTX
const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'
pptx.theme = { headFontFace: FONT.K, bodyFontFace: FONT.P }
pptx.title = 'SIIT Map: final presentation template'
pptx.author = 'SIIT Map'
pptx.company = ''
const SHAPE = { round: pptx.ShapeType.roundRect, rect: pptx.ShapeType.rect, top: pptx.ShapeType.round2SameRect, ellipse: pptx.ShapeType.ellipse }
slides.forEach((s) => {
  const sl = pptx.addSlide()
  sl.background = { data: 'image/png;base64,' + b64(s.bg === 'cover' ? 'bg-cover' : 'bg-band') }
  if (s.num) sl.slideNumber = { x: NUM.x, y: NUM.y, w: NUM.w, h: NUM.h, fontFace: FONT.P, fontSize: 11, color: hex(C.ink), align: 'right', valign: 'middle', margin: 0 }
  for (const e of s.els) {
    if (e.k === 'rect') {
      const line = e.line ? { color: hex(e.line), width: e.lw, dashType: e.dash ?? 'solid' } : { type: 'none' }
      sl.addShape(SHAPE[e.shape], { x: e.x, y: e.y, w: e.w, h: e.h, fill: e.fill ? { color: hex(e.fill) } : { type: 'none' }, line, ...(e.shape === 'round' ? { rectRadius: e.r } : {}) })
    } else if (e.k === 'img') {
      sl.addImage({ data: 'image/png;base64,' + b64(e.name), x: e.x, y: e.y, w: e.w, h: e.h, altText: e.alt })
    } else if (e.k === 'line') {
      const w = Math.abs(e.x2 - e.x1)
      const h = Math.abs(e.y2 - e.y1)
      sl.addShape(pptx.ShapeType.line, { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w, h, flipH: e.x2 < e.x1, flipV: e.y2 < e.y1, line: { color: hex(e.c), width: e.lw, dashType: e.dash ?? 'solid', endArrowType: e.arrow ? 'triangle' : undefined } })
    } else if (e.k === 'text') {
      const runs = []
      e.ps.forEach((p, pi) => p.runs.forEach((r, ri) => {
        runs.push({ text: r.t, options: { fontFace: FONT[r.f], lang: /[฀-๿]/.test(r.t) ? 'th-TH' : 'en-US', fontSize: r.s, bold: r.b, color: hex(r.c), breakLine: ri === p.runs.length - 1 && pi < e.ps.length - 1, paraSpaceAfter: p.after } })
      }))
      sl.addText(runs, { x: e.x, y: e.y, w: e.w, h: e.h, margin: 0, align: e.al, valign: e.va, lineSpacingMultiple: e.ls, fit: 'none', wrap: true, fontFace: FONT[e.ps[0].runs[0].f], objectName: e.name })
    }
  }
})
await pptx.writeFile({ fileName: join(outDir, 'siit-map-final-slides.pptx') })
// PowerPoint's default theme lists a fallback font per script (Arial, Times New Roman, ...) and the master's bullet font is Arial. Drop them so the file names only Kanit and IBM Plex Sans Thai.
{
  const file = join(outDir, 'siit-map-final-slides.pptx')
  const zip = await JSZip.loadAsync(readFileSync(file))
  const theme = (await zip.file('ppt/theme/theme1.xml').async('string')).replace(/<a:font script="[^"]*" typeface="[^"]*"\s*\/>/g, '')
  zip.file('ppt/theme/theme1.xml', theme)
  const master = (await zip.file('ppt/slideMasters/slideMaster1.xml').async('string')).replace(/<a:buFont typeface="Arial"/g, `<a:buFont typeface="${FONT.P}"`)
  zip.file('ppt/slideMasters/slideMaster1.xml', master)
  writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

// ---------------------------------------------------------------- HTML twin: the same layout data drawn by Chrome (thumbnails and checks)
const PX = 144 // px per inch in the twin (1920 x 1080 slide)
const px = (v) => `${(v * PX).toFixed(2)}px`
const FAM = { K: 'Kanit', P: 'Plex' }
const WGT = (f, b) => (f === 'K' ? (b ? 700 : 500) : b ? 600 : 500)
function twinEl(e) {
  if (e.k === 'rect') {
    const rad = e.shape === 'ellipse' ? '50%' : e.shape === 'round' ? px(e.r) : e.shape === 'top' ? `${px(0.1667 * Math.min(e.w, e.h))} ${px(0.1667 * Math.min(e.w, e.h))} 0 0` : '0'
    const bd = e.line ? `${(e.lw * 2).toFixed(1)}px ${e.dash ? 'dashed' : 'solid'} ${e.line}` : 'none'
    return `<div style="position:absolute;box-sizing:border-box;left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};background:${e.fill ?? 'transparent'};border:${bd};border-radius:${rad}"></div>`
  }
  if (e.k === 'img') return `<div class="a a-${e.name}" style="left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)}"></div>`
  if (e.k === 'line') {
    const dx = (e.x2 - e.x1) * PX
    const dy = (e.y2 - e.y1) * PX
    const len = Math.hypot(dx, dy)
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI
    const lw = e.lw * 2
    const ah = 6 + lw * 3
    return `<svg style="position:absolute;left:${px(e.x1)};top:${px(e.y1)};overflow:visible" width="1" height="1"><g transform="rotate(${ang.toFixed(2)})"><line x1="0" y1="0" x2="${(len - (e.arrow ? ah : 0)).toFixed(1)}" y2="0" stroke="${e.c}" stroke-width="${lw}" ${e.dash ? 'stroke-dasharray="8 6"' : ''}/>${e.arrow ? `<path d="M${len - ah} ${-ah / 2}L${len} 0L${len - ah} ${ah / 2}Z" fill="${e.c}"/>` : ''}</g></svg>`
  }
  const ps = e.ps.map((p) => {
    const f0 = p.runs[0].f
    const spans = p.runs.map((r) => `<span style="font-family:${FAM[r.f]};font-weight:${WGT(r.f, r.b)};font-size:${r.s * 2}px;color:${r.c}">${esc(r.t)}</span>`).join('')
    return `<p style="margin:0 0 ${p.after * 2}px;line-height:${(LH[f0] * e.ls).toFixed(3)}">${spans}</p>`
  }).join('')
  const ai = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[e.va]
  return `<div class="tb" data-name="${esc(e.name ?? '')}" style="position:absolute;left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};display:flex;align-items:${ai}"><div class="ti" style="width:100%;text-align:${e.al}">${ps}</div></div>`
}
const assetCss = Object.keys(PNG).map((n) => `.a-${n}{background-image:url(data:image/png;base64,${b64(n)})}`).join('\n')
const secs = slides.map((s, i) => {
  const num = s.num ? `<div class="tb" data-name="Slide number" style="position:absolute;left:${px(NUM.x)};top:${px(NUM.y)};width:${px(NUM.w)};height:${px(NUM.h)};display:flex;align-items:center;justify-content:flex-end"><div class="ti" style="font:500 22px/1.65 Plex;color:${C.ink}"><p style="margin:0;line-height:1.4">${s.num}</p></div></div>` : ''
  return `<section class="s ${s.bg === 'cover' ? 'bg-cover' : 'bg-band'}" id="s${i + 1}">${s.els.map(twinEl).join('')}${num}</section>`
}).join('\n')
const twin = `<!doctype html><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box} body{margin:0;background:#888}
.s{position:relative;width:${SW * PX}px;height:${SH * PX}px;overflow:hidden;margin:0 0 20px;background-size:100% 100%}
.a{position:absolute;background-size:100% 100%;background-repeat:no-repeat}
.bg-band{background-image:url(data:image/png;base64,${b64('bg-band')})}.bg-cover{background-image:url(data:image/png;base64,${b64('bg-cover')})}
${assetCss}</style>${secs}`
writeFileSync(join(prevDir, 'twin.html'), twin)
const page = await (await ctxFor(1)).newPage()
await page.setViewportSize({ width: Math.round(SW * PX), height: Math.round(SH * PX) + 40 })
await page.goto('file:///' + join(prevDir, 'twin.html').replace(/\\/g, '/'))
await loadFonts(page)
await page.evaluate(() => document.fonts.ready)
const report = await page.evaluate(([IN, PXI]) => {
  const out = { overflow: [], outside: [], overlap: [], fonts: [] }
  const fonts = new Set()
  document.querySelectorAll('.s').forEach((sec, si) => {
    const sr = sec.getBoundingClientRect()
    const boxes = []
    sec.querySelectorAll('.tb').forEach((tb) => {
      const ti = tb.querySelector('.ti')
      const name = `slide ${si + 1} ${tb.dataset.name || 'text'}: "${ti.textContent.trim().slice(0, 28)}"`
      const tr = tb.getBoundingClientRect()
      if (ti.offsetHeight > tr.height + 1.5) out.overflow.push(`${name} (needs ${(ti.offsetHeight / PXI).toFixed(2)} in, box ${(tr.height / PXI).toFixed(2)} in)`)
      for (const p of ti.querySelectorAll('p')) if (p.scrollWidth > tr.width + 1) out.overflow.push(`${name} (too wide)`)
      const rg = document.createRange()
      rg.selectNodeContents(ti)
      const rects = [...rg.getClientRects()].filter((r) => r.width > 1)
      const l = Math.min(...rects.map((r) => r.left)) - sr.left
      const r = Math.max(...rects.map((r) => r.right)) - sr.left
      const t = Math.min(...rects.map((r) => r.top)) - sr.top
      const b = Math.max(...rects.map((r) => r.bottom)) - sr.top
      if (l < IN.l * PXI - 1 || r > IN.r * PXI + 1 || t < IN.t * PXI - 1 || b > IN.b * PXI + 1) out.outside.push(name)
      boxes.push({ name, l, r, t, b })
      for (const s of ti.querySelectorAll('span')) fonts.add(getComputedStyle(s).fontFamily.split(',')[0].replace(/["']/g, ''))
    })
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      const w = Math.min(a.r, c.r) - Math.max(a.l, c.l)
      const h = Math.min(a.b, c.b) - Math.max(a.t, c.t)
      if (w > 4 && h > 0.1 * PXI) out.overlap.push(`${a.name}  x  ${c.name}`)
    }
  })
  out.fonts = [...fonts]
  return out
}, [{ l: IN_L, r: IN_R, t: IN_T, b: IN_B }, PX])
for (let i = 0; i < slides.length; i++) {
  const el = await page.$(`#s${i + 1}`)
  await el.screenshot({ path: join(prevDir, `slide-${String(i + 1).padStart(2, '0')}.png`) })
}
// Contact sheet: 4 columns of thumbnails.
{
  const imgs = slides.map((s, i) => `<figure><img src="data:image/png;base64,${readFileSync(join(prevDir, `slide-${String(i + 1).padStart(2, '0')}.png`)).toString('base64')}"><figcaption>${String(i + 1).padStart(2, '0')} ${esc(s.title ?? 'Cover')}</figcaption></figure>`).join('')
  const cp = await (await ctxFor(1)).newPage()
  await cp.setViewportSize({ width: 2000, height: 1700 })
  await cp.setContent(`<style>${fonts}body{margin:0;padding:16px;background:#fff;font-family:Plex}.g{display:grid;grid-template-columns:repeat(4,480px);gap:14px 14px}figure{margin:0}img{width:480px;height:270px;display:block;border:1px solid #1D161E}figcaption{font:500 15px Plex;color:#594C5B;margin-top:3px}</style><div class="g">${imgs}</div>`)
  await cp.evaluate(() => Promise.all([...document.images].map((im) => im.decode())))
  await (await cp.$('.g')).screenshot({ path: join(prevDir, 'contact.png') })
  await cp.close()
}
await browser.close()
writeFileSync(join(prevDir, 'twin-check.json'), JSON.stringify(report, null, 1))
console.log(`print/siit-map-final-slides.pptx: ${slides.length} slides (${tracedFloors} floors, ${roomCount} rooms, ${qrCount} QR points); thumbnails in print/slides-preview/`)
console.log(`twin check: overflow ${report.overflow.length}, outside frame ${report.outside.length}, overlap ${report.overlap.length}; fonts ${report.fonts.join(', ')}`)
for (const k of ['overflow', 'outside', 'overlap']) for (const m of report[k]) console.log(`  ${k}: ${m}`)
