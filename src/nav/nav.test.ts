import { describe, expect, it } from 'vitest'
import { buildingData as data } from '../data'
import { findRoute, planRoute } from './index'
import type { RoutePlan } from './index'

const room = (id: string): { kind: 'room'; id: string } => ({ kind: 'room', id })
const types = (p: RoutePlan) => p.steps.map((s) => s.type)
const connectorIdsOn = (floor: number, lift: boolean) =>
  data.rooms.filter((r) => r.floor === floor && (r.type === 'elevator' || (!lift && r.type === 'stairs'))).map((r) => r.id)

describe('route on one floor', () => {
  // Real floor 2: the Document Room (1-207) to meeting room 1-205, both on the corridor round the conference block.
  const plan = planRoute(room('f2-1-207'), 'f2-1-205')!

  it('finds a single-leg route that ends in the destination room', () => {
    expect(plan).not.toBeNull()
    expect(plan.legs).toHaveLength(1)
    expect(plan.legs[0]!.floor).toBe(2)
    expect(plan.legs[0]!.endRoomId).toBe('f2-1-205')
    expect(plan.usesLift || plan.usesStairs).toBe(false)
    expect(plan.minutes).toBeGreaterThanOrEqual(1)
  })

  it('gives a single follow-the-line step', () => {
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]).toMatchObject({ type: 'follow', roomId: 'f2-1-205', floor: 2, leg: 0 })
    expect(plan.legs[0]!.points.length).toBeGreaterThan(1)
  })

  it('returns null for the same room twice and for an unknown room', () => {
    expect(planRoute(room('f2-1-207'), 'f2-1-207')).toBeNull()
    expect(planRoute(room('f2-1-207'), 'nope')).toBeNull()
    expect(planRoute(room('nope'), 'f2-1-207')).toBeNull()
  })
})

describe('route across floors', () => {
  const lift = planRoute(room('f2-lifts'), 'sample-lab-5-02')!

  it('splits into one leg per floor and rides the lift from the lift room', () => {
    expect(lift.legs.map((l) => l.floor)).toEqual([2, 5])
    expect(lift.legs[0]!.ride).toMatchObject({ kind: 'elevator', toFloor: 5 })
    expect(types(lift)).toEqual(['goFloor', 'find'])
    expect(lift.steps.map((s) => s.floor)).toEqual([2, 5])
  })

  it('each leg starts where the last one ended, in the same shaft', () => {
    const first = lift.legs[0]!
    const second = lift.legs[1]!
    expect(first.endRoomId).toBe('f2-lifts')
    expect(second.startRoomId).toBe('sample-f5-lift')
  })

  it('takes the stairs when they are cheaper, and the lift when stairs are avoided', () => {
    const stairs = planRoute(room('sample-f1-lobby'), 'sample-off-5-07')!
    expect(stairs.usesStairs).toBe(true)
    const avoid = planRoute(room('sample-f1-lobby'), 'sample-off-5-07', { avoidStairs: true })!
    expect(avoid.usesStairs).toBe(false)
    expect(avoid.usesLift).toBe(true)
    expect(avoid.legs.every((l) => !l.ride || l.ride.kind === 'elevator')).toBe(true)
  })

  describe('broad steps, floor 2 to floor 4', () => {
    const either = planRoute(room('f2-1-211'), 'f4-1-413')!
    const liftOnly = planRoute(room('f2-1-211'), 'f4-1-413', { avoidStairs: true })!

    it('is exactly two steps: go to the floor, then find the room', () => {
      expect(either.steps).toHaveLength(2)
      expect(either.steps[0]).toMatchObject({ type: 'goFloor', floor: 2, toFloor: 4, liftOnly: false })
      expect(either.steps[1]).toMatchObject({ type: 'find', floor: 4, roomId: 'f4-1-413' })
    })

    it('highlights every lift and every stairs on the start floor', () => {
      const step = either.steps[0]!
      if (step.type !== 'goFloor') throw new Error('expected goFloor')
      expect(step.connectorIds.length).toBeGreaterThan(1)
      expect([...step.connectorIds].sort()).toEqual(connectorIdsOn(2, false).sort())
      expect(step.connectorIds).toContain('f2-lifts')
      expect(step.connectorIds).toContain('f2-stairs-bottom')
    })

    it('with Avoid stairs it says lift and highlights only the lifts', () => {
      const step = liftOnly.steps[0]!
      if (step.type !== 'goFloor') throw new Error('expected goFloor')
      expect(step.liftOnly).toBe(true)
      expect(step.connectorIds).toEqual(connectorIdsOn(2, true))
      expect(step.connectorIds.every((id) => data.rooms.find((r) => r.id === id)!.type === 'elevator')).toBe(true)
      expect(liftOnly.steps).toHaveLength(2)
    })

    it('keeps the time from the shortest path', () => {
      expect(either.minutes).toBeGreaterThanOrEqual(1)
      expect(either.legs.map((l) => l.floor)).toEqual([2, 4])
    })

    it('a start that is itself a lift still gives the same two steps', () => {
      const p = planRoute(room('f2-lifts'), 'f4-1-413')!
      expect(types(p)).toEqual(['goFloor', 'find'])
      const step = p.steps[0]!
      if (step.type !== 'goFloor') throw new Error('expected goFloor')
      expect(step.connectorIds).toContain('f2-lifts')
    })
  })

  it('treats a multi-floor ride as one hop', () => {
    const p = planRoute(room('sample-f1-lobby'), 'sample-off-5-07', { avoidStairs: true })!
    expect(p.legs).toHaveLength(2)
    expect(p.legs[0]!.ride).toMatchObject({ toFloor: 5 })
  })

  it('costs the ride in the total time', () => {
    const geo = findRoute(room('sample-f1-lobby'), 'sample-off-5-07', { avoidStairs: true })!
    expect(geo.cost).toBeGreaterThan(geo.meters)
  })
})

describe('route from a QR spot', () => {
  it('starts on the QR floor with the same two broad steps', () => {
    const p = planRoute({ kind: 'qr', id: 'sample-f2-lift' }, 'sample-lab-5-02')!
    expect(p.legs[0]!.floor).toBe(2)
    expect(p.legs[0]!.startRoomId).toBeNull()
    expect(p.legs[0]!.points[0]).toEqual(data.qrPoints.find((q) => q.id === 'sample-f2-lift')!.position)
    expect(types(p)).toEqual(['goFloor', 'find'])
    expect(p.steps[0]!.floor).toBe(2)
    expect(p.legs.at(-1)!.endRoomId).toBe('sample-lab-5-02')
  })

  it('returns null for an unknown QR id', () => {
    expect(planRoute({ kind: 'qr', id: 'nope' }, 'sample-lab-5-02')).toBeNull()
  })
})

describe('every room can be reached from every floor', () => {
  it('plans a route from the lobby to each room, with and without stairs', () => {
    for (const r of data.rooms) {
      if (r.id === 'sample-f1-lobby') continue
      for (const avoidStairs of [false, true]) {
        const p = planRoute(room('sample-f1-lobby'), r.id, { avoidStairs })
        expect(p, `${r.id} avoidStairs=${avoidStairs}`).not.toBeNull()
        expect(p!.legs.at(-1)!.floor).toBe(r.floor)
        expect(p!.steps.at(-1)!.type === 'find' || p!.steps.at(-1)!.type === 'follow').toBe(true)
      }
    }
  })
})
