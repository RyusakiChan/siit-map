import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'


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
})
