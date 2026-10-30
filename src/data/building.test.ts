import { describe, expect, it } from 'vitest'
import { buildingData as data, hasSampleData } from './index'
import { polygonInside, polygonsOverlap } from './geometry'
import { problemsForFloor, validate } from './validate'
import type { BuildingData } from './types'

const errors = (d: BuildingData) => validate(d).filter((p) => p.severity === 'error')
const clone = (): BuildingData => structuredClone(data)
const codes = (d: BuildingData) => new Set(errors(d).map((p) => p.code))

describe('building.json', () => {
  it('passes every data check', () => {
    expect(errors(data).map((p) => p.message)).toEqual([])
  })

  it('uses only obviously fake names on floors that are not traced yet', () => {
    expect(data.building.sampleData).toBe(data.floors.some((f) => !f.traced))
    const untraced = new Set(data.floors.filter((f) => !f.traced).map((f) => f.level))
    for (const room of data.rooms.filter((r) => untraced.has(r.floor))) expect(room.id.startsWith('sample-'), room.id).toBe(true)
    if (!data.floors.some((f) => f.traced)) for (const d of data.departments) expect(d.name.startsWith('Sample '), d.id).toBe(true)
  })

  it('shows the SAMPLE badge while any floor is untraced', () => {
    const d = clone()
    d.floors.forEach((f) => (f.traced = true))
    expect(hasSampleData(d)).toBe(false)
    d.floors[2]!.traced = false
    expect(hasSampleData(d)).toBe(true)
  })

  it('detects overlaps and containment correctly', () => {
    const sq = (x: number, z: number, s: number): [number, number][] => [[x, z], [x + s, z], [x + s, z + s], [x, z + s]]
    expect(polygonsOverlap(sq(0, 0, 4), sq(2, 2, 4))).toBe(true)
    expect(polygonsOverlap(sq(0, 0, 4), sq(1, 1, 2))).toBe(true)
    expect(polygonsOverlap(sq(0, 0, 4), sq(4, 0, 4))).toBe(false)
    expect(polygonsOverlap(sq(0, 0, 4), sq(5, 0, 4))).toBe(false)
    expect(polygonInside(sq(1, 1, 2), sq(0, 0, 4))).toBe(true)
    expect(polygonInside(sq(3, 3, 2), sq(0, 0, 4))).toBe(false)
  })
})

