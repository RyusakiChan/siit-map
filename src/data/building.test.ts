import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'
import { boundaryDistance, pointInPolygon, polygonInside, polygonsOverlap, segmentsCross } from './geometry'
import type { Point } from './types'

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
          expect(polygonsOverlap(rooms[i]!.polygon, rooms[j]!.polygon), `${rooms[i]!.id} / ${rooms[j]!.id}`).toBe(false)
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

  describe('walkways', () => {
    const w = data.walkways
    const node = new Map(w.nodes.map((n) => [n.id, n]))
    const roomsOn = (floor: number) => data.rooms.filter((r) => r.floor === floor)
    const adjacency = new Map<string, string[]>()
    for (const e of w.edges) {
      adjacency.set(e.a, [...(adjacency.get(e.a) ?? []), e.b])
      adjacency.set(e.b, [...(adjacency.get(e.b) ?? []), e.a])
    }
    const reach = (start: string, sameFloorOnly: boolean) => {
      const seen = new Set([start])
      const queue = [start]
      while (queue.length) {
        const id = queue.pop()!
        for (const n of adjacency.get(id) ?? []) {
          if (!seen.has(n) && (!sameFloorOnly || node.get(n)!.floor === node.get(start)!.floor)) {
            seen.add(n)
            queue.push(n)
          }
        }
      }
      return seen
    }

    it('has unique node ids and edges between existing nodes on the same floor', () => {
      expect(node.size).toBe(w.nodes.length)
      for (const e of w.edges) {
        expect(node.has(e.a) && node.has(e.b), `${e.a} - ${e.b}`).toBe(true)
        expect(node.get(e.a)!.floor, `${e.a} - ${e.b}`).toBe(node.get(e.b)!.floor)
      }
    })

    it('gives every room a door node on its own floor', () => {
      for (const room of data.rooms) {
        expect(room.door, room.id).toBeTruthy()
        expect(node.get(room.door!)?.floor, room.id).toBe(room.floor)
      }
    })

    it('connects every door on a floor to every other (each floor is one walkable network)', () => {
      for (const floor of data.floors) {
        const doors = roomsOn(floor.level).map((r) => r.door!)
        const seen = reach(doors[0]!, true)
        for (const d of doors) expect(seen.has(d), `${d} on floor ${floor.level}`).toBe(true)
      }
    })

    it('links the floors through stair and lift connectors that sit in matching rooms', () => {
      expect(w.connectors.length).toBeGreaterThan(0)
      for (const c of w.connectors) {
        expect(c.costPerFloor).toBeGreaterThan(0)
        expect(Object.keys(c.nodes).length, c.id).toBeGreaterThan(1)
        for (const [floor, id] of Object.entries(c.nodes)) {
          expect(node.get(id)?.floor, `${c.id} ${floor}`).toBe(Number(floor))
          const owner = data.rooms.find((r) => r.door === id)
          expect(owner?.type, `${c.id} ${floor}`).toBe(c.kind)
        }
      }
    })

    it('keeps every node inside the outline and outside every room', () => {
      for (const n of w.nodes) {
        expect(polygonInside([n.position, n.position, n.position], data.building.outline), n.id).toBe(true)
        for (const r of roomsOn(n.floor)) {
          const inside = pointInPolygon(n.position, r.polygon) && boundaryDistance(n.position, r.polygon) > 0.05
          expect(inside, `${n.id} in ${r.id}`).toBe(false)
        }
      }
    })

    it('draws no edge through a room', () => {
      for (const e of w.edges) {
        const a = node.get(e.a)!.position
        const b = node.get(e.b)!.position
        const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25)
        for (const r of roomsOn(node.get(e.a)!.floor)) {
          for (let i = 0; i < r.polygon.length; i++) {
            const p = r.polygon[i]!
            const q = r.polygon[(i + 1) % r.polygon.length]!
            expect(segmentsCross([a, b], [p, q]), `${e.a} - ${e.b} crosses ${r.id}`).toBe(false)
          }
          for (let i = 0; i <= steps; i++) {
            const pt: Point = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps]
            const inside = pointInPolygon(pt, r.polygon) && boundaryDistance(pt, r.polygon) > 0.05
            expect(inside, `${e.a} - ${e.b} inside ${r.id}`).toBe(false)
          }
        }
      }
    })

    it('lets a walker get from any door to any other on any floor through the connectors', () => {
      const all = new Set<string>()
      const queue = [data.rooms[0]!.door!]
      all.add(queue[0]!)
      while (queue.length) {
        const id = queue.pop()!
        const next = [...(adjacency.get(id) ?? [])]
        for (const c of w.connectors) if (Object.values(c.nodes).includes(id)) next.push(...Object.values(c.nodes))
        for (const n of next) if (!all.has(n)) { all.add(n); queue.push(n) }
      }
      for (const r of data.rooms) expect(all.has(r.door!), r.id).toBe(true)
    })
  })
})
