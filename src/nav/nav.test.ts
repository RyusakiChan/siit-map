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
  // Room 2-02 (door x -26.5, south band) to 2-03 (door x -15, north? see plan): both doors are on the spine.
  const plan = planRoute(room('sample-cla-2-02'), 'sample-lab-2-03')!

  it('finds a single-leg route that ends in the destination room', () => {
    expect(plan).not.toBeNull()
    expect(plan.legs).toHaveLength(1)
    expect(plan.legs[0]!.floor).toBe(2)
    expect(plan.legs[0]!.endRoomId).toBe('sample-lab-2-03')
    expect(plan.usesLift || plan.usesStairs).toBe(false)
    expect(plan.minutes).toBeGreaterThanOrEqual(1)
  })

  it('starts by leaving the start room and ends by arriving at the destination', () => {
    expect(plan.steps[0]).toMatchObject({ type: 'leave', roomId: 'sample-cla-2-02' })
    expect(plan.steps.at(-1)).toMatchObject({ type: 'arrive', roomId: 'sample-lab-2-03' })
  })

  it('returns null for the same room twice and for an unknown room', () => {
    expect(planRoute(room('sample-cla-2-02'), 'sample-cla-2-02')).toBeNull()
    expect(planRoute(room('sample-cla-2-02'), 'nope')).toBeNull()
    expect(planRoute(room('nope'), 'sample-cla-2-02')).toBeNull()
  })

  it('counts the Nth door on the correct side', () => {
    // Walking west along floor 2 from the lift (x -2) to the first door past the restroom.
    const p = planRoute({ kind: 'qr', id: 'sample-f2-lift' }, 'sample-lab-2-03')!
    const arrive = p.steps.at(-1)!
    expect(arrive.type).toBe('arrive')
    if (arrive.type !== 'arrive') return
    // Heading west (-x), south is on the left, north on the right.
    const dest = data.rooms.find((r) => r.id === 'sample-lab-2-03')!
    const south = dest.polygon.every((pt) => pt[1] > 0)
    expect(arrive.side).toBe(south ? 'left' : 'right')
    // Count by hand: doors on that side between the lift (x -2) and the destination door.
    const dx = data.walkways.nodes.find((n) => n.id === dest.door)!.position[0]
    const doors = data.rooms.filter((r) => {
      if (r.floor !== 2) return false
      const pos = data.walkways.nodes.find((n) => n.id === r.door)!.position
      return (pos[1] > 0) === south && pos[0] < -2 - 0.5 && pos[0] >= dx - 0.01
    })
    expect(arrive.nth).toBe(doors.length)
  })
})

describe('route across floors', () => {
  const lift = planRoute(room('sample-f2-lift'), 'sample-lab-5-02')!

  it('splits into one leg per floor and rides the lift from the lift room', () => {
    expect(lift.legs.map((l) => l.floor)).toEqual([2, 5])
    expect(lift.legs[0]!.ride).toMatchObject({ kind: 'elevator', toFloor: 5 })
    expect(types(lift)).toEqual(['ride', 'leave', 'walk', 'arrive'])
    expect(lift.steps.map((s) => s.floor)).toEqual([2, 5, 5, 5])
  })

  it('each leg starts where the last one ended, in the same shaft', () => {
    const first = lift.legs[0]!
    const second = lift.legs[1]!
    expect(first.endRoomId).toBe('sample-f2-lift')
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
    expect(p.legs[0]!.points[0]).toEqual([-2, 1.5])
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
