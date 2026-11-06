import { describe, expect, it } from 'vitest'
import { translate } from '../i18n'
import { stepText } from '../ui/routeText'
import { buildingData as data } from '../data'
import { bearingDeg, liveTurn, posterSpot, turnFor } from './orient'
import { planRoute } from './index'

const qr = (id: string) => ({ kind: 'qr' as const, id })
const room = (id: string) => ({ kind: 'room' as const, id })

describe('turnFor', () => {
  it('maps the four bands', () => {
    expect(turnFor(90, 0)).toBe('right') // poster ahead (north), walking east
    expect(turnFor(30, 0)).toBe('right')
    expect(turnFor(149, 0)).toBe('right')
    expect(turnFor(150, 0)).toBe('around')
    expect(turnFor(180, 0)).toBe('around')
    expect(turnFor(210, 0)).toBe('around')
    expect(turnFor(211, 0)).toBe('left')
    expect(turnFor(270, 0)).toBe('left')
    expect(turnFor(330, 0)).toBe('left')
    expect(turnFor(331, 0)).toBe('ahead')
    expect(turnFor(0, 0)).toBe('ahead')
    expect(turnFor(29, 0)).toBe('ahead')
  })

  it('wraps around 0/360', () => {
    expect(turnFor(10, 350)).toBe('ahead') // rel 20
    expect(turnFor(80, 350)).toBe('right') // rel 90
    expect(turnFor(260, 350)).toBe('left') // rel 270
    expect(turnFor(350, 170)).toBe('around') // rel 180
    expect(turnFor(350, 10)).toBe('ahead') // rel 340
    expect(turnFor(300, 10)).toBe('left') // rel 290
  })

  it('reads bearings clockwise from north (-z)', () => {
    expect(bearingDeg([0, 0], [0, -5])).toBeCloseTo(0)
    expect(bearingDeg([0, 0], [5, 0])).toBeCloseTo(90)
    expect(bearingDeg([0, 0], [0, 5])).toBeCloseTo(180)
    expect(bearingDeg([0, 0], [-5, 0])).toBeCloseTo(270)
  })
})

describe('orient step', () => {
  it('is present only for QR starts, and comes first', () => {
    const fromQr = planRoute(qr('f2-corr-se'), 'f4-1-413')!
    expect(fromQr.steps.map((s) => s.type)).toEqual(['orient', 'goFloor', 'find'])
    const same = planRoute(qr('f4-corr-se'), 'f4-1-413')!
    expect(same.steps.map((s) => s.type)).toEqual(['orient', 'follow'])
    const fromRoom = planRoute(room('f2-1-211'), 'f4-1-413')!
    expect(fromRoom.steps.map((s) => s.type)).toEqual(['goFloor', 'find'])
    expect(planRoute(room('f2-1-207'), 'f2-1-205')!.steps.map((s) => s.type)).toEqual(['follow'])
  })

  it('names the lifts or stairs on a multi-floor trip and the room on one floor', () => {
    const multi = planRoute(qr('f2-corr-se'), 'f4-1-413', { avoidStairs: true })!.steps[0]!
    expect(multi).toMatchObject({ type: 'orient', place: { kind: 'lifts' }, floor: 2 })
    const same = planRoute(qr('f4-corr-se'), 'f4-1-413')!.steps[0]!
    expect(same).toMatchObject({ type: 'orient', place: { kind: 'room', roomId: 'f4-1-413' }, floor: 4 })
  })

  it('says "right next to you" when the lifts are beside the scanner', () => {
    const step = planRoute(qr('f2-lift'), 'f4-1-413', { avoidStairs: true })!.steps[0]!
    expect(step).toMatchObject({ type: 'orient', turn: 'beside', place: { kind: 'lifts' } })
    expect(stepText(step, (k, v) => translate('en', k, v), 'en')).toBe('Face the map poster: the lifts are right next to you')
    expect(stepText(step, (k, v) => translate('th', k, v), 'th')).toBe('หันหน้าเข้าหาป้ายแผนที่ ลิฟต์อยู่ข้าง ๆ คุณ')
  })

  it('writes the turn in English and Thai', () => {
    const plan = planRoute(qr('f2-corr-se'), 'f4-1-413')!
    const step = plan.steps[0]!
    if (step.type !== 'orient' || step.turn === 'beside') throw new Error('expected a turn')
    const en = stepText(step, (k, v) => translate('en', k, v), 'en')
    const th = stepText(step, (k, v) => translate('th', k, v), 'th')
    if (step.turn === 'left' || step.turn === 'right') {
      expect(en).toMatch(new RegExp(`^Face the map poster, then turn ${step.turn} and walk toward the (lifts|stairs)$`))
      expect(th).toMatch(/^หันหน้าเข้าหาป้ายแผนที่ แล้วเลี้ยว(ซ้าย|ขวา) เดินไปทาง(ลิฟต์|บันได)$/)
    } else {
      expect(en).toMatch(/^Face the map poster, then /)
    }
  })
})

describe('posterSpot', () => {
  it('hangs the board on a wall within 4 m of every real QR point, or reports it', () => {
    for (const q of data.qrPoints.filter((p) => !p.sample)) {
      const spot = posterSpot({ x: q.position[0], z: q.position[1], floor: q.floor, facingDeg: q.facingDeg }, data)
      expect(spot.dist).toBeLessThanOrEqual(4)
      expect(Number.isFinite(spot.x)).toBe(true)
    }
  })
})

describe('liveTurn', () => {
  const step = { type: 'orient', turn: 'right' as const, bearing: 90 }
  it('keeps the planned turn without a heading', () => {
    expect(liveTurn(step, null)).toBe('right')
  })
  it('uses the live heading instead of the poster direction', () => {
    expect(liveTurn(step, 0)).toBe('right') // facing north, walking east
    expect(liveTurn(step, 180)).toBe('left') // turned round: east is now on the left
    expect(liveTurn(step, 270)).toBe('around')
    expect(liveTurn(step, 90)).toBe('ahead')
    expect(liveTurn(step, 350)).toBe('right') // wraps over north
  })
  it('flips left and right when the heading moves 180 degrees', () => {
    expect(liveTurn({ ...step, bearing: 60 }, 20)).toBe('right')
    expect(liveTurn({ ...step, bearing: 60 }, 200)).toBe('left')
  })
  it('leaves "beside" and non-orient steps alone', () => {
    expect(liveTurn({ type: 'orient', turn: 'beside', bearing: 0 }, 123)).toBe('beside')
    expect(liveTurn({ type: 'follow' }, 123)).toBeNull()
  })
})
