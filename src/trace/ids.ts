import type { BuildingData } from '../data/types'

const maxSuffix = (ids: Iterable<string>, prefix: string) => {
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return max
}

/** Every room and QR id that exists now or ever did. */
export function allUsedIds(data: BuildingData): Set<string> {
  return new Set([...(data.usedIds ?? []), ...data.rooms.map((r) => r.id), ...data.qrPoints.map((q) => q.id), ...data.amenities.map((a) => a.id)])
}

/** `r-f<floor>-<n>`: one above the highest number ever used on that floor. Never reuses a deleted id. */
export function nextRoomId(data: BuildingData, floor: number): string {
  const prefix = `r-f${floor}-`
  return `${prefix}${maxSuffix(allUsedIds(data), prefix) + 1}`
}

/** Corridor node `f<floor>-c<n>` or door node `f<floor>-d<n>`. */
export function nextNodeId(data: BuildingData, floor: number, kind: 'c' | 'd'): string {
  const prefix = `f${floor}-${kind}`
  return `${prefix}${maxSuffix(data.walkways.nodes.map((n) => n.id), prefix) + 1}`
}

export function nextConnectorId(data: BuildingData, kind: 'stairs' | 'elevator'): string {
  const prefix = kind === 'elevator' ? 'lift-' : 'stairs-'
  return `${prefix}${maxSuffix(data.walkways.connectors.map((c) => c.id), prefix) + 1}`
}

/** Why a typed QR id cannot be used, or null when it is free. */
export function qrIdProblem(id: string, data: BuildingData, own?: string): string | null {
  if (!id) return 'Type an id first.'
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return 'Use lowercase letters, digits and dashes only.'
  if (id === own) return null
  if (data.qrPoints.some((q) => q.id === id)) return `"${id}" is already a QR id.`
  if (data.usedIds?.includes(id)) return `"${id}" was used before and is retired.`
  if (data.rooms.some((r) => r.id === id)) return `"${id}" is a room id.`
  if (data.amenities.some((a) => a.id === id)) return `"${id}" is an amenity id.`
  return null
}
