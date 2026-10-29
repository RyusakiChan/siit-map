import { describe, expect, it } from 'vitest'
import { buildingData as data } from './data'
import { roomsOfTypes, search } from './search'

describe('search', () => {
  it('finds a room number with or without the dash', () => {
    for (const q of ['2-03', '203', '2 03']) {
      expect(search(q, data).rooms.some((r) => r.number === '2-03'), q).toBe(true)
    }
  })

  it('is case-insensitive and ranks exact numbers first', () => {
    const rooms = search('SAMPLE LAB 2-03', data).rooms
    expect(rooms[0]?.number).toBe('2-03')
  })

  it('finds rooms by alias and Thai name', () => {
    expect(search('toilet', data).rooms.some((r) => r.type === 'restroom')).toBe(true)
    expect(search('คาเฟ่', data).rooms.some((r) => r.type === 'foodservice')).toBe(true)
  })

  it('finds departments by name and by their rooms', () => {
    expect(search('dept b', data).departments.map((d) => d.id)).toContain('sample-dept-b')
    expect(search('lab', data).departments.length).toBeGreaterThan(0)
  })

  it('returns nothing for an empty or unknown query', () => {
    expect(search('  ', data).rooms).toEqual([])
    expect(search('zzzz', data).rooms).toEqual([])
  })

  it('lists rooms by type', () => {
    const rooms = roomsOfTypes(['restroom'], data)
    expect(rooms.length).toBe(5)
    expect(rooms.every((r) => r.type === 'restroom')).toBe(true)
  })
})
