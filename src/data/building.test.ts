import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'
import { polygonInside, polygonsOverlap } from './geometry'

describe('building.json', () => {
  it('has unique room ids', () => {
    const ids = data.rooms.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique floor levels and department ids', () => {
    const levels = data.floors.map((f) => f.level)
    expect(new Set(levels).size).toBe(levels.length)
    const deptIds = data.departments.map((d) => d.id)
    expect(new Set(deptIds).size).toBe(deptIds.length)
  })

  it('puts every room on an existing floor', () => {
    const levels = new Set(data.floors.map((f) => f.level))
    for (const room of data.rooms) {
      expect(levels.has(room.floor), `${room.id}: floor ${room.floor}`).toBe(true)
    }
  })

  it('points every room at an existing department (or none)', () => {
    const deptIds = new Set(data.departments.map((d) => d.id))
    for (const room of data.rooms) {
      if (room.departmentId === null) continue
      expect(deptIds.has(room.departmentId), `${room.id}: ${room.departmentId}`).toBe(true)
    }
  })

  it('gives the outline and every room a polygon of at least 3 points', () => {
    expect(data.building.outline.length).toBeGreaterThanOrEqual(3)
    for (const room of data.rooms) {
      expect(room.polygon.length, room.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('puts every QR point on an existing floor with a unique id', () => {
    const levels = new Set(data.floors.map((f) => f.level))
    const ids = data.qrPoints.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const q of data.qrPoints) expect(levels.has(q.floor)).toBe(true)
  })

  it('puts every room inside the outline', () => {
    for (const room of data.rooms) {
      expect(polygonInside(room.polygon, data.building.outline), room.id).toBe(true)
    }
  })

  it('has no overlapping rooms on the same floor', () => {
    for (const floor of data.floors) {
      const rooms = data.rooms.filter((r) => r.floor === floor.level)
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          expect(polygonsOverlap(rooms[i].polygon, rooms[j].polygon), `${rooms[i].id} / ${rooms[j].id}`).toBe(false)
        }
      }
    }
  })

  it('has unique department letters', () => {
    const letters = data.departments.map((d) => d.letter)
    expect(new Set(letters).size).toBe(letters.length)
  })

  it('puts QR points and amenities inside the outline on an existing floor', () => {
    const levels = new Set(data.floors.map((f) => f.level))
    const ids = data.amenities.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const item of [...data.qrPoints, ...data.amenities]) {
      expect(levels.has(item.floor), item.id).toBe(true)
      expect(polygonInside([item.position, item.position, item.position], data.building.outline), item.id).toBe(true)
    }
  })

  it('has unique room numbers', () => {
    const numbers = data.rooms.map((r) => r.number).filter((n) => n !== null)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('uses only obviously fake names while the data is sample data', () => {
    expect(data.building.sampleData).toBe(true)
    for (const room of data.rooms) expect(room.id.startsWith('sample-'), room.id).toBe(true)
    for (const d of data.departments) expect(d.name.startsWith('Sample '), d.id).toBe(true)
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
