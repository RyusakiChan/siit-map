import { describe, expect, it } from 'vitest'
import { buildingData as data } from '../data'
import { findRoute, planRoute, heading, turnBetween } from './index'
import type { RoutePlan } from './index'

const room = (id: string): { kind: 'room'; id: string } => ({ kind: 'room', id })
const types = (p: RoutePlan) => p.steps.map((s) => s.type)

describe('headings and turns (x east, z south)', () => {
  it('measures headings clockwise from north', () => {
    expect(heading([0, 0], [0, -5])).toBeCloseTo(0) // north is -z
    expect(heading([0, 0], [5, 0])).toBeCloseTo(90) // east
    expect(heading([0, 0], [0, 5])).toBeCloseTo(180) // south
  })

  it('calls east-then-north a left turn and east-then-south a right turn', () => {
    expect(turnBetween(heading([0, 0], [5, 0]), heading([5, 0], [5, -5]))).toBeLessThan(0)
    expect(turnBetween(heading([0, 0], [5, 0]), heading([5, 0], [5, 5]))).toBeGreaterThan(0)
    expect(turnBetween(350, 10)).toBeCloseTo(20) // across north
  })
})

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

  it('starts by leaving the start room and ends by arriving at the destination', () => {
    expect(plan.steps[0]).toMatchObject({ type: 'leave', roomId: 'f2-1-207' })
    expect(plan.steps.at(-1)).toMatchObject({ type: 'arrive', roomId: 'f2-1-205' })
  })

  it('returns null for the same room twice and for an unknown room', () => {
    expect(planRoute(room('f2-1-207'), 'f2-1-207')).toBeNull()
    expect(planRoute(room('f2-1-207'), 'nope')).toBeNull()
    expect(planRoute(room('nope'), 'f2-1-207')).toBeNull()
  })

  it('counts doors on one side when it arrives', () => {
    const p = planRoute({ kind: 'qr', id: 'sample-f2-lift' }, 'f2-1-205')!
    const arrive = p.steps.at(-1)!
    expect(arrive.type).toBe('arrive')
    if (arrive.type !== 'arrive') return
    expect(['left', 'right']).toContain(arrive.side)
    expect(Number.isInteger(arrive.nth)).toBe(true)
    expect(arrive.nth).toBeGreaterThanOrEqual(1)
  })
})

describe('route across floors', () => {
  const lift = planRoute(room('f2-lifts'), 'sample-lab-5-02')!

  it('splits into one leg per floor and rides the lift from the lift room', () => {
    expect(lift.legs.map((l) => l.floor)).toEqual([2, 5])
    expect(lift.legs[0]!.ride).toMatchObject({ kind: 'elevator', toFloor: 5 })
    expect(types(lift)).toEqual(['ride', 'leave', 'walk', 'arrive'])
    expect(lift.steps.map((s) => s.floor)).toEqual([2, 5, 5, 5])
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
    expect(types(stairs)).toContain('ride')
    const avoid = planRoute(room('sample-f1-lobby'), 'sample-off-5-07', { avoidStairs: true })!
    expect(avoid.usesStairs).toBe(false)
    expect(avoid.usesLift).toBe(true)
    expect(avoid.legs.every((l) => !l.ride || l.ride.kind === 'elevator')).toBe(true)
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
  it('starts on the QR floor without a leave step', () => {
    const p = planRoute({ kind: 'qr', id: 'sample-f2-lift' }, 'sample-lab-5-02')!
    expect(p.legs[0]!.floor).toBe(2)
    expect(p.legs[0]!.startRoomId).toBeNull()
    expect(p.legs[0]!.points[0]).toEqual(data.qrPoints.find((q) => q.id === 'sample-f2-lift')!.position)
    expect(p.steps[0]!.type).not.toBe('leave')
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
        expect(p!.steps.at(-1)!.type === 'arrive' || p!.steps.at(-1)!.type === 'ride').toBe(true)
      }
    }
  })
})
