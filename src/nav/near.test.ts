import { describe, expect, it } from 'vitest'
import { buildingData as data } from '../data'
import { nearestPlaces, walkLabel } from './near'

describe('walkLabel', () => {
  it('rounds metres to 5 and minutes up', () => {
    expect(walkLabel(18)).toEqual({ meters: 20, minutes: 1 })
    expect(walkLabel(1.5)).toEqual({ meters: 5, minutes: 1 })
    expect(walkLabel(73)).toEqual({ meters: 75, minutes: 2 })
    expect(walkLabel(72)).toEqual({ meters: 70, minutes: 1 })
  })
})

describe('nearestPlaces', () => {
  it('lists 5 places on the QR floor, nearest first, starting with the lift in front of the sign', () => {
    const list = nearestPlaces('f3-lift')
    expect(list).toHaveLength(5)
    expect(list.every((p) => p.room.floor === 3 && p.sameFloor)).toBe(true)
    expect(list[0]!.room.type).toBe('elevator')
    const meters = list.map((p) => p.meters)
    expect(meters).toEqual([...meters].sort((a, b) => a - b))
  })

  it('filters by type and puts the same floor first, then other floors', () => {
    const lifts = nearestPlaces('f3-lift', { types: ['elevator'], count: 99 })
    expect(lifts[0]!.room.floor).toBe(3)
    const flags = lifts.map((p) => Number(p.sameFloor))
    expect(flags).toEqual([...flags].sort((a, b) => b - a))
    expect(lifts.length).toBeGreaterThan(1)
  })

  it('finds a restroom on the same floor from every real QR point', () => {
    for (const q of data.qrPoints.filter((p) => !p.sample)) {
      const r = nearestPlaces(q.id, { types: ['restroom'], count: 1 })[0]
      expect(r, q.id).toBeDefined()
      expect(r!.room.floor, q.id).toBe(q.floor)
    }
  })

  it('returns nothing for an unknown QR id', () => {
    expect(nearestPlaces('nope')).toEqual([])
  })
})
