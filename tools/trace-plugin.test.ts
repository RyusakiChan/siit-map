import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findShipped } from '../scripts/check-not-shipped.mjs'
import type { BuildingData } from '../src/data/types'
import { replaceFloor, sliceFloor } from '../src/trace/saveFloor'
import { saveDepartmentsToFile, saveFloorToFile } from './trace-plugin'

const sample: BuildingData = {
  building: { name: 'B', campus: 'C', sampleData: true, floorHeight: 4, outline: [[0, 0], [20, 0], [20, 10], [0, 10]] },
  floors: [{ level: 1, label: 'Floor 1', elevation: 0 }, { level: 2, label: 'Floor 2', elevation: 4 }],
  departments: [{ id: 'd-old', name: 'Old', letter: 'O', colorSlot: 0 }],
  rooms: [
    { id: 'sample-1', number: null, name: 'Sample A', floor: 1, departmentId: 'd-old', type: 'office', polygon: [[1, 1], [5, 1], [5, 5]], door: 'n1' },
    { id: 'sample-2', number: null, name: 'Sample B', floor: 2, departmentId: null, type: 'office', polygon: [[1, 1], [5, 1], [5, 5]], door: 'n2' },
  ],
  qrPoints: [],
  amenities: [],
  walkways: {
    nodes: [{ id: 'n1', floor: 1, position: [3, 6] }, { id: 'n2', floor: 2, position: [3, 6] }],
    edges: [],
    connectors: [{ id: 'lift', kind: 'elevator', costPerFloor: 20, nodes: { '1': 'n1', '2': 'n2' } }],
  },
}

describe('saveFloorToFile', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-'))
    const file = join(dir, 'building.json')
    writeFileSync(file, JSON.stringify(sample, null, 2) + '\n')
    return { dir, file, backups: join(dir, 'backups') }
  }
  const slice = {
    floor: 2,
    rooms: [{ id: 'r-f2-1', number: '201', name: '', floor: 2, departmentId: null, type: 'classroom' as const, polygon: [[2, 2], [6, 2], [6, 6]] as [number, number][], door: 'f2-d1' }],
    nodes: [{ id: 'f2-d1', floor: 2, position: [4, 7] as [number, number] }],
    edges: [],
    qrPoints: [{ id: 'qr-201', floor: 2, position: [4, 8] as [number, number], facingDeg: 90 }],
    connectors: [{ id: 'lift', kind: 'elevator' as const, costPerFloor: 20, node: 'f2-d1' }],
  }

  it('replaces only the chosen floor, writes a backup, marks the floor traced', () => {
    const { file, backups } = setup()
    const backup = saveFloorToFile(file, backups, slice, new Date('2026-11-06T10:00:00Z'))
    const out = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
    expect(out.rooms.map((r) => r.id).sort()).toEqual(['r-f2-1', 'sample-1'])
    expect(out.walkways.nodes.map((n) => n.id).sort()).toEqual(['f2-d1', 'n1'])
    expect(out.walkways.connectors[0]!.nodes).toEqual({ '1': 'n1', '2': 'f2-d1' })
    expect(out.floors.map((f) => f.traced)).toEqual([undefined, true])
    expect(out.building.sampleData).toBe(true)
    expect(out.usedIds).toEqual(expect.arrayContaining(['sample-2', 'r-f2-1', 'qr-201']))
    expect(out.qrPoints).toHaveLength(1)
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toEqual(sample)
  })

  it('turns the sample flag off once every floor is traced', () => {
    const { file, backups } = setup()
    const d = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
    d.floors[0]!.traced = true
    writeFileSync(file, JSON.stringify(d))
    saveFloorToFile(file, backups, slice)
    expect((JSON.parse(readFileSync(file, 'utf8')) as BuildingData).building.sampleData).toBe(false)
  })

  it('refuses a retired id or an id from another floor and leaves the file untouched', () => {
    const { file, backups } = setup()
    const before = readFileSync(file, 'utf8')
    expect(() => saveFloorToFile(file, backups, { ...slice, rooms: [{ ...slice.rooms[0]!, id: 'sample-1' }] })).toThrow(/another floor/)
    saveFloorToFile(file, backups, slice)
    const second = { ...slice, floor: 1, rooms: [{ ...slice.rooms[0]!, id: 'sample-2', floor: 1 }], qrPoints: [], nodes: [], connectors: [] }
    expect(() => saveFloorToFile(file, backups, second)).toThrow(/retired|another floor/)
    expect(before).toContain('sample-1')
  })

  it('keeps only the newest 20 backups', () => {
    const { file, backups } = setup()
    for (let i = 0; i < 23; i++) saveFloorToFile(file, backups, slice, new Date(Date.UTC(2026, 10, 6, 10, 0, i)))
    const names = readdirSync(backups).sort()
    expect(names).toHaveLength(20)
    expect(names[0]).toContain('10-00-03')
  })
})

