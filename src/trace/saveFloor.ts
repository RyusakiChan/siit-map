import { roomsUsing } from '../data/departments.ts'
import type { Amenity, BuildingData, Department, Point, Room, QrPoint, WalkEdge, WalkNode } from '../data/types.ts'

/** Everything the tool owns for one floor. */
export interface FloorSlice {
  floor: number
  rooms: Room[]
  nodes: WalkNode[]
  edges: WalkEdge[]
  qrPoints: QrPoint[]
  /** Open parts of the floor (atriums). The tool does not draw them yet, but it carries them through a save. */
  voids?: Point[][]
  /** This floor's amenities. Left out, the floor's saved amenities stay as they are. */
  amenities?: Amenity[]
  /** This floor's entry in each connector: connector id -> door node id. A connector missing here does not serve the floor. */
  connectors: { id: string; kind: 'stairs' | 'elevator'; costPerFloor: number; node: string }[]
}

/** Cut one floor out of the full draft. */
export function sliceFloor(data: BuildingData, floor: number): FloorSlice {
  const nodeIds = new Set(data.walkways.nodes.filter((n) => n.floor === floor).map((n) => n.id))
  return {
    floor,
    rooms: data.rooms.filter((r) => r.floor === floor),
    nodes: data.walkways.nodes.filter((n) => n.floor === floor),
    edges: data.walkways.edges.filter((e) => nodeIds.has(e.a) && nodeIds.has(e.b)),
    qrPoints: data.qrPoints.filter((q) => q.floor === floor),
    voids: data.floors.find((f) => f.level === floor)?.voids,
    amenities: data.amenities.filter((a) => a.floor === floor),
    connectors: data.walkways.connectors.flatMap((c) =>
      c.nodes[String(floor)] ? [{ id: c.id, kind: c.kind, costPerFloor: c.costPerFloor, node: c.nodes[String(floor)]! }] : [],
    ),
  }
}

/**
 * Replace one floor's rooms, walkways (nodes, edges and that floor's connector entries) and QR
 * points inside `data`. Other floors are left alone. Marks the floor traced and keeps the list of
 * ids that were ever used. `markTraced` false is for restoring a draft. Throws when the slice reuses an id owned by another floor or a retired id.
 */
