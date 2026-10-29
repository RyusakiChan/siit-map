import type { BuildingData, Room, QrPoint, WalkEdge, WalkNode } from '../data/types.ts'

/** Everything the tool owns for one floor. */
export interface FloorSlice {
  floor: number
  rooms: Room[]
  nodes: WalkNode[]
  edges: WalkEdge[]
  qrPoints: QrPoint[]
  /** This floor's entry in each connector: connector id -> door node id. A connector missing here does not serve the floor. */
  connectors: { id: string; kind: 'stairs' | 'elevator'; costPerFloor: number; node: string }[]
  /** Connector ids that exist in the draft but may not serve this floor. */
  retiredIds?: string[]
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
    connectors: data.walkways.connectors.flatMap((c) =>
      c.nodes[String(floor)] ? [{ id: c.id, kind: c.kind, costPerFloor: c.costPerFloor, node: c.nodes[String(floor)]! }] : [],
    ),
  }
}

/**
 * Replace one floor's rooms, walkways (nodes, edges and that floor's connector entries) and QR
 * points inside `data`. Other floors are left alone. Marks the floor traced and keeps the list of
 * ids that were ever used. Throws when the slice reuses an id owned by another floor or a retired id.
 */
export function replaceFloor(data: BuildingData, slice: FloorSlice): BuildingData {
  const { floor } = slice
  if (!data.floors.some((f) => f.level === floor)) throw new Error(`Floor ${floor} does not exist`)
  const oldRooms = data.rooms.filter((r) => r.floor === floor)
  const oldQr = data.qrPoints.filter((q) => q.floor === floor)

  const otherIds = new Set([
    ...data.rooms.filter((r) => r.floor !== floor).map((r) => r.id),
    ...data.qrPoints.filter((q) => q.floor !== floor).map((q) => q.id),
    ...data.amenities.map((a) => a.id),
  ])
  const retired = new Set(data.usedIds ?? [])
  const mine = new Set([...oldRooms.map((r) => r.id), ...oldQr.map((q) => q.id)])
  for (const id of [...slice.rooms.map((r) => r.id), ...slice.qrPoints.map((q) => q.id)]) {
    if (otherIds.has(id)) throw new Error(`Id "${id}" is already used on another floor`)
    if (retired.has(id) && !mine.has(id)) throw new Error(`Id "${id}" was retired and cannot be used again`)
  }

  const oldNodeIds = new Set(data.walkways.nodes.filter((n) => n.floor === floor).map((n) => n.id))
  const usedIds = [...new Set([...(data.usedIds ?? []), ...mine, ...slice.rooms.map((r) => r.id), ...slice.qrPoints.map((q) => q.id)])]
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

  const floors = data.floors.map((f) => (f.level === floor ? { ...f, traced: true } : f))
  return {
    ...data,
    building: { ...data.building, sampleData: floors.some((f) => !f.traced) },
    floors,
    rooms: [...data.rooms.filter((r) => r.floor !== floor), ...slice.rooms],
    qrPoints: [...data.qrPoints.filter((q) => q.floor !== floor), ...slice.qrPoints],
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
