import { describe, expect, it } from 'vitest'
import { DRAG_CLOSE_PX, REVEAL_MAX_MS, revealStep, revealTotal, shouldCloseDrag } from './sheetMotion'

describe('shouldCloseDrag', () => {
  it('closes past the distance threshold', () => {
    expect(shouldCloseDrag(DRAG_CLOSE_PX + 1, 2000)).toBe(true)
    expect(shouldCloseDrag(DRAG_CLOSE_PX, 2000)).toBe(false)
  })
  it('closes on a fast flick, even a short one', () => {
    expect(shouldCloseDrag(60, 50)).toBe(true)
    expect(shouldCloseDrag(60, 400)).toBe(false)
  })
  it('ignores upward drags and tiny twitches', () => {
    expect(shouldCloseDrag(-200, 10)).toBe(false)
    expect(shouldCloseDrag(10, 5)).toBe(false)
  })
})

describe('line reveal timing', () => {
  it('uses 50 ms steps for short answers', () => {
    expect(revealStep(1)).toBe(0)
    expect(revealStep(3)).toBe(50)
    expect(revealTotal(3)).toBe(400)
  })
  it('never exceeds the 500 ms cap', () => {
    for (const n of [1, 4, 5, 6, 12, 40]) expect(revealTotal(n)).toBeLessThanOrEqual(REVEAL_MAX_MS)
    expect(revealStep(12)).toBeLessThan(50)
  })
  it('is zero for no lines', () => {
    expect(revealTotal(0)).toBe(0)
  })
})
