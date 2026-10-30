import { buildingData as data } from './index'
import type { Department, Room, RoomType } from './types'
import type { Lang, StringKey } from '../i18n/strings'
import { pick } from '../i18n'
import { roomDeptIds } from './departments'

export const roomById = new Map(data.rooms.map((r) => [r.id, r]))
export const deptById = new Map(data.departments.map((d) => [d.id, d]))

export const roomName = (room: Room, lang: Lang): string => pick(lang, room.name, room.nameTh)
export const deptName = (dept: Department, lang: Lang): string => pick(lang, dept.name, dept.nameTh)
/** The room's first department (for a shared room, use `deptsOf`). */
export const deptOf = (room: Room): Department | undefined => deptsOf(room)[0]
/** All departments of a room: none, one, or several for a shared room. */
export const deptsOf = (room: Room): Department[] => roomDeptIds(room).flatMap((id) => deptById.get(id) ?? [])
/** "A / B" for a shared room; the single department's name otherwise; undefined without one. */
export const deptNames = (room: Room, lang: Lang): string | undefined => {
  const list = deptsOf(room)
  return list.length ? list.map((d) => deptName(d, lang)).join(' / ') : undefined
}
export const deptRooms = (id: string): Room[] => data.rooms.filter((r) => roomDeptIds(r).includes(id))

export const typeLabelKey: Record<RoomType, StringKey> = {
  classroom: 'typeClassroom',
  laboratory: 'typeLaboratory',
  office: 'typeOffice',
  conferenceroom: 'typeConferenceroom',
  lobby: 'typeLobby',
  foodservice: 'typeFoodservice',
  library: 'typeLibrary',
  restroom: 'typeRestroom',
  stairs: 'typeStairs',
  elevator: 'typeElevator',
  other: 'typeOther',
}
