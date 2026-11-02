import { describe, expect, it } from 'vitest'
import { buildingData as data } from './data'
import { roomsOfTypes, search } from './search'

describe('search', () => {
  it('finds a room number with or without the dash', () => {
    for (const q of ['1-502', '1502', '1 502']) {
      expect(search(q, data).rooms.some((r) => r.number === '1-502'), q).toBe(true)
    }
  })

  it('is case-insensitive and ranks exact numbers first', () => {
    const rooms = search('1-502', data).rooms
    expect(rooms[0]?.number).toBe('1-502')
  })

  it('finds rooms by alias and Thai name', () => {
    expect(search('toilet', data).rooms.some((r) => r.type === 'restroom')).toBe(true)
    expect(search('คาเฟ่', data).rooms.some((r) => r.type === 'foodservice')).toBe(true)
  })

  it('finds departments by name and by their rooms', () => {
    expect(search('bcet', data).departments.map((d) => d.id)).toContain('d-bcet')
    expect(search('school', data).departments.length).toBeGreaterThan(0)
  })

  it('returns nothing for an empty or unknown query', () => {
    expect(search('  ', data).rooms).toEqual([])
    expect(search('zzzz', data).rooms).toEqual([])
  })

  it('lists rooms by type', () => {
    const rooms = roomsOfTypes(['restroom'], data)
    expect(rooms.length).toBe(data.rooms.filter((r) => r.type === 'restroom').length)
    expect(rooms.length).toBeGreaterThan(3)
    expect(rooms.every((r) => r.type === 'restroom')).toBe(true)
  })
})
