import { describe, expect, it } from 'vitest'
import { angleDelta, headingFromAlpha, headingFromWebkit, normalizeDeg, readHeading, smoothAngle, smoothFactor } from './compass'

describe('heading maths', () => {
  it('turns alpha (counter-clockwise) into a clockwise heading', () => {
    expect(headingFromAlpha(0)).toBe(0)
    expect(headingFromAlpha(90)).toBe(270)
    expect(headingFromAlpha(270)).toBe(90)
    expect(headingFromAlpha(359)).toBe(1)
  })
  it('corrects for the screen angle', () => {
    // Landscape (screen turned 90): phone top points west (alpha 90) but the screen faces north.
    expect(headingFromAlpha(90, 90)).toBe(0)
    expect(headingFromAlpha(0, 270)).toBe(270)
    expect(headingFromWebkit(270, 90)).toBe(0)
    expect(headingFromWebkit(10, 0)).toBe(10)
  })
  it('wraps into 0..360', () => {
    expect(normalizeDeg(-10)).toBe(350)
    expect(normalizeDeg(370)).toBe(10)
    expect(angleDelta(359, 1)).toBe(2)
    expect(angleDelta(1, 359)).toBe(-2)
    expect(angleDelta(0, 180)).toBe(180)
  })
})

describe('readHeading', () => {
  it('reads an absolute Android event', () => {
    expect(readHeading({ alpha: 90, absolute: true }, 0)).toBe(270)
  })
  it('ignores relative events and missing alpha', () => {
    expect(readHeading({ alpha: 90, absolute: false })).toBeNull()
    expect(readHeading({ alpha: null, absolute: true })).toBeNull()
  })
  it('reads the iOS heading and drops poor accuracy', () => {
    expect(readHeading({ alpha: 0, absolute: false, webkitCompassHeading: 123, webkitCompassAccuracy: 10 })).toBe(123)
    expect(readHeading({ alpha: 0, absolute: false, webkitCompassHeading: 123, webkitCompassAccuracy: 45 })).toBe(123)
    expect(readHeading({ alpha: 0, absolute: false, webkitCompassHeading: 123, webkitCompassAccuracy: 46 })).toBeNull()
    expect(readHeading({ alpha: 0, absolute: false, webkitCompassHeading: 123, webkitCompassAccuracy: -1 })).toBeNull()
  })
})

describe('smoothAngle', () => {
  it('goes the short way round the circle', () => {
    expect(smoothAngle(359, 1, 0.5)).toBe(0)
    expect(smoothAngle(1, 359, 0.5)).toBe(0)
    expect(smoothAngle(350, 20, 1)).toBe(20)
  })
  it('moves a fraction toward the target and stays put at 0', () => {
    expect(smoothAngle(0, 90, 0.5)).toBe(45)
    expect(smoothAngle(100, 200, 0)).toBe(100)
  })
  it('never overshoots', () => {
    let h = 355
    for (let i = 0; i < 50; i++) h = smoothAngle(h, 5, 0.3)
    expect(angleDelta(h, 5)).toBeGreaterThanOrEqual(0)
    expect(Math.abs(angleDelta(h, 5))).toBeLessThan(0.01)
  })
  it('smooths more for short steps', () => {
    expect(smoothFactor(16)).toBeLessThan(smoothFactor(100))
    expect(smoothFactor(0)).toBe(0)
  })
})
