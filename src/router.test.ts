import { describe, expect, it } from 'vitest'
import { parseHash, routePath } from './router'

describe('hash router', () => {
  it('parses every route shape', () => {
    expect(parseHash('')).toEqual({ name: 'map' })
    expect(parseHash('#/')).toEqual({ name: 'map' })
    expect(parseHash('#/room/sample-lab-2-03')).toEqual({ name: 'room', id: 'sample-lab-2-03' })
    expect(parseHash('#/dept/sample-dept-a')).toEqual({ name: 'dept', id: 'sample-dept-a' })
    expect(parseHash('#/at/sample-f2-lift')).toEqual({ name: 'at', id: 'sample-f2-lift' })
    expect(parseHash('#/about')).toEqual({ name: 'about' })
  })

  it('falls back to the map for unknown or incomplete routes', () => {
    expect(parseHash('#/nonsense')).toEqual({ name: 'map' })
    expect(parseHash('#/room/')).toEqual({ name: 'map' })
  })

  it('gives each route its own analytics path', () => {
    expect(routePath(parseHash('#/at/sample-f2-lift'))).toBe('/at/sample-f2-lift')
    expect(routePath(parseHash('#/'))).toBe('/')
    expect(routePath(parseHash('#/about'))).toBe('/about')
  })
})
