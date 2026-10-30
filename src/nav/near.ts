import { buildingData } from '../data'
import type { BuildingData, Room, RoomType } from '../data/types'
import { buildGraph, costsFrom, qrEntry } from './graph'

/** Walking pace for the "Near you" list: 1.2 m/s. */
const METRES_PER_SECOND = 1.2

export interface NearPlace {
  room: Room
  /** Walking distance from the QR spot, rounded to 5 m (at least 5). */
  meters: number
  minutes: number
  sameFloor: boolean
}

export interface NearOptions {
  count?: number
  /** Only these room types (for the quick chips). */
  types?: RoomType[]
}

/** "20 m · 1 min" numbers for a walking distance. */
export function walkLabel(distance: number): { meters: number; minutes: number } {
  return { meters: Math.max(5, Math.round(distance / 5) * 5), minutes: Math.max(1, Math.ceil(distance / METRES_PER_SECOND / 60)) }
}

/**
 * The nearest places to a QR spot by walking distance on the walkway graph: rooms, restrooms, lifts and stairs.
 * Places on the QR's own floor come first; places on other floors only fill what is left (ranked by walk plus ride).
 */
export function nearestPlaces(qrId: string, opts: NearOptions = {}, data: BuildingData = buildingData): NearPlace[] {
  const g = buildGraph(data)
  const entry = qrEntry(g, qrId)
  if (!entry) return []
  const costs = costsFrom(g, entry.node)
  const found: (NearPlace & { cost: number })[] = []
  for (const room of data.rooms) {
    if (!room.door || (opts.types && !opts.types.includes(room.type))) continue
    const c = costs.get(room.door)
    if (c === undefined) continue
    const cost = c + entry.walk
    found.push({ room, cost, ...walkLabel(cost), sameFloor: room.floor === entry.floor })
  }
  found.sort((a, b) => Number(b.sameFloor) - Number(a.sameFloor) || a.cost - b.cost || a.room.id.localeCompare(b.room.id))
  return found.slice(0, opts.count ?? 5).map(({ room, meters, minutes, sameFloor }) => ({ room, meters, minutes, sameFloor }))
}
