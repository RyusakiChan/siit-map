import { describe, expect, it } from 'vitest'
import { buildingData as data } from '../data'
import { polygonInside } from '../data/geometry'
import { search } from '../search'
import { validate } from '../data/validate'
import type { Point } from '../data/types'
import { buildKiosk, KIOSK_HEIGHT, setKioskDim } from './kiosks'

const brandFiles = Object.keys(import.meta.glob('../../public/brands/*', { query: '?url' }))
const doorPos = new Map(data.walkways.nodes.map((n) => [n.id, n.position] as const))
const withModel = data.rooms.filter((r) => r.model)

describe('kiosk models', () => {
  it('are set on the ATM and Tao Bin only', () => {
    expect(withModel.map((r) => [r.id, r.model])).toEqual([
      ['f1-tao-bin', 'kiosk-taobin'],
      ['f1-atm', 'atm-krungsri'],
    ])
  })

  for (const room of withModel) {
    const door = room.door ? doorPos.get(room.door) : undefined
    const k = buildKiosk(room.model!, room.polygon, door)

    it(`${room.id}: stays inside its room polygon`, () => {
      const { minX, maxX, minZ, maxZ } = k.bbox
      const box: Point[] = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]]
      expect(polygonInside(box, room.polygon, 0.001)).toBe(true)
    })

    it(`${room.id}: has about the real height and a small triangle count`, () => {
      expect(k.height).toBe(KIOSK_HEIGHT[room.model!])
      const pos = k.geometry.getAttribute('position')
      let top = 0
      let bottom = Infinity
      for (let i = 0; i < pos.count; i++) {
        top = Math.max(top, pos.getY(i))
        bottom = Math.min(bottom, pos.getY(i))
      }
      expect(top).toBeCloseTo(k.height, 2)
      expect(bottom).toBeCloseTo(0, 5)
      expect(k.triangles).toBeLessThan(500)
    })

    it(`${room.id}: front points towards the door`, () => {
      const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length
      const cz = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length
      const toDoor = [door![0] - cx, door![1] - cz]
      expect(k.front[0] * toDoor[0]! + k.front[1] * toDoor[1]!).toBeGreaterThan(0.3)
      // The logo face sits on the front, facing the door, and is a flat 4-corner quad.
      expect(k.logo.normal).toEqual(k.front)
      expect(k.logo.geometry.getAttribute('position').count).toBe(4)
      const front = k.logo.center[0] * k.front[0] + k.logo.center[2] * k.front[1]
      const backMost = Math.min(...[[k.bbox.minX, k.bbox.minZ], [k.bbox.maxX, k.bbox.maxZ]].map(([x, z]) => x! * k.front[0] + z! * k.front[1]))
      expect(front).toBeGreaterThan(backMost)
    })

    it(`${room.id}: dimming rewrites colours and can be undone`, () => {
      const attr = k.geometry.getAttribute('color')
      const first = attr.getX(0)
      setKioskDim(k, 1)
      expect(attr.getX(0)).not.toBeCloseTo(first, 3)
      setKioskDim(k, 0)
      expect(attr.getX(0)).toBeCloseTo(first, 5)
    })
  }
})

describe('ATM search and data', () => {
  it('finds the ATM by ATM, Krungsri and the Thai name', () => {
    for (const q of ['ATM', 'krungsri', 'กรุงศรี']) {
      expect(search(q, data).rooms.map((r) => r.id), q).toContain('f1-atm')
    }
  })

  it('rejects an unknown model name', () => {
    const d = structuredClone(data)
    ;(d.rooms.find((r) => r.id === 'f1-atm') as { model?: string }).model = 'nope'
    expect(validate(d).some((p) => p.code === 'room-model')).toBe(true)
  })
})

describe('room logos', () => {
  it('point at files that exist under public/brands', () => {
    const logos = data.rooms.filter((r) => r.logo)
    expect(logos.map((r) => r.id).sort()).toEqual(['f1-atm', 'f1-cafe-amazon', 'f1-tao-bin'])
    for (const r of logos) expect(brandFiles.some((f) => f.endsWith(`/${r.logo}`)), r.logo).toBe(true)
  })

  it('rejects a logo outside brands/', () => {
    const d = structuredClone(data)
    d.rooms.find((r) => r.id === 'f1-atm')!.logo = '../secret.png'
    expect(validate(d).some((p) => p.code === 'room-logo')).toBe(true)
  })
})
