import { describe, expect, it } from 'vitest'
import { parseHash, routeHashPath, routePath } from './router'

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

  it('parses route links with a room or a QR start', () => {
    expect(parseHash('#/route/sample-f1-lobby/sample-lab-2-03')).toEqual({ name: 'route', from: 'sample-f1-lobby', to: 'sample-lab-2-03' })
    expect(parseHash('#/route/%40sample-f2-lift/sample-lab-2-03')).toEqual({ name: 'route', from: '@sample-f2-lift', to: 'sample-lab-2-03' })
    expect(parseHash('#/route/@sample-f2-lift/sample-lab-2-03')).toEqual({ name: 'route', from: '@sample-f2-lift', to: 'sample-lab-2-03' })
    expect(routePath(parseHash('#/route/a/b'))).toBe('/route/a/b')
  })

  it('falls back to the map for broken route links', () => {
    expect(parseHash('#/route/a')).toEqual({ name: 'map' })
    expect(parseHash('#/route//b')).toEqual({ name: 'map' })
    expect(parseHash('#/route/a/b/c')).toEqual({ name: 'map' })
    expect(parseHash('#/route/%E0%A4%A/b')).toEqual({ name: 'map' })
  })

  it('builds route hashes that parse back', () => {
    const path = routeHashPath('@sample-f2-lift', 'sample-lab-2-03')
    expect(parseHash(`#${path}`)).toEqual({ name: 'route', from: '@sample-f2-lift', to: 'sample-lab-2-03' })
  })
})
