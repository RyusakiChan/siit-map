import { describe, expect, it } from 'vitest'
import { buildingData as data } from './data'
import { roomsOfTypes, search } from './search'

describe('search', () => {
  it('finds a room number with or without the dash', () => {
    for (const q of ['5-02', '502', '5 02']) {
      expect(search(q, data).rooms.some((r) => r.number === '5-02'), q).toBe(true)
    }
  })

  it('is case-insensitive and ranks exact numbers first', () => {
    const rooms = search('SAMPLE LAB 5-02', data).rooms
    expect(rooms[0]?.number).toBe('5-02')
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
    expect(rooms.length).toBe(data.rooms.filter((r) => r.type === 'restroom').length)
    expect(rooms.length).toBeGreaterThan(3)
    expect(rooms.every((r) => r.type === 'restroom')).toBe(true)
  })
})