describe('saveDepartmentsToFile', () => {
  it('replaces the department list with a backup, keeps rooms, and refuses to drop a used department', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trace-d-'))
    const file = join(dir, 'building.json')
    writeFileSync(file, JSON.stringify(sample, null, 2) + '\n')
    const backups = join(dir, 'backups')
    const added = [...sample.departments, { id: 'd-new', name: 'New', letter: 'N', colorSlot: 5 }]
    const backup = saveDepartmentsToFile(file, backups, added)
    const out = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
    expect(out.departments.map((d) => d.id)).toEqual(['d-old', 'd-new'])
    expect(out.rooms).toHaveLength(2)
    expect(out.usedIds).toContain('d-new')
    expect(JSON.parse(readFileSync(backup, 'utf8'))).toEqual(sample)
    expect(() => saveDepartmentsToFile(file, backups, [])).toThrow(/still used/)
    expect(JSON.parse(readFileSync(file, 'utf8')).departments).toHaveLength(2)
  })
})

describe('voids and amenities through a floor save', () => {
  const withVoid = (): BuildingData => ({
    ...structuredClone(sample),
    floors: [{ level: 1, label: 'Floor 1', elevation: 0 }, { level: 2, label: 'Floor 2', elevation: 4, voids: [[[8, 2], [12, 2], [12, 6], [8, 6]]] }],
    amenities: [{ id: 'old-water', floor: 2, position: [15, 8], type: 'drinkingfountain' }, { id: 'f1-water', floor: 1, position: [2, 8], type: 'drinkingfountain' }],
  })
  const base = { floor: 2, rooms: [], nodes: [], edges: [], qrPoints: [], connectors: [] }

  it('keeps the voids and amenities of the floor when the slice does not mention them (the trace tool own save)', () => {
    const out = replaceFloor(withVoid(), base)
    expect(out.floors[1]!.voids).toEqual([[[8, 2], [12, 2], [12, 6], [8, 6]]])
    expect(out.floors[1]!.traced).toBe(true)
    expect(out.amenities.map((a) => a.id).sort()).toEqual(['f1-water', 'old-water'])
  })
  it('carries voids through sliceFloor and back', () => {
    const d = withVoid()
    const slice = sliceFloor(d, 2)
    expect(slice.voids).toHaveLength(1)
    expect(replaceFloor(d, slice).floors[1]!.voids).toEqual(d.floors[1]!.voids)
  })
  it('sets new voids, replaces the amenities of the floor and retires the old amenity ids', () => {
    const out = replaceFloor(withVoid(), { ...base, voids: [[[1, 1], [2, 1], [2, 2]]], amenities: [{ id: 'new-prayer', floor: 2, position: [3, 3], type: 'prayerroom' }] })
    expect(out.floors[1]!.voids).toEqual([[[1, 1], [2, 1], [2, 2]]])
    expect(out.amenities.map((a) => a.id).sort()).toEqual(['f1-water', 'new-prayer'])
    expect(out.usedIds).toEqual(expect.arrayContaining(['old-water', 'new-prayer']))
  })
  it('refuses to reuse a retired or foreign amenity id, and an empty voids list removes the voids', () => {
    expect(() => replaceFloor(withVoid(), { ...base, amenities: [{ id: 'f1-water', floor: 2, position: [3, 3], type: 'prayerroom' }] })).toThrow(/already used/)
    const once = replaceFloor(withVoid(), { ...base, amenities: [] })
    expect(() => replaceFloor(once, { ...base, amenities: [{ id: 'old-water', floor: 2, position: [3, 3], type: 'prayerroom' }] })).toThrow(/retired/)
    expect(replaceFloor(withVoid(), { ...base, voids: [] }).floors[1]!.voids).toBeUndefined()
  })
})

describe('check-not-shipped', () => {
  const dist = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'))
    mkdirSync(join(dir, 'assets'))
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
    return dir
  }
  it('passes a build with only the app', () => {
    expect(findShipped(dist({ 'index.html': '<html></html>', 'assets/index-a.js': 'console.log(1)' }))).toEqual([])
  })
  it('fails on a trace page, or code that talks to the save endpoint', () => {
    expect(findShipped(dist({ 'index.html': 'x', 'trace.html': 'x' })).map((f) => f.file)).toEqual(['trace.html'])
    expect(findShipped(dist({ 'assets/a.js': 'fetch("/__trace/save")' })).map((f) => f.file)).toEqual([join('assets', 'a.js')])
    expect(findShipped(dist({ 'assets/b.js': '// from src/trace/Editor.tsx' }))).toHaveLength(1)
  })
  it('fails when dist is missing', () => {
    expect(findShipped(join(tmpdir(), 'no-such-dist-folder'))).toHaveLength(1)
  })
})
