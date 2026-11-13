// Progress-update deck, 13 Nov 2026: npm run progress-slides
//   -> print/siit-map-progress-2026-11-13.pptx (git-ignored), 7 slides, 16:9, English only, meant for Canva import.
//   -> print/progress-preview/slide-NN.png and contact.png.
// Same design family and build approach as scripts/slides-template.mjs (see its header): native editable text boxes
// (Kanit and IBM Plex Sans Thai only), decoration as transparent PNGs, an HTML twin that Chrome renders for the
// thumbnails and the overlap / overflow report. Counts come from src/data/building.json; traffic and survey numbers
// are typed from the brief and never scaled. Check the finished file with: node scripts/progress-slides-check.mjs
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, esc, qrPaths, pin, block, mark, scanFrame, floorStack, chipIcon, fonts } from './poster-kit.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'print')
const prevDir = join(outDir, 'progress-preview')
const OUT = join(outDir, 'siit-map-progress-2026-11-13.pptx')
mkdirSync(prevDir, { recursive: true })
const data = JSON.parse(readFileSync(join(root, 'src/data/building.json'), 'utf8'))

const URL_APP = 'https://ryusakichan.github.io/siit-map/'

// Numbers come from the data, never typed by hand. Rooms exclude lifts and stairs; QR spots are all real (non-sample) points.
const floorCount = data.floors.length
const roomCount = data.rooms.filter((r) => !r.sample && r.type !== 'stairs' && r.type !== 'elevator').length
const qrCount = data.qrPoints.filter((q) => !q.sample).length
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
const newSlide = (bg, title, sub) => {
  els = []
  const s = { bg, els, title }
  slides.push(s)
  if (bg === 'band') {
    T(0.95, sub ? 0.42 : 0.55, 10.4, 0.72, [{ t: title, f: 'K', s: 34, b: true }], { name: 'Title', va: 'middle' })
    if (sub) T(0.95, 1.1, 10.4, 0.45, [{ t: sub, f: 'K', s: 20, c: MUTED }], { name: 'Subtitle', va: 'middle' })
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

const bar = (x, y, w, frac, fill = C.pink) => {
  R(x, y, w, 0.28, { fill: '#FFFFFF', lw: 1, r: 0.05 })
  R(x, y, Math.max(0.14, w * frac), 0.28, { fill, lw: 1, r: 0.05 })
}
const shadowBox = (x, y, w, h, fill = '#FFFFFF', o = {}) => {
  R(x + 0.04, y + 0.05, w, h, { fill: C.lilacDeep, line: null })
  R(x, y, w, h, { fill, ...o })
}

// 1. Cover
newSlide('cover')
IMG('title-extrusion', 0.95, 0.6, 7.7, 1.9, 'Lilac 3D extrusion behind the title')
T(0.95, 0.6, 7.7, 1.9, [{ t: 'SIIT Map:', f: 'K', s: 88, b: true }], { name: 'Title', ls: 1 })
T(0.95, 2.45, 8.0, 1.05, [{ t: 'progress update', f: 'K', s: 48, b: true }], { name: 'Title (second line)', ls: 1 })
T(0.95, 3.5, 7.2, 0.95, [{ t: 'Find any room, office or facility from your phone. No app to install.', s: 20, b: true }], { name: 'Hook', ls: 0.9 })
IMG('floor-stack-hero', 9.1, 0.9, 3.5, 3.13, 'The five floors stacked like the 3D map, with a pin on the top floor')
IMG('route-cover', 0.55, 1.95, 0.6, 4.2, 'Dashed pink walking route')
chipBox(1.35, 4.95, 8.3, 0.62, C.lilacDeep, [{ t: 'TU100 Civic Engagement, section 1 · 13 Nov 2026', f: 'K', s: 20, b: true }], { name: 'Course line' })
chipBox(1.35, 5.75, 3.6, 0.62, C.mint, [{ t: 'Group 5 TU100 Project', f: 'K', s: 20, b: true }], { name: 'Group name' })

// 2. Where we are
newSlide('band', 'Where we are')
{
  const wk = [
    ['Week 1', '30 Oct–5 Nov', ['Viewer live', 'Real floors'], C.pinkSoft],
    ['Week 2', '6–12 Nov', ['Exhibition booth on 6 Nov', 'Survey', 'Compass'], C.lilac],
    ['Week 3', '13–19 Nov', ['Landing QR posters', 'Polish', 'Rehearsal'], C.mint],
    ['Final demo', 'Fri 20 Nov', ['Live demo of SIIT Map'], C.butter],
  ]
  const cw = 2.77
  const gap = (XW - 4 * cw) / 3
  IMG('route-timeline', 0.6, 2.2, 12.1, 0.7, 'Dashed pink route along the timeline')
  wk.forEach(([w, dates, items, fill], i) => {
    const x = X0 + i * (cw + gap)
    const here = i === 2
    E(x + cw / 2 - (here ? 0.24 : 0.17), 2.55 - (here ? 0.24 : 0.17), here ? 0.48 : 0.34, here ? 0.48 : 0.34, { fill: C.pink, lw: 1.5 })
    shadowBox(x, 3.0, cw, 3.45)
    R(x, 3.0, cw, 0.5, { fill, shape: 'top' })
    T(x + 0.15, 3.0, cw - 0.3, 0.5, [{ t: w, f: 'K', s: 20, b: true }], { va: 'middle', name: 'Stop title' })
    T(x + 0.15, 3.62, cw - 0.3, 0.4, [{ t: dates, f: 'K', s: 18, b: true, c: MUTED }], { va: 'middle', name: 'Dates' })
    T(x + 0.15, 4.12, cw - 0.3, 2.25, items.map((t) => ({ t, s: 20, after: 6 })), { ls: 0.85, name: 'Stop text' })
    if (here) R(x, 3.0, cw, 3.45, { fill: null, line: C.pink, lw: 3 })
  })
  const hx = X0 + 2 * (cw + gap) + cw / 2
  R(hx - 1.0, 1.78, 2.0, 0.44, { fill: C.pink, lw: 1.5, r: 0.1 })
  T(hx - 1.0, 1.78, 2.0, 0.44, [{ t: 'We are here', f: 'K', s: 18, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'We are here' })
  ARROW(hx, 2.24, hx, 2.3, { c: C.pink })
}

// 3. What's live now
newSlide('band', "What's live now")
{
  IMG('phone', 0.85, 1.92, 2.2, 4.55, 'Phone showing the live SIIT Map app')
  const feats = [
    ['floors', C.lilac, `3D map, all ${floorCount} floors`],
    ['search', C.mint, 'Search'],
    ['stairs', C.lilacDeep, 'Directions with "Avoid stairs"'],
    ['qr', C.pinkSoft, '"You are here" QR'],
    ['lang', C.butter, 'English and Thai'],
    ['chat', C.sky, 'The "Ask" assistant'],
  ]
  const fx = 3.5
  const fw = (XR - fx - 0.2) / 2
  const fh = 0.78
  const fy = (r) => Y0 + r * 0.88
  const feat = (ic, sw, x, y, w, paras, tw = w - 1.0) => {
    shadowBox(x, y, w, fh, '#FFFFFF', { lw: 0.75 })
    R(x + 0.12, y + 0.07, 0.64, 0.64, { fill: sw, lw: 0.75, r: 0.08 })
    IMG('icon-' + ic, x + 0.17, y + 0.12, 0.54, 0.54, ic + ' icon')
    T(x + 0.92, y + 0.02, tw, fh - 0.04, paras, { va: 'middle', ls: 0.8, name: 'Feature' })
  }
  feats.forEach(([ic, sw, en], i) => feat(ic, sw, fx + (i % 2) * (fw + 0.2), fy(Math.floor(i / 2)), fw, [{ t: en, f: 'K', s: 18, b: true }]))
  feat('compass', C.pinkSoft, fx, fy(3), XR - fx, [{ t: 'Live compass direction', f: 'K', s: 18, b: true }, { t: 'Built from survey feedback', c: MUTED }], XR - fx - 2.1)
  R(XR - 1.1, fy(3) + 0.17, 0.9, 0.44, { fill: C.pink, lw: 1.5, r: 0.1 })
  T(XR - 1.1, fy(3) + 0.17, 0.9, 0.44, [{ t: 'NEW', f: 'K', s: 18, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'New badge' })
  const stats = [[String(roomCount), 'rooms and facilities'], [String(qrCount), 'QR spots'], [String(floorCount), 'floors']]
  const sw3 = (XR - fx - 0.4) / 3
  stats.forEach(([n, en], i) => {
    const x = fx + i * (sw3 + 0.2)
    shadowBox(x, 5.4, sw3, 1.2, '#FBF8FE', { lw: 1 })
    T(x + 0.1, 5.42, sw3 - 0.2, 0.75, [{ t: n, f: 'K', s: 40, b: true }], { al: 'center', ls: 0.9, name: 'Live count' })
    T(x + 0.1, 6.15, sw3 - 0.2, 0.4, [{ t: en, b: true }], { al: 'center', va: 'middle', ls: 0.8, name: 'Count label' })
  })
}

// 4. Getting it to people
newSlide('band', 'Getting it to people')
{
  const rows = [['Exhibition booth, 6 Nov', C.lilac], ['QR posters in the building', C.mint], ['Instagram posts', C.butter]]
  rows.forEach(([t, fill], i) => {
    const y = Y0 + i * 1.62
    shadowBox(X0, y, 4.9, 1.45)
    R(X0, y, 0.18, 1.45, { fill, line: C.ink, lw: 1, r: 0 })
    T(X0 + 0.4, y + 0.05, 4.35, 1.35, [{ t, f: 'K', s: 22, b: true }], { va: 'middle', ls: 0.9, name: 'Channel' })
  })
  const cx = 5.9
  const cw = XR - cx
  const b = card(cx, Y0, cw, 4.78, 'New: stair-landing posters', C.pinkSoft)
  T(b.x, b.y, 3.95, 2.2, [
    { t: 'SIIT staff approved QR posters on the stair-landing notice boards.', s: 20, b: true, after: 8 },
    { t: '5 new spots, going up this week.', s: 20 },
  ], { ls: 0.9, name: 'New posters text' })
  IMG('floor-stack-landings', b.x + 4.15, b.y + 0.05, 2.1, 1.88, 'The five floors stacked, floors 2 to 5 lit for the stair landings')
  T(b.x + 4.0, b.y + 1.95, 2.4, 0.4, [{ t: 'Floors 2 to 5', c: MUTED }], { al: 'center', va: 'middle', name: 'Stack caption' })
  chipBox(b.x, b.y + 2.5, b.w, 0.72, C.pink, [{ runs: [{ t: 'South stairs: ', b: true }, { t: 'between floors 2–3, 3–4 and 4–5' }] }], { name: 'South stairs', ls: 0.85 })
  chipBox(b.x, b.y + 3.3, b.w, 0.72, C.pink, [{ runs: [{ t: 'North stairs: ', b: true }, { t: 'between floors 2–3 and 3–4' }] }], { name: 'North stairs', ls: 0.85 })
}

// 5. Traffic so far
newSlide('band', 'Traffic so far', 'Source: GoatCounter, 29 Oct–13 Nov 2026')
{
  const cw3 = (7.9 - 0.4) / 3
  const big = [
    [0, 0, cw3, '170', 'visits', null, C.lilac],
    [1, 0, cw3, '79%', 'on phones', '134 visits', C.mint],
    [2, 0, cw3, '18', 'visits from QR scans', '14 at the main entrance poster', C.pinkSoft],
    [0, 1, 3.85, '21', 'opens of the Ask assistant', null, C.butter],
    [1, 1, 3.85, '12', 'visits from Instagram', null, C.sky],
  ]
  big.forEach(([c, r, w, n, label, sub, fill]) => {
    const x = r === 0 ? X0 + c * (cw3 + 0.2) : X0 + c * (3.85 + 0.2)
    const y = Y0 + r * 2.48
    shadowBox(x, y, w, 2.36)
    R(x, y, w, 0.2, { fill, shape: 'top', r: 0.07 })
    T(x + 0.1, y + 0.2, w - 0.2, 0.78, [{ t: n, f: 'K', s: 40, b: true }], { al: 'center', va: 'middle', ls: 0.9, name: 'Big number' })
    T(x + 0.12, y + 0.98, w - 0.24, 1.35, [{ t: label, b: true }, ...(sub ? [{ t: sub, c: MUTED }] : [])], { al: 'center', ls: 0.8, name: 'Big number label' })
  })
  const px0 = 8.85
  const b = card(px0, Y0, XR - px0, 4.78, 'Top pages', C.lilac)
  const pages = [['Map home page', '55'], ['Ask', '21'], ['Main entrance QR', '14'], ['About', '9'], ['Registration & Finance room page', '8']]
  pages.forEach(([name, n], i) => {
    const y = b.y + i * 0.8
    T(b.x, y, 2.55, 0.74, [name], { va: 'middle', ls: 0.8, name: 'Page name' })
    T(b.x + 2.55, y, 0.73, 0.74, [{ t: n, f: 'K', s: 24, b: true }], { al: 'right', va: 'middle', ls: 1, name: 'Page visits' })
  })
}

// 6. What users told us
newSlide('band', 'What users told us', 'Survey, 19 responses, as of 6 Nov')
{
  const LW = 6.65
  shadowBox(X0, Y0, LW, 1.35, C.pinkSoft)
  T(X0 + 0.2, Y0 + 0.05, 1.95, 1.25, [{ t: '79%', f: 'K', s: 48, b: true }], { va: 'middle', ls: 0.9, name: 'Big number' })
  T(X0 + 2.2, Y0 + 0.05, LW - 2.4, 1.25, [{ t: 'had trouble finding a room, office or facility in the past month (15 of 19)', s: 20 }], { va: 'middle', ls: 0.85, name: 'Trouble finding' })
  const row = (x, y, w, label, n, of, text, fill) => {
    T(x, y - 0.06, 3.0, 0.4, [label], { va: 'middle', ls: 0.8, name: 'Bar label' })
    bar(x + 3.1, y, w - 3.1 - 0.95, n / of, fill)
    T(x + w - 0.85, y - 0.06, 0.85, 0.4, [{ t: text, f: 'K', s: 18, b: true }], { al: 'right', va: 'middle', ls: 0.9, name: 'Bar value' })
  }
  const b1 = card(X0, 3.3, LW, 1.7, 'How they find rooms', C.mint)
  row(b1.x, b1.y + 0.1, b1.w, 'Walking around', 14, 19, '14 of 19', C.pink)
  row(b1.x, b1.y + 0.58, b1.w, 'Asking someone', 12, 19, '12 of 19', C.pink)
  const b2 = card(X0, 5.1, LW, 1.6, 'SIIT Map users', C.sky)
  row(b2.x, b2.y + 0.08, b2.w, 'Had used it', 6, 19, '6 of 19', C.pink)
  row(b2.x, b2.y + 0.52, b2.w, 'Found what they wanted', 4, 6, '4 of 6', C.pink)

  const rx = 7.55
  const RW = XR - rx
  const b3 = card(rx, Y0, RW, 2.4, 'Ratings, out of 5', C.butter)
  ;[['Ease of use', 4.2], ['Would recommend', 3.8]].forEach(([label, v], i) => {
    const y = b3.y + i * 0.88
    T(b3.x, y - 0.04, b3.w - 1.1, 0.4, [label], { va: 'middle', ls: 0.8, name: 'Rating label' })
    T(b3.x + b3.w - 1.1, y - 0.04, 1.1, 0.4, [{ t: v.toFixed(1) + ' / 5', f: 'K', s: 18, b: true }], { al: 'right', va: 'middle', ls: 0.9, name: 'Rating value' })
    bar(b3.x, y + 0.42, b3.w, v / 5, C.pink)
  })
  const b4 = card(rx, 4.35, RW, 2.35, 'One request', C.pinkSoft)
  T(b4.x, b4.y - 0.02, b4.w, b4.h, [
    { t: '"Show where I am and which way I\'m facing"', f: 'K', s: 18, b: true, after: 8 },
    { t: 'We built a live compass for the "You are here" view.' },
  ], { ls: 0.85, name: 'Request' })
}

// 7. Next, to 20 Nov · Thank you
newSlide('band', 'Next, to 20 Nov · Thank you')
{
  const steps = ['Put up the 5 landing posters', 'Push traffic with more posts and posters', 'More survey responses: [target]', 'Fill unknown rooms', 'Rehearse the live demo']
  const fills = [C.pinkSoft, C.lilac, C.mint, C.butter, C.sky]
  steps.forEach((t, i) => {
    const y = Y0 + i * 0.84
    shadowBox(X0, y, 6.9, 0.72)
    R(X0, y, 0.18, 0.72, { fill: fills[i], line: C.ink, lw: 1, r: 0 })
    E(X0 + 0.38, y + 0.14, 0.44, 0.44, { fill: C.pink, lw: 1.5 })
    T(X0 + 0.38, y + 0.14, 0.44, 0.44, [{ t: String(i + 1), f: 'K', s: 18, b: true }], { al: 'center', va: 'middle', ls: 1, name: 'Step number' })
    T(X0 + 1.0, y + 0.02, 5.8, 0.68, [{ t, f: 'K', s: 20, b: true }], { va: 'middle', ls: 0.85, name: 'Next step' })
  })
  chipBox(X0, 6.08, 6.9, 0.58, C.pink, [{ t: 'Final demo: Fri 20 Nov', f: 'K', s: 20, b: true }], { name: 'Final demo' })
  IMG('qr-site', 8.0, 1.5, 4.2, 4.2, 'QR code for ' + URL_APP)
  T(7.8, 5.8, 4.6, 0.55, [{ t: 'Thank you · Questions?', f: 'K', s: 26, b: true }], { al: 'center', va: 'middle', ls: 0.9, name: 'Thank you' })
  T(7.8, 6.3, 4.6, 0.4, [{ t: 'ryusakichan.github.io/siit-map', f: 'K', s: 18, b: true, c: MUTED }], { al: 'center', va: 'middle', ls: 0.9, name: 'Site address' })
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


ICONS.compass = () => `<circle cx="0" cy="0" r="2.6" fill="#fff" stroke="${C.ink}" stroke-width="0.5"/><path d="M0 -2L0.95 0.1H-0.95Z" fill="${C.pink}" stroke="${C.ink}" stroke-width="0.35" stroke-linejoin="round"/><path d="M0 2L0.95 0.1H-0.95Z" fill="${C.lilacDeep}" stroke="${C.ink}" stroke-width="0.35" stroke-linejoin="round"/>`
const stackLandings = () => wrap(2.1, (2.1 * 34) / 38, '-1 -2.5 38 34', floorStack(topFloor, 0, 0, [2, 3, 4, 5]))

// ---------------------------------------------------------------- render the decoration PNGs
const shot = readFileSync(join(root, 'scripts/assets/intro-phone.png')).toString('base64')
const A = {
  'bg-band': { svg: bgSvg('band'), dpr: 2 },
  'bg-cover': { svg: bgSvg('cover'), dpr: 2 },
  'floor-stack-hero': { svg: stackSvg() },
  'floor-stack-landings': { svg: stackLandings() },
  'route-cover': { svg: routeSvg([[0.7, 2.2], [0.66, 3.8], [0.72, 5.55]], [0.55, 1.95, 0.6, 4.2], { vertical: true, pin: true }) },
  'route-timeline': { svg: routeSvg([[2.135, 2.55], [5.155, 2.55], [8.175, 2.55], [11.195, 2.55], [12.4, 2.55]], [0.6, 2.2, 12.1, 0.7]) },
  phone: { svg: phoneSvg(shot) },
  'qr-site': { svg: qrSvg(URL_APP, 3.5, 4.2) },
  ...Object.fromEntries(['floors', 'search', 'stairs', 'qr', 'lang', 'chat', 'compass'].map((n) => [`icon-${n}`, { svg: iconSvg(n), dpr: 4 }])),
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
    `<div style="width:${7.7 * 96}px;height:${1.9 * 96}px;font:700 ${88 * (96 / 72)}px/1.5 Kanit;color:transparent;text-shadow:${shadows};white-space:nowrap">SIIT Map:</div>`,
    7.7 * 96, 1.9 * 96, 3)
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
pptx.title = 'SIIT Map: progress update, 13 Nov 2026'
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
await pptx.writeFile({ fileName: OUT })
// PowerPoint's default theme lists a fallback font per script (Arial, Times New Roman, ...) and the master's bullet font is Arial. Drop them so the file names only Kanit and IBM Plex Sans Thai.
{
  const file = OUT
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
console.log(`print/siit-map-progress-2026-11-13.pptx: ${slides.length} slides (${floorCount} floors, ${roomCount} rooms, ${qrCount} QR spots); thumbnails in print/progress-preview/`)
console.log(`twin check: overflow ${report.overflow.length}, outside frame ${report.outside.length}, overlap ${report.overlap.length}; fonts ${report.fonts.join(', ')}`)
for (const k of ['overflow', 'outside', 'overlap']) for (const m of report[k]) console.log(`  ${k}: ${m}`)
