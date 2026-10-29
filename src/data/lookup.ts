import { buildingData as data } from './index'
import type { Department, Room, RoomType } from './types'
import type { Lang, StringKey } from '../i18n/strings'
import { pick } from '../i18n'

export const roomById = new Map(data.rooms.map((r) => [r.id, r]))
export const deptById = new Map(data.departments.map((d) => [d.id, d]))

export const roomName = (room: Room, lang: Lang): string => pick(lang, room.name, room.nameTh)
export const deptName = (dept: Department, lang: Lang): string => pick(lang, dept.name, dept.nameTh)
export const deptOf = (room: Room): Department | undefined => (room.departmentId ? deptById.get(room.departmentId) : undefined)
export const deptRooms = (id: string): Room[] => data.rooms.filter((r) => r.departmentId === id)

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
