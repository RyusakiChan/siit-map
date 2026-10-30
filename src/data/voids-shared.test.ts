import { describe, expect, it } from 'vitest'
import { roomDeptIds } from './departments'
import { search } from '../search'
import { validate } from './validate'
import type { BuildingData, Point } from './types'

const sq = (x: number, z: number, w: number, h = w): Point[] => [[x, z], [x + w, z], [x + w, z + h], [x, z + h]]

/** A tiny two-room floor around a 6 × 6 atrium, so these checks do not depend on the real data. */
function fixture(): BuildingData {
  return {
    building: { name: 'T', campus: 'T', sampleData: false, floorHeight: 4, outline: sq(0, 0, 40, 30) },
    floors: [{ level: 1, label: 'Floor 1', elevation: 0, traced: true, voids: [sq(15, 10, 6)] }],
    departments: [
      { id: 'd-a', name: 'Alpha School', letter: 'A', colorSlot: 0, aliases: ['ALP'] },
      { id: 'd-b', name: 'Beta School', letter: 'B', colorSlot: 1, aliases: ['BET'] },
      { id: 'd-c', name: 'Gamma School', letter: 'C', colorSlot: 2 },
    ],
    rooms: [
      { id: 'r1', number: '1-01', name: 'West', floor: 1, departmentId: null, departmentIds: ['d-a', 'd-b'], type: 'office', polygon: sq(1, 1, 10, 28), door: 'n1' },
      { id: 'r2', number: '1-02', name: 'East', floor: 1, departmentId: 'd-c', type: 'office', polygon: sq(29, 1, 10, 28), door: 'n2' },
    ],
    qrPoints: [],
    amenities: [],
    walkways: {
      nodes: [
        { id: 'n1', floor: 1, position: [11.25, 5] },
        { id: 'n2', floor: 1, position: [28.75, 5] },
        { id: 'c1', floor: 1, position: [20, 5] },
      ],
      edges: [{ a: 'n1', b: 'c1' }, { a: 'c1', b: 'n2' }],
      connectors: [],
    },
  }
}
const codes = (d: BuildingData) => new Set(validate(d).filter((p) => p.severity === 'error').map((p) => p.code))

describe('open atrium (voids)', () => {
  it('accepts a void inside the outline, clear of rooms, nodes and edges', () => {
    expect([...codes(fixture())]).toEqual([])
  })
  it('flags a void that sticks out of the outline', () => {
    const d = fixture()
    d.floors[0]!.voids = [sq(36, 10, 8)]
    expect(codes(d).has('void-outside')).toBe(true)
  })
  it('flags a room that overlaps a void, but not one that only touches it', () => {
    const d = fixture()
    d.rooms.push({ id: 'r3', number: '1-03', name: 'Touch', floor: 1, departmentId: null, type: 'other', polygon: sq(15, 16, 6, 4) })
    expect(codes(d).has('void-room-overlap')).toBe(false)
    d.rooms[1]!.polygon = sq(18, 8, 10, 10)
    expect(codes(d).has('void-room-overlap')).toBe(true)
  })
  it('flags a node inside a void', () => {
    const d = fixture()
    d.walkways.nodes.push({ id: 'in', floor: 1, position: [18, 13] })
    expect(codes(d).has('node-in-void')).toBe(true)
  })
  it('flags an edge that crosses a void', () => {
    const d = fixture()
    d.walkways.nodes.push({ id: 'a', floor: 1, position: [13, 13] }, { id: 'b', floor: 1, position: [24, 13] })
    d.walkways.edges.push({ a: 'a', b: 'b' })
    const c = codes(d)
    expect(c.has('edge-through-void')).toBe(true)
  })
  it('lets an edge run along the void boundary', () => {
    const d = fixture()
    d.walkways.nodes.push({ id: 'a', floor: 1, position: [15, 9.9] }, { id: 'b', floor: 1, position: [21, 9.9] })
    d.walkways.edges.push({ a: 'a', b: 'b' }, { a: 'a', b: 'c1' })
    expect(codes(d).has('edge-through-void')).toBe(false)
  })
})

describe('shared rooms (departmentIds)', () => {
  it('lists both departments for a shared room and one for a normal room', () => {
    const d = fixture()
    expect(roomDeptIds(d.rooms[0]!)).toEqual(['d-a', 'd-b'])
    expect(roomDeptIds(d.rooms[1]!)).toEqual(['d-c'])
    expect(roomDeptIds({ departmentId: null })).toEqual([])
  })
  it('flags a room that uses both departmentId and departmentIds', () => {
    const d = fixture()
    d.rooms[0]!.departmentId = 'd-c'
    expect(codes(d).has('room-department-both')).toBe(true)
  })
  it('needs at least 2 ids, all existing', () => {
    const d = fixture()
    d.rooms[0]!.departmentIds = ['d-a']
    expect(codes(d).has('room-departments-short')).toBe(true)
    d.rooms[0]!.departmentIds = ['d-a', 'd-zzz']
    expect(codes(d).has('room-department')).toBe(true)
  })
  it('counts a shared room as using each of its departments, and finds it by either department', () => {
    const d = fixture()
    const unused = validate(d).filter((p) => p.code === 'department-unused')
    expect(unused).toEqual([])
    expect(search('ALP', d).rooms.map((r) => r.id)).toContain('r1')
    expect(search('BET', d).rooms.map((r) => r.id)).toContain('r1')
    expect(search('Gamma', d).rooms.map((r) => r.id)).not.toContain('r1')
  })
})