export function replaceFloor(data: BuildingData, slice: FloorSlice, markTraced = true): BuildingData {
  const { floor } = slice
  if (!data.floors.some((f) => f.level === floor)) throw new Error(`Floor ${floor} does not exist`)
  const oldRooms = data.rooms.filter((r) => r.floor === floor)
  const oldQr = data.qrPoints.filter((q) => q.floor === floor)
  const oldAmenities = data.amenities.filter((a) => a.floor === floor)

  const newAmenities = slice.amenities ?? oldAmenities
  const otherIds = new Set([
    ...data.rooms.filter((r) => r.floor !== floor).map((r) => r.id),
    ...data.qrPoints.filter((q) => q.floor !== floor).map((q) => q.id),
    ...data.amenities.filter((a) => a.floor !== floor).map((a) => a.id),
    ...newAmenities.map((a) => a.id),
  ])
  const retired = new Set(data.usedIds ?? [])
  const mine = new Set([...oldRooms.map((r) => r.id), ...oldQr.map((q) => q.id)])
  for (const id of [...slice.rooms.map((r) => r.id), ...slice.qrPoints.map((q) => q.id)]) {
    if (otherIds.has(id)) throw new Error(`Id "${id}" is already used on another floor`)
    if (retired.has(id) && !mine.has(id)) throw new Error(`Id "${id}" was retired and cannot be used again`)
  }

  if (slice.amenities) {
    const sliceIds = new Set([...slice.rooms.map((r) => r.id), ...slice.qrPoints.map((q) => q.id), ...data.rooms.filter((r) => r.floor !== floor).map((r) => r.id), ...data.qrPoints.filter((q) => q.floor !== floor).map((q) => q.id), ...data.amenities.filter((a) => a.floor !== floor).map((a) => a.id)])
    const seen = new Set<string>()
    for (const a of slice.amenities) {
      if (sliceIds.has(a.id) || seen.has(a.id)) throw new Error(`Id "${a.id}" is already used`)
      if (retired.has(a.id) && !oldAmenities.some((o) => o.id === a.id)) throw new Error(`Id "${a.id}" was retired and cannot be used again`)
      seen.add(a.id)
    }
  }

  const oldNodeIds = new Set(data.walkways.nodes.filter((n) => n.floor === floor).map((n) => n.id))
  const usedIds = [
    ...new Set([
      ...(data.usedIds ?? []), ...mine, ...slice.rooms.map((r) => r.id), ...slice.qrPoints.map((q) => q.id),
      // A removed amenity's id is retired too; so are the ones just saved.
      ...oldAmenities.map((a) => a.id), ...newAmenities.map((a) => a.id),
    ]),
  ]
  const key = String(floor)

  const connectors = data.walkways.connectors.map((c) => {
    const { [key]: _gone, ...rest } = c.nodes
    void _gone
    return { ...c, nodes: rest }
  })
  for (const s of slice.connectors) {
    const existing = connectors.find((c) => c.id === s.id)
    if (existing) {
      existing.kind = s.kind
      existing.costPerFloor = s.costPerFloor
      existing.nodes[key] = s.node
    } else connectors.push({ id: s.id, kind: s.kind, costPerFloor: s.costPerFloor, nodes: { [key]: s.node } })
  }

  const floors = data.floors.map((f) => {
    if (f.level !== floor) return f
    const { voids: oldVoids, ...rest } = f
    const voids = slice.voids ?? oldVoids // a slice without `voids` keeps the floor's own
    return { ...rest, ...(voids?.length ? { voids } : {}), ...(markTraced ? { traced: true } : {}) }
  })
  return {
    ...data,
    building: { ...data.building, sampleData: floors.some((f) => !f.traced) },
    floors,
    rooms: [...data.rooms.filter((r) => r.floor !== floor), ...slice.rooms],
    qrPoints: [...data.qrPoints.filter((q) => q.floor !== floor), ...slice.qrPoints],
    amenities: [...data.amenities.filter((a) => a.floor !== floor), ...newAmenities],
    walkways: {
      nodes: [...data.walkways.nodes.filter((n) => !oldNodeIds.has(n.id)), ...slice.nodes],
      edges: [...data.walkways.edges.filter((e) => !oldNodeIds.has(e.a) && !oldNodeIds.has(e.b)), ...slice.edges],
      // A connector left with no floors at all is dropped.
      connectors: connectors.filter((c) => Object.keys(c.nodes).length > 0),
    },
    usedIds,
  }
}

/** Keep this many backups in .trace-backups/. */
export const BACKUPS_KEPT = 20

/**
 * Replace the building-wide department list. A department that rooms in the saved data still use
 * cannot be removed, and an id that was retired cannot come back. Removed ids join `usedIds`.
 */
export function replaceDepartments(data: BuildingData, departments: Department[]): BuildingData {
  const next = new Set(departments.map((d) => d.id))
  const old = new Set(data.departments.map((d) => d.id))
  const retired = new Set(data.usedIds ?? [])
  if (next.size !== departments.length) throw new Error('Two departments have the same id')
  for (const id of next) if (retired.has(id) && !old.has(id)) throw new Error(`Department id "${id}" was retired and cannot be used again`)
  for (const id of old) {
    const n = roomsUsing(data, id)
    if (!next.has(id) && n) throw new Error(`Department "${id}" is still used by ${n} saved room(s)`)
  }
  const removed = [...old].filter((id) => !next.has(id))
  return { ...data, departments, usedIds: [...new Set([...(data.usedIds ?? []), ...removed, ...next])] }
}
