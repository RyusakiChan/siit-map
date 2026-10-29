import type { Room } from '../data/types'

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

export interface RoomColor {
  top: string
  side: string
}

const facility: RoomColor = { top: '#EADFEB', side: '#D2C4D3' }
const circulation: RoomColor = { top: '#A89EA9', side: '#8F8490' }

/** Department colors, keyed by department id. */
export const departmentColors: Record<string, RoomColor> = {
  'sample-dept-a': { top: '#7CC8F8', side: '#5AAEE0' }, // sky
  'sample-dept-b': { top: '#B9A3FF', side: '#9B84E6' }, // violet
  'sample-dept-c': { top: '#5FDCC8', side: '#3FC0AC' }, // teal
}

export function roomColor(room: Room): RoomColor {
  if (room.type === 'stairs' || room.type === 'elevator') return circulation
  if (room.departmentId) return departmentColors[room.departmentId] ?? facility
  return facility
}

/** Outline color of a department letter badge (falls back to the muted ink). */
export function departmentBadgeColor(departmentId: string | null): string {
  return (departmentId && departmentColors[departmentId]?.side) || tokens.muted
}
