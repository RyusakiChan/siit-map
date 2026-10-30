import { buildingData } from '../data'
import { slotColor, type RoomColor } from './slots'
import type { Department, Room } from '../data/types'

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
  slabTop: '#F7F4F8',
  slabTopViewed: '#FFFFFF',
  slabSide: '#DDD5DE',
  dimmedTop: '#EBE6EC',
  dimmedSide: '#D6CFD7',
}

export { slotColors, slotColor, type RoomColor } from './slots'

const facility: RoomColor = { top: '#EADFEB', side: '#D2C4D3', badge: tokens.muted }
const circulation: RoomColor = { top: '#A89EA9', side: '#8F8490', badge: tokens.muted }

export const deptColor = (dept: Pick<Department, 'colorSlot'> | undefined): RoomColor | undefined => slotColor(dept?.colorSlot)

const deptBySlot = new Map(buildingData.departments.map((d) => [d.id, d]))

export function roomColor(room: Room): RoomColor {
  if (room.type === 'stairs' || room.type === 'elevator') return circulation
  if (room.departmentId) return deptColor(deptBySlot.get(room.departmentId)) ?? facility
  return facility
}

/** Outline color of a department letter badge (falls back to the muted ink). */
export function departmentBadgeColor(departmentId: string | null): string {
  return (departmentId && deptColor(deptBySlot.get(departmentId))?.badge) || tokens.muted
}
