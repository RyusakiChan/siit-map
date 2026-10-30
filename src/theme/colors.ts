import { buildingData } from '../data'
import { slotColor, type RoomColor } from './slots'
import type { Department, Room, RoomType } from '../data/types'

/** Pastel Mauve tokens from docs/design/ui-spec.md. */
export const tokens = {
  ground: '#F3F1F3',
  surface: '#FFFFFF',
  ink: '#1D161E',
  muted: '#594C5B',
  line: '#E7E4E7',
  actionFill: '#FCCEE8',
  actionEdge: '#F9A8D4',
  selectedFloorFill: '#FCE7F3',
  selectedFloorLabel: '#A3155F',
  youAreHere: '#F6339A',
  // Map look v2 (docs/design/ui-spec.md): a soft gradient behind the canvas, a lilac-white slab with a darker rim.
  skyTop: '#F7EFF6',
  skyBottom: '#ECE5EF',
  slabTop: '#F3EDF4',
  slabTopViewed: '#FBF8FB',
  slabSide: '#D9CFDB',
  slabSideShade: '#C4B8C7',
  slabRim: '#BFB2C2',
  voidFloor: '#E2D9E4',
  dimmedTop: '#EBE6EC',
  dimmedSide: '#D6CFD7',
}

export { slotColors, slotColor, type RoomColor } from './slots'

/** Tints for rooms without a department, by type. `side` is the lit wall; `shade` the wall facing away from the light. */
export interface TypeTint extends RoomColor {
  shade: string
}
export const typeTints = {
  study: { top: '#E3DAF2', side: '#C9BEDD', shade: '#B5A9CB', badge: tokens.muted }, // classrooms, laboratories
  office: { top: '#F2E1EA', side: '#DAC5D1', shade: '#C6B0BD', badge: tokens.muted }, // offices, conference rooms
  library: { top: '#DDEBDD', side: '#BFD3BF', shade: '#A9C0A9', badge: tokens.muted },
  facility: { top: '#DCEDF0', side: '#BED6DA', shade: '#A8C2C7', badge: tokens.muted }, // restrooms and other facilities
  other: { top: '#EEE8EF', side: '#D6CDD8', shade: '#C2B8C5', badge: tokens.muted },
} satisfies Record<string, TypeTint>

export type TintKey = keyof typeof typeTints

export function tintKeyOf(type: RoomType): TintKey | 'circulation' {
  switch (type) {
    case 'classroom':
    case 'laboratory':
      return 'study'
    case 'office':
    case 'conferenceroom':
      return 'office'
    case 'library':
      return 'library'
    case 'restroom':
    case 'foodservice':
    case 'lobby':
      return 'facility'
    case 'stairs':
    case 'elevator':
      return 'circulation'
    default:
      return 'other'
  }
}

export const circulation: RoomColor = { top: '#A89EA9', side: '#8F8490', badge: tokens.muted }

export const deptColor = (dept: Pick<Department, 'colorSlot'> | undefined): RoomColor | undefined => slotColor(dept?.colorSlot)

const deptBySlot = new Map(buildingData.departments.map((d) => [d.id, d]))

export function roomColor(room: Room): RoomColor {
  if (room.type === 'stairs' || room.type === 'elevator') return circulation
  // A shared room (departmentIds) gets the no-department tint of its type.
  if (room.departmentId) {
    const c = deptColor(deptBySlot.get(room.departmentId))
    if (c) return c
  }
  const key = tintKeyOf(room.type)
  return key === 'circulation' ? circulation : typeTints[key]
}

/** Outline color of a department letter badge (falls back to the muted ink). */
export function departmentBadgeColor(departmentId: string | null): string {
  return (departmentId && deptColor(deptBySlot.get(departmentId))?.badge) || tokens.muted
}
