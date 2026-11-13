import { describe, expect, it } from 'vitest'
import { translate } from '../i18n'
import { stepText } from '../ui/routeText'
import { buildingData as data } from '../data'
import { validate } from '../data/validate'
import { planRoute } from './index'
import { nearestPlaces } from './near'

const qr = (id: string) => ({ kind: 'qr' as const, id })
const text = (s: Parameters<typeof stepText>[0], lang: 'en' | 'th') => stepText(s, (k, v) => translate(lang, k, v), lang)
const errs = (d: typeof data) => validate(d).filter((p) => p.severity === 'error').map((p) => p.code)
const plain = (floor: number) => data.rooms.find((r) => r.floor === floor && r.door && r.type !== 'stairs' && r.type !== 'elevator')!

describe('landing QR validator', () => {
  it('accepts the five landing points', () => {
    expect(data.qrPoints.filter((q) => q.landing)).toHaveLength(5)
    expect(errs(data)).toEqual([])
  })

  it('needs a stairs room on the floor and a floor above', () => {
    const d = structuredClone(data)
    d.qrPoints.find((p) => p.id === 'f2-landing-s')!.position = [0, 0]
    expect(errs(d)).toContain('qr-landing-stairs')
    const d2 = structuredClone(data)
    d2.qrPoints.find((p) => p.id === 'f4-landing-s')!.floor = 5
    expect(errs(d2)).toContain('qr-landing-floor')
  })
})

describe('route from a landing', () => {
  it('starts on the upper floor for a floor 3 room, with a Go up first step', () => {
    const p = planRoute(qr('f2-landing-s'), plain(3).id)!
    expect(p.legs[0]!.floor).toBe(3)
    expect(p.steps[0]).toMatchObject({ type: 'landing', direction: 'up', toFloor: 3, floor: 3 })
    expect(text(p.steps[0]!, 'en')).toBe('Go up to Floor 3')
    expect(text(p.steps[0]!, 'th')).toBe('ขึ้นบันไดไปชั้น 3')
  })

  it('starts on the lower floor for a floor 2 room, with a Go down first step', () => {
    const p = planRoute(qr('f2-landing-s'), plain(2).id)!
    expect(p.legs[0]!.floor).toBe(2)
    expect(p.steps[0]).toMatchObject({ type: 'landing', direction: 'down', toFloor: 2, floor: 2 })
    expect(text(p.steps[0]!, 'en')).toBe('Go down to Floor 2')
    expect(text(p.steps[0]!, 'th')).toBe('ลงบันไดไปชั้น 2')
  })

  it('goes down to floor 1 and up past the next floor', () => {
    expect(planRoute(qr('f3-landing-w'), plain(1).id)!.steps[0]).toMatchObject({ type: 'landing', direction: 'down', floor: 3 })
    const p = planRoute(qr('f3-landing-s'), plain(5).id)!
    expect(p.legs[0]!.floor).toBe(4)
    expect(p.steps.map((s) => s.type)).toEqual(['landing', 'goFloor', 'find'])
  })

  it('has no compass turn on that step, and Near you works from the landing', () => {
    const p = planRoute(qr('f2-landing-w'), plain(2).id)!
    expect(p.steps[0]).not.toHaveProperty('turn')
    expect(nearestPlaces('f3-landing-w').length).toBeGreaterThan(0)
  })
})
