import type { BuildingData, Department, Room } from './types.ts'

/** Number of department colour slots (see slotColors in src/theme/colors.ts). */
export const DEPT_COLOR_SLOTS = 8
export const SUMMARY_MAX = 280

export const letterOk = (letter: string) => /^[A-Z]{1,2}$/.test(letter)
export const urlOk = (url: string) => /^https:\/\/[^\s/$.?#][^\s]*$/i.test(url)

/** `d-<slug>` from a name; adds -2, -3 … when the id was ever used. Ids never change after this. */
export function departmentId(name: string, data: Pick<BuildingData, 'departments' | 'usedIds'>): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'dept'
  const taken = new Set([...data.departments.map((d) => d.id), ...(data.usedIds ?? [])])
  let id = `d-${slug}`
  for (let n = 2; taken.has(id); n++) id = `d-${slug}-${n}`
  return id
}

/** Every department a room belongs to: its one `departmentId`, or all of `departmentIds` for a shared room. */
export const roomDeptIds = (room: Pick<Room, 'departmentId' | 'departmentIds'>): string[] =>
  room.departmentIds?.length ? room.departmentIds : room.departmentId ? [room.departmentId] : []

export const roomsUsing = (data: Pick<BuildingData, 'rooms'>, id: string) => data.rooms.filter((r) => roomDeptIds(r).includes(id)).length

/** Null when the department can go; otherwise why not. */
export function deleteBlock(data: Pick<BuildingData, 'rooms'>, id: string): string | null {
  const n = roomsUsing(data, id)
  return n ? `${n} room${n === 1 ? '' : 's'} still use${n === 1 ? 's' : ''} this department. Change those rooms first.` : null
}

/** First unused letter A–Z (then AA, AB …) for a new department. */
export function freeLetter(departments: Pick<Department, 'letter'>[]): string {
  const used = new Set(departments.map((d) => d.letter))
  const az = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return az.find((l) => !used.has(l)) ?? az.flatMap((a) => az.map((b) => a + b)).find((l) => !used.has(l)) ?? 'A'
}

/** The least used slot, so a new department starts with a colour nobody else has when possible. */
export function freeSlot(departments: Pick<Department, 'colorSlot'>[]): number {
  const count = Array.from({ length: DEPT_COLOR_SLOTS }, (_, s) => departments.filter((d) => d.colorSlot === s).length)
  return count.indexOf(Math.min(...count))
}

/** Departments that share each slot, for the editor's warning. */
export function sharedSlots(departments: Pick<Department, 'id' | 'colorSlot'>[]): Map<number, string[]> {
  const bySlot = new Map<number, string[]>()
  for (const d of departments) bySlot.set(d.colorSlot, [...(bySlot.get(d.colorSlot) ?? []), d.id])
  return new Map([...bySlot].filter(([, ids]) => ids.length > 1))
}