describe('validate()', () => {
  it('flags duplicate room ids, numbers, department letters and QR ids', () => {
    const d = clone()
    d.rooms[1]!.id = d.rooms[0]!.id
    d.rooms[3]!.number = d.rooms[2]!.number = 'X-1'
    d.departments[1]!.letter = d.departments[0]!.letter
    d.qrPoints[1]!.id = d.qrPoints[0]!.id
    const c = codes(d)
    for (const k of ['room-id-duplicate', 'room-number-duplicate', 'department-letter', 'qr-duplicate']) expect(c.has(k), k).toBe(true)
  })

  it('flags a room on a missing floor, with an unknown department, or with too few corners', () => {
    const d = clone()
    d.rooms[0]!.floor = 99
    d.rooms[1]!.departmentId = 'nope'
    d.rooms[2]!.polygon = d.rooms[2]!.polygon.slice(0, 2)
    const c = codes(d)
    expect(c.has('room-floor') && c.has('room-department') && c.has('room-polygon')).toBe(true)
  })

  it('flags rooms outside the outline and overlapping rooms, with a position', () => {
    const d = clone()
    const r = d.rooms.find((x) => x.floor === 2)!
    r.polygon = r.polygon.map(([x, z]) => [x + 500, z])
    const other = d.rooms.filter((x) => x.floor === 3)
    other[1]!.polygon = other[0]!.polygon
    const ps = errors(d)
    expect(ps.find((p) => p.code === 'room-outside')?.at).toBeTruthy()
    expect(ps.some((p) => p.code === 'room-overlap' && p.floor === 3)).toBe(true)
  })

  it('flags QR points outside the outline', () => {
    const d = clone()
    d.qrPoints[0]!.position = [900, 900]
    expect(codes(d).has('point-outside')).toBe(true)
  })

  it('flags QR points with no label, a bad facing, in a room, in the atrium or with a room id', () => {
    const d = clone()
    const real = d.qrPoints.filter((q) => !q.sample)
    const mid = (poly: [number, number][]): [number, number] => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length]
    real[0]!.label = ' '
    real[1]!.labelTh = ''
    real[2]!.facingDeg = 360
    real[3]!.facingDeg = -5
    const inRoom = real.find((q) => q.floor === 2 && q !== real[0] && q !== real[1] && q !== real[2] && q !== real[3])!
    inRoom.position = mid(d.rooms.find((r) => r.floor === 2 && r.polygon.length >= 4 && !['stairs', 'elevator', 'restroom'].includes(r.type))!.polygon)
    const inVoid = real.find((q) => q.floor === 3 && q !== real[0] && q !== real[1] && q !== real[2] && q !== real[3])!
    inVoid.position = mid(d.floors.find((f) => f.level === 3)!.voids![0]!)
    const taken = real.find((q) => q.floor === 4)!
    taken.id = d.rooms[0]!.id
    const c = codes(d)
    for (const k of ['qr-label', 'qr-facing', 'qr-in-room', 'qr-in-void', 'qr-id-taken']) expect(c.has(k), k).toBe(true)
    expect(errors(d).filter((p) => p.code === 'qr-label')).toHaveLength(2)
    expect(errors(d).filter((p) => p.code === 'qr-facing')).toHaveLength(2)
  })

  it('keeps every real QR point inside the building, in a corridor, on its own floor', () => {
    const real = data.qrPoints.filter((q) => !q.sample)
    expect(real.length).toBeGreaterThanOrEqual(12)
    const bad = errors(data).filter((p) => p.code.startsWith('qr-') || p.code === 'point-outside' || p.code === 'point-floor')
    expect(bad).toEqual([])
  })

  it('never changes a printed QR id (the ids below are permanent)', () => {
    const ids = new Set(data.qrPoints.map((q) => q.id))
    const printed = ['f2-lift', 'f2-stairs-w', 'f2-stairs-e', 'f2-stairs-s', 'f2-corr-nw', 'f2-corr-se', 'f3-lift', 'f3-stairs-w', 'f3-stairs-e', 'f3-stairs-s', 'f3-corr-nw', 'f3-corr-se', 'f4-lift', 'f4-stairs-w', 'f4-stairs-e', 'f4-stairs-s', 'f4-corr-nw', 'f4-corr-se']
    for (const id of printed) expect(ids.has(id), id).toBe(true)
    for (const id of printed) expect(data.usedIds, id).toContain(id)
  })

  it('marks the two sample QR points and no others', () => {
    expect(data.qrPoints.filter((q) => q.sample).map((q) => q.id).sort()).toEqual(['sample-f1-lobby', 'sample-f2-lift'])
  })

  it('flags broken walkways: duplicate node, bad edge, missing door', () => {
    const d = clone()
    d.walkways.nodes.push({ ...d.walkways.nodes[0]! })
    d.walkways.edges.push({ a: d.walkways.nodes[0]!.id, b: 'ghost' })
    delete d.rooms[0]!.door
    const c = codes(d)
    expect(c.has('node-duplicate') && c.has('edge-missing-node') && c.has('room-no-door')).toBe(true)
  })

  it('flags a floor split in two, and nodes inside or edges through a room', () => {
    const split = clone()
    const lone = split.rooms.find((r) => r.floor === 2)!
    split.walkways.edges = split.walkways.edges.filter((e) => e.a !== lone.door && e.b !== lone.door)
    expect(codes(split).has('door-unreachable')).toBe(true)

    const inside = clone()
    const r = inside.rooms.find((x) => x.floor === 2)!
    const [p, q] = [r.polygon[0]!, r.polygon[2]!]
    inside.walkways.nodes.push({ id: 'in', floor: 2, position: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] })
    expect(codes(inside).has('node-in-room')).toBe(true)

    const through = clone()
    through.walkways.nodes.push({ id: 'far', floor: 2, position: [(p[0] + q[0]) / 2, q[1] + 8 * Math.sign(q[1])] })
    through.walkways.edges.push({ a: r.door!, b: 'far' }, { a: 'far', b: 'far' })
    // from the door straight across the room it belongs to
    through.walkways.nodes.push({ id: 'across', floor: 2, position: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 100] })
    through.walkways.edges.push({ a: r.door!, b: 'across' })
    expect(errors(through).length).toBeGreaterThan(0)
  })

  it('flags connectors on the wrong room type or on one floor only', () => {
    const d = clone()
    d.walkways.connectors[0]!.nodes = { '1': d.walkways.connectors[0]!.nodes['1']! }
    expect(codes(d).has('connector-short')).toBe(true)
    const e = clone()
    e.walkways.connectors[0]!.kind = 'stairs'
    expect(codes(e).has('connector-room-type')).toBe(true)
  })

  it('warns, but does not fail, for unnamed rooms and loose nodes', () => {
    const d = clone()
    d.rooms[0]!.name = ''
    delete d.rooms[0]!.nameTh
    d.walkways.nodes.push({ id: 'loose', floor: 1, position: [-10, 0.5] })
    const all = validate(d)
    expect(all.some((p) => p.code === 'room-unnamed' && p.severity === 'warning')).toBe(true)
    expect(all.some((p) => p.code === 'node-isolated' && p.severity === 'warning')).toBe(true)
    expect(errors(d)).toEqual([])
  })

  it('narrows problems to a floor plus building-wide ones', () => {
    const mk = (code: string, floor?: number) => ({ code, severity: 'error' as const, message: '', floor, ids: [] })
    expect(problemsForFloor([mk('a', 2), mk('b', 3), mk('c')], 2).map((p) => p.code)).toEqual(['a', 'c'])
  })
})
