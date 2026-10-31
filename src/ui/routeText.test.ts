import { describe, expect, it } from 'vitest'
import { translate } from '../i18n'
import { planRoute } from '../nav'
import { stepText } from './routeText'

const room = (id: string) => ({ kind: 'room' as const, id })
const text = (lang: 'en' | 'th', from: string, to: string, avoidStairs = false) =>
  planRoute(room(from), to, { avoidStairs })!.steps.map((s) => stepText(s, (k, v) => translate(lang, k, v), lang))

describe('broad step text', () => {
  it('says lift or stairs, then finds the room', () => {
    const [a, b] = text('en', 'f2-1-211', 'f4-1-413')
    expect(a).toBe('Go to Floor 4 by lift or stairs')
    expect(b).toMatch(/^On Floor 4, find /)
  })

  it('says lift only when stairs are avoided', () => {
    expect(text('en', 'f2-1-211', 'f4-1-413', true)[0]).toBe('Go to Floor 4 by lift')
  })

  it('has the Thai wording', () => {
    const [a, b] = text('th', 'f2-1-211', 'f4-1-413')
    expect(a).toBe('ไปชั้น 4 ด้วยลิฟต์หรือบันได')
    expect(b).toMatch(/^ที่ชั้น 4 หา/)
    expect(text('th', 'f2-1-211', 'f4-1-413', true)[0]).toBe('ไปชั้น 4 ด้วยลิฟต์')
  })

  it('follows the line on one floor with a rounded distance', () => {
    const [a] = text('en', 'f2-1-207', 'f2-1-205')
    expect(a).toMatch(/^Follow the line to .+, about \d+ m$/)
    expect(text('th', 'f2-1-207', 'f2-1-205')[0]).toMatch(/^เดินตามเส้นไปที่.+ ประมาณ \d+ เมตร$/)
  })
})
