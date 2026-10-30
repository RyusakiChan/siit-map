import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'
import { deleteBlock, departmentId, freeLetter, freeSlot, sharedSlots, urlOk, letterOk, DEPT_COLOR_SLOTS } from './departments'
import { validate } from './validate'
import { replaceDepartments } from '../trace/saveFloor'
import { departmentBadgeColor, deptColor, roomColor, tintKeyOf, typeTints } from '../theme/colors'
import { slotColors, slotNames } from '../theme/slots'
import type { BuildingData } from './types'

const clone = (): BuildingData => structuredClone(data)
const codes = (d: BuildingData) => new Set(validate(d).map((p) => p.code))

describe('department ids', () => {
  it('makes d-<slug> from the first name', () => {
    expect(departmentId('Information Technology', { departments: [], usedIds: [] })).toBe('d-information-technology')
    expect(departmentId('  Civil & Env. Eng. ', { departments: [], usedIds: [] })).toBe('d-civil-env-eng')
    expect(departmentId('วิศวกรรม', { departments: [], usedIds: [] })).toBe('d-dept')
  })

  it('never reuses an id, even a deleted one', () => {
    const d = clone()
    d.departments.push({ id: 'd-it', name: 'IT', letter: 'I', colorSlot: 3 })
    expect(departmentId('IT', d)).toBe('d-it-2')
    d.usedIds = ['d-it-2']
    expect(departmentId('IT', d)).toBe('d-it-3')
  })

  it('picks a free letter and the least used colour slot', () => {
    expect(freeLetter([{ letter: 'A' }, { letter: 'B' }])).toBe('C')
    expect(freeLetter('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => ({ letter })))).toBe('AA')
    expect(freeSlot([{ colorSlot: 0 }, { colorSlot: 1 }, { colorSlot: 2 }])).toBe(3)
    expect(freeSlot(Array.from({ length: DEPT_COLOR_SLOTS }, (_, i) => ({ colorSlot: i })))).toBe(0)
    expect(sharedSlots([{ id: 'a', colorSlot: 1 }, { id: 'b', colorSlot: 1 }, { id: 'c', colorSlot: 2 }]).get(1)).toEqual(['a', 'b'])
  })
})

describe('deleting a department', () => {
  it('is blocked while rooms use it and says how many', () => {
    const id = data.rooms.find((r) => r.departmentId)!.departmentId!
    const n = data.rooms.filter((r) => r.departmentId === id).length
    expect(deleteBlock(data, id)).toContain(`${n} room`)
    expect(deleteBlock({ rooms: [] }, id)).toBeNull()
  })

  it('is refused by the save when saved rooms still use it, and retires the id when removed', () => {
    const d = clone()
    const used = d.departments[0]!.id
    expect(() => replaceDepartments(d, d.departments.slice(1))).toThrow(/still used/)
    const free = { ...d, rooms: d.rooms.filter((r) => r.departmentId !== used) }
    const out = replaceDepartments(free, free.departments.slice(1))
    expect(out.departments.some((x) => x.id === used)).toBe(false)
    expect(out.usedIds).toContain(used)
    expect(() => replaceDepartments(out, [...out.departments, { ...d.departments[0]!, id: used }])).toThrow(/retired/)
  })
})

describe('department validation', () => {
  it('checks letters, urls, summary length, slots and unknown departments', () => {
    const d = clone()
    d.departments[0]!.letter = 'a1'
    d.departments[1]!.url = 'http://example.com'
    d.departments[2]!.summary = 'x'.repeat(281)
    d.departments[2]!.colorSlot = 9
    d.rooms[0]!.departmentId = 'd-ghost'
    const c = codes(d)
    for (const k of ['department-letter-format', 'department-url', 'department-summary', 'department-slot', 'room-department']) expect(c.has(k), k).toBe(true)
    expect(urlOk('https://www.siit.tu.ac.th/x')).toBe(true)
    expect(urlOk('www.siit.tu.ac.th')).toBe(false)
    expect(letterOk('AB')).toBe(true)
    expect(letterOk('ABC')).toBe(false)
  })

  it('flags duplicate letters and ids, and only warns about a department no room uses', () => {
    const d = clone()
    d.departments.push({ id: d.departments[0]!.id, name: 'Twin', letter: d.departments[0]!.letter, colorSlot: 0 })
    const c = codes(d)
    expect(c.has('department-duplicate') && c.has('department-letter')).toBe(true)

    const e = clone()
    e.departments.push({ id: 'd-empty', name: 'Empty', letter: 'Z', colorSlot: 4 })
    const unused = validate(e).find((p) => p.code === 'department-unused')
    expect(unused?.severity).toBe('warning')
    expect(validate(e).filter((p) => p.severity === 'error')).toEqual([])
  })
})

describe('colour slots', () => {
  it('has 8 slots, the first three unchanged', () => {
    expect(slotColors).toHaveLength(DEPT_COLOR_SLOTS)
    expect(slotColors[0]).toMatchObject({ top: '#7CC8F8', side: '#5AAEE0' })
    expect(slotColors[1]).toMatchObject({ top: '#B9A3FF', side: '#9B84E6' })
    expect(slotColors[2]).toMatchObject({ top: '#5FDCC8', side: '#3FC0AC' })
    expect(new Set(slotColors.map((c) => c.top)).size).toBe(DEPT_COLOR_SLOTS)
  })

  it('keeps every badge shade at 3:1 or more on white, and names every slot', () => {
    const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const lum = (h: string) => 0.2126 * lin(parseInt(h.slice(1, 3), 16)) + 0.7152 * lin(parseInt(h.slice(3, 5), 16)) + 0.0722 * lin(parseInt(h.slice(5, 7), 16))
    for (const [i, c] of slotColors.entries()) expect(1.05 / (lum(c.badge) + 0.05), `slot ${i}`).toBeGreaterThanOrEqual(3)
    expect(slotNames).toHaveLength(slotColors.length)
    expect(slotColors[0]!.side).toBe('#5AAEE0')
    expect(departmentBadgeColor(data.departments[0]!.id)).toBe(slotColors[0]!.badge)
  })

  it('reads a department colour from its slot, not its id', () => {
    expect(deptColor({ colorSlot: 5 })).toBe(slotColors[5])
    expect(deptColor({ colorSlot: 99 })).toBeUndefined()
    expect(deptColor(undefined)).toBeUndefined()
    data.departments.forEach((dep, i) => expect(deptColor(dep)).toBe(slotColors[i]))
  })

  it('colours sample rooms as before: department slot, grey for lifts and stairs, the type tint otherwise', () => {
    const room = data.rooms.find((r) => r.departmentId === data.departments[0]!.id && r.type !== 'stairs' && r.type !== 'elevator')!
    expect(roomColor(room)).toBe(slotColors[0])
    expect(departmentBadgeColor(room.departmentId)).toBe(slotColors[0]!.badge)
    expect(roomColor(data.rooms.find((r) => r.type === 'elevator')!).top).toBe('#A89EA9')
    expect(roomColor({ ...room, departmentId: null }).top).toBe(typeTints[tintKeyOf(room.type) as 'other'].top)
  })
})
