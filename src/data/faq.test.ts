import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'
import { faqEntries } from './faq'

describe('faq.json', () => {
  it('has unique ids and the required text', () => {
    const ids = faqEntries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of faqEntries) {
      expect(e.task.length, e.id).toBeGreaterThan(0)
      expect(e.answer.length, e.id).toBeGreaterThan(0)
    }
  })

  it('points at rooms and departments that exist', () => {
    const rooms = new Set(data.rooms.map((r) => r.id))
    const depts = new Set(data.departments.map((d) => d.id))
    for (const e of faqEntries) {
      if (e.roomId) expect(rooms.has(e.roomId), `${e.id}: ${e.roomId}`).toBe(true)
      if (e.deptId) expect(depts.has(e.deptId), `${e.id}: ${e.deptId}`).toBe(true)
    }
  })

  it('links only to https pages', () => {
    for (const e of faqEntries) expect(e.url.startsWith('https://'), e.id).toBe(true)
  })
})
