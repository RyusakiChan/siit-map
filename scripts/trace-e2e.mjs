// Laptop-size browser check of the trace editor. Needs the dev server:
//   npm run dev            (or: npx vite --port 5199, then APP_URL=http://localhost:5199)
//   node scripts/trace-e2e.mjs [outDir]
// It draws a synthetic floor-5 picture (rotated about 8 degrees and skewed), aligns it with 3 points,
// traces two rooms, a corridor, two doors, a lift connector and a QR point, saves, and opens the app.
// It WRITES src/data/building.json through the save endpoint, then restores it from the backup.
import { chromium } from 'playwright-core'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'trace-shots'
const base = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')
mkdirSync(out, { recursive: true })
const dataFile = 'src/data/building.json'
const original = readFileSync(dataFile)

const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`)
  console.log(`ok: ${what}`)
}

// The picture's mapping from metres to pixels: a rotation of 8 degrees plus a little skew and non-uniform scale.
const A = { a: 13.9, b: 1.95, c: -1.6, d: 14.1 }
const mapPx = (m, [x, z]) => [A.a * x + A.c * z + m.e, A.b * x + A.d * z + m.f]

const browser = await chromium.launch({ channel: 'chrome' })
let restoreFrom = false
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { throw e })
  page.on('dialog', (d) => d.accept())
  await page.goto(`${base}/trace.html`)
  await page.getByRole('button', { name: '5', exact: true }).waitFor()
  const state = (fn, arg) => page.evaluate(fn, arg)
  const outline = await state(() => window.__trace.getState().draft.building.outline)

  // 1. Draw the synthetic floor plan picture from the sample floor 5 and keep it in the scratch folder.
  const xs = outline.map((p) => A.a * p[0] + A.c * p[1])
  const ys = outline.map((p) => A.b * p[0] + A.d * p[1])
  const m = { e: 60 - Math.min(...xs), f: 60 - Math.min(...ys) }
  const W = Math.ceil(Math.max(...xs) - Math.min(...xs) + 120)
  const H = Math.ceil(Math.max(...ys) - Math.min(...ys) + 120)
  const rooms2 = readSampleFloor5()
  const dataUrl = await page.evaluate(({ A, m, W, H, outline, rooms2 }) => {
    const c = document.createElement('canvas')
    c.width = W; c.height = H
    const g = c.getContext('2d')
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, W, H)
    g.setTransform(A.a, A.b, A.c, A.d, m.e, m.f)
    g.lineJoin = 'round'
    const path = (poly) => { g.beginPath(); poly.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath() }
    path(outline); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 0.35; g.strokeStyle = '#222'; g.stroke()
    for (const p of rooms2) { path(p); g.fillStyle = '#dde8f2'; g.fill(); g.lineWidth = 0.2; g.strokeStyle = '#335'; g.stroke() }
    return c.toDataURL('image/png')
  }, { A, m, W, H, outline, rooms2 })
  const pngPath = join(out, 'synthetic-floor5.png')
  writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'))

  const screen = async (w) => state(({ w }) => {
    const st = window.__trace.getState()
    const r = document.querySelector('[data-testid="canvas"]').getBoundingClientRect()
    return { x: r.left + w[0] * st.view.s + st.view.tx, y: r.top + w[1] * st.view.s + st.view.ty }
  }, { w })
  const click = async (w, opts) => { const p = await screen(w); await page.mouse.click(p.x, p.y, opts) }
  const tool = (name) => page.getByRole('button', { name, exact: true }).click()

  // 2. Floor 5, load the picture, align with three outline corners.
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.screenshot({ path: join(out, '01-floor5-empty.png') })
  check((await state(() => window.__trace.getState().draft.rooms.filter((r) => r.floor === 5).length)) === 0, 'untraced floor 5 starts empty (no sample rooms copied)')
  await page.locator('input[type=file]').setInputFiles(pngPath)
  await page.waitForFunction(() => window.__trace.getState().photo)
  const corners = [outline[0], outline[2], outline[4]]
  for (const c of corners) {
    const px = mapPx(m, c)
    const w = await state(({ px }) => {
      const mm = window.__trace.getState().photo.matrix
      return [mm[0] * px[0] + mm[2] * px[1] + mm[4], mm[1] * px[0] + mm[3] * px[1] + mm[5]]
    }, { px })
    await click(w)
  }
  for (const c of corners) await click(c)
  const aligned = await state(() => window.__trace.getState().photo.matrix)
  const probe = [-10, 4]
  const px = mapPx(m, probe)
  const back = [aligned[0] * px[0] + aligned[2] * px[1] + aligned[4], aligned[1] * px[0] + aligned[3] * px[1] + aligned[5]]
  check(Math.hypot(back[0] - probe[0], back[1] - probe[1]) < 0.3, `photo aligned: a fourth point lands within 0.3 m (${back.map((v) => v.toFixed(2))})`)
  await page.screenshot({ path: join(out, '02-photo-aligned.png') })

  // 3. Two rooms sharing a wall (A and a lift room B).
  await tool('Room')
  for (const p of [[-20, -16], [-10, -16], [-10, -3], [-20, -3], [-20, -16]]) await click(p)
  await state(() => window.__trace.getState().drawing.length)
  for (const p of [[-10, -16], [0, -16], [0, -3], [-10, -3], [-10, -16]]) await click(p)
  const [ra, rb] = await state(() => window.__trace.getState().draft.rooms.filter((r) => r.floor === 5).map((r) => ({ id: r.id, polygon: r.polygon })))
  check(ra && rb && JSON.stringify(ra.polygon[1]) === JSON.stringify(rb.polygon[0]) && JSON.stringify(ra.polygon[2]) === JSON.stringify(rb.polygon[3]), 'the two rooms share their wall corners exactly (snapped)')
  check(ra.id === 'r-f5-1' && rb.id === 'r-f5-2', 'room ids are r-f5-1 and r-f5-2')

  // Fields for room B (selected): lift room.
  const form = page.getByTestId('room-form')
  await form.getByLabel('Name', { exact: true }).fill('Test lift')
  await form.getByLabel('Number').fill('5-L1')
  await form.getByLabel('Type').selectOption('elevator')
  await tool('Select')
  await click([-15, -9])
  await form.getByLabel('Name', { exact: true }).fill('Test room A')
  await form.getByLabel('Number').fill('5-X1')
  await form.getByLabel('Type').selectOption('classroom')

  // 4. Corridor: 3 nodes, 2 lines.
  await tool('Corridor node')
  for (const p of [[-18, 0], [-5, 0], [10, 0]]) await click(p)
  await tool('Corridor line')
  const ids = await state(() => window.__trace.getState().draft.walkways.nodes.filter((n) => n.floor === 5).map((n) => n.id))
  check(ids.length === 3, 'three corridor nodes')
  await click([-18, 0]); await click([-5, 0]); await click([10, 0])
  // 5. Doors.
  await tool('Door')
  await click([-15, -3.2])
  await click([-5, -3.2])
  const doors = await state(() => window.__trace.getState().draft.rooms.filter((r) => r.floor === 5).map((r) => r.door))
  check(doors.every(Boolean), 'both rooms have a door')
  const dn = await state(() => { const s = window.__trace.getState().draft; const r = s.rooms.find((x) => x.id === 'r-f5-1'); return s.walkways.nodes.find((n) => n.id === r.door).position })
  check(Math.abs(dn[1] - -2.75) < 0.006, `door node sits 0.25 m outside the wall (z=${dn[1]})`)

  // 6. Lift connector: join the existing lift (floors 1,3,4,5) with this floor.
  await tool('Lift / stairs')
  await page.getByRole('button', { name: 'lift', exact: true }).click()
  await click([-5, -9])
  const lift = await state(() => window.__trace.getState().draft.walkways.connectors.find((c) => c.id === 'lift').nodes)
    check(Object.keys(lift).sort().join() === '2,3,4,5', 'lift connector joins the traced floor 5 with the other floors')

  // 7. QR point: click and drag the arrow south.
  await tool('QR point')
  const q0 = await screen([-15, 2]); const q1 = await screen([-15, 6])
  await page.mouse.move(q0.x, q0.y); await page.mouse.down(); await page.mouse.move(q1.x, q1.y, { steps: 4 }); await page.mouse.up()
  await page.getByLabel('QR id').fill('r-f5-1')
  check(await page.getByText(/is a room id/).isVisible(), 'a QR id that is already used (a room id) is refused')
  await page.getByLabel('QR id').fill('test-trace-qr')
  await page.getByRole('button', { name: 'Add QR point' }).click()
  const qr = await state(() => window.__trace.getState().draft.qrPoints.find((q) => q.id === 'test-trace-qr'))
  check(qr && qr.facingDeg > 170 && qr.facingDeg < 190, `QR facing south (${qr?.facingDeg})`)

  // A QR point needs a place name in both languages before the check list is clean.
  await page.getByLabel('QR place, English').fill('Test spot')
  await page.getByLabel('QR place, Thai').fill('จุดทดสอบ')

  // 8. Checks are clear.
  await tool('Select')
  await page.screenshot({ path: join(out, '03-traced.png') })
  const errCount = await page.getByTestId('error-count').innerText()
  check(errCount === '0', `check list has no errors (shows ${errCount})`)

  // Undo / redo
  // The place-name edits are undo steps of their own, so undo until the QR point is gone.
  let undone = 0
  while (undone < 5 && (await state(() => window.__trace.getState().draft.qrPoints.some((q) => q.id === 'test-trace-qr')))) {
    await state(() => window.__trace.getState().undo())
    undone++
  }
  check((await state(() => window.__trace.getState().draft.qrPoints.some((q) => q.id === 'test-trace-qr'))) === false, 'undo removes the QR point')
  for (let i = 0; i < undone; i++) await state(() => window.__trace.getState().redo())
  check(await state(() => window.__trace.getState().draft.qrPoints.some((q) => q.id === 'test-trace-qr')), 'redo brings it back')

  // 8b. Departments: add one, save it, give it to room A.
  await tool('Select')
  await page.getByRole('button', { name: 'Departments', exact: true }).click()
  await page.getByLabel('New department name').fill('Test Department')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const dform = page.getByTestId('dept-form')
  await dform.getByLabel('Letter (1-2 capital letters, unique)').fill('T')
  await dform.getByLabel('Summary', { exact: false }).fill('A made-up test department.')
  await dform.getByLabel('Official page (https://…)').fill('http://not-secure.example')
  check(await page.getByText(/must start with https/).isVisible(), 'a link without https:// is flagged')
  await dform.getByLabel('Official page (https://…)').fill('https://example.com/test')
  await dform.getByRole('radio', { name: 'Green' }).click()
  check(await page.getByText(/must start with https/).count() === 0, 'the https problem clears')
  check(await page.getByText('Write it in your own words').isVisible(), 'the summary hint is shown')
  await page.getByRole('button', { name: 'Save departments' }).click()
  await page.getByRole('status').filter({ hasText: 'Saved departments' }).waitFor()
  let saved1 = JSON.parse(readFileSync(dataFile, 'utf8'))
  const nd = saved1.departments.find((d) => d.name === 'Test Department')
  check(nd && nd.id === 'd-test-department' && nd.colorSlot === 5 && nd.letter === 'T', 'department saved with id d-test-department, letter T, colour slot 5')
  await page.screenshot({ path: join(out, '07-departments-panel.png') })
  await page.getByRole('button', { name: 'Close' }).click()
  await click([-15, -9])
  await form.getByLabel('Department').selectOption('d-test-department')
  check((await state(() => window.__trace.getState().draft.rooms.find((r) => r.id === 'r-f5-1').departmentId)) === 'd-test-department', 'room A uses the new department')

  // 9. Save.
  const before = new Set(existingBackups())
  await page.getByRole('button', { name: 'Save floor' }).click()
  await page.getByRole('status').filter({ hasText: 'Saved floor 5' }).waitFor()
  const added = existingBackups().filter((f) => !before.has(f))
  check(added.length === 1, 'a backup file was written')
  restoreFrom = true
  const saved = JSON.parse(readFileSync(dataFile, 'utf8'))
  check(saved.floors.find((f) => f.level === 5).traced === true && saved.building.sampleData === true, 'floor 5 marked traced; floor 1 still sample')
  check(saved.rooms.filter((r) => r.floor === 5).length === 2 && saved.rooms.filter((r) => r.floor === 3).length > 5, 'only floor 5 rooms were replaced')
  await page.screenshot({ path: join(out, '04-saved.png') })

  // 10. The app shows the traced rooms.
  const app = await ctx.newPage()
  await app.setViewportSize({ width: 1440, height: 900 })
  await app.goto(`${base}/#/room/r-f5-1`)
  await app.getByText('Test room A').first().waitFor({ timeout: 15000 })
  await app.waitForTimeout(1500)
  await app.screenshot({ path: join(out, '05-app-floor5.png') })
  const letterColor = await app.evaluate(() => getComputedStyle(document.querySelector('.dept-badge')).borderColor)
  check(letterColor === 'rgb(111, 158, 103)', 'the room card badge uses the slot 5 badge colour (' + letterColor + ')')
  console.log('ok: the app at / shows the traced room on floor 5')

  // 10b. Delete is blocked while the department is in use.
  await page.getByRole('button', { name: 'Departments', exact: true }).click()
  await page.locator('.dept-row', { hasText: 'Test Department' }).click()
  check((await page.locator('.dept-row', { hasText: 'Test Department' }).innerText()).includes('1 room'), 'the list shows 1 room using it')
  await page.getByRole('button', { name: 'Delete department' }).click()
  check(await page.getByRole('alert').filter({ hasText: '1 room still uses' }).isVisible(), 'delete is blocked while a room uses the department')
  await page.screenshot({ path: join(out, '08-delete-blocked.png') })

  // 11. One check at 1280x800.
  const small = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p2 = await small.newPage()
  await p2.goto(`${base}/trace.html`)
  await p2.getByTestId('canvas').waitFor()
  await p2.waitForTimeout(500)
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  const rect = await p2.getByTestId('canvas').boundingBox()
  check(!overflow && rect.width > 700 && rect.height > 500, `1280x800 fits without sideways scroll (canvas ${Math.round(rect.width)}x${Math.round(rect.height)})`)
  await p2.screenshot({ path: join(out, '06-1280x800.png') })
} finally {
  await browser.close()
  writeFileSync(dataFile, original)
  console.log(`restored ${dataFile}`)
}

function existingBackups() {
  try { return readdirSync('.trace-backups') } catch { return [] }
}

function readSampleFloor5() {
  return JSON.parse(readFileSync(dataFile, 'utf8')).rooms.filter((r) => r.floor === 5).map((r) => r.polygon)
}
