import { DEPT_COLOR_SLOTS, SUMMARY_MAX, letterOk, roomDeptIds, urlOk } from './departments.ts'
import { boundaryDistance, pointInPolygon, polygonInside, polygonsOverlap, segmentThroughPolygon } from './geometry'
import type { BuildingData, Point } from './types'

export interface Problem {
  /** Short stable code, e.g. `room-overlap`. */
  code: string
  /** `error` blocks a clean save; `warning` is a reminder (for example a room still without a name). */
  severity: 'error' | 'warning'
  message: string
  /** Floor the problem is on; absent for whole-building problems. */
  floor?: number
  /** Where to zoom to, in metres. */
  at?: Point
  /** Ids of the rooms, nodes, QR points or connectors involved. */
  ids: string[]
}

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const dup = <T,>(items: T[]): T[] => items.filter((x, i) => items.indexOf(x) !== i)
const inOutline = (p: Point, outline: Point[]) => polygonInside([p, p, p], outline)

/** Every data check the app and the trace tool share. Returns [] when the data is clean. */
export function validate(data: BuildingData): Problem[] {
  const out: Problem[] = []
  const add = (p: Omit<Problem, 'severity'> & { severity?: Problem['severity'] }) => out.push({ severity: 'error', ...p })
  const { rooms, walkways: w, building, floors } = data
  const levels = new Set(floors.map((f) => f.level))
  const roomsOn = (floor: number) => rooms.filter((r) => r.floor === floor)
  const node = new Map(w.nodes.map((n) => [n.id, n]))
  const voidsOn = (floor: number) => floors.find((f) => f.level === floor)?.voids ?? []

  // Floors and departments
  for (const l of dup(floors.map((f) => f.level))) add({ code: 'floor-duplicate', message: `Floor ${l} is listed twice.`, ids: [String(l)] })
  for (const id of dup(data.departments.map((d) => d.id))) add({ code: 'department-duplicate', message: `Department id ${id} is used twice.`, ids: [id] })
  for (const d of data.departments) {
    const label = d.name || d.id
    if (!/^d-[a-z0-9-]+$/.test(d.id) && !d.id.startsWith('sample-')) add({ code: 'department-id', message: `Department id ${d.id} is not in the d-<name> form.`, ids: [d.id] })
    if (!letterOk(d.letter)) add({ code: 'department-letter-format', message: `${label}: the letter must be 1 or 2 capital letters A-Z.`, ids: [d.id] })
    if (!d.name.trim()) add({ code: 'department-unnamed', message: `Department ${d.id} has no name.`, ids: [d.id] })
    if (d.url && !urlOk(d.url)) add({ code: 'department-url', message: `${label}: the official link must start with https://.`, ids: [d.id] })
    if ((d.summary?.length ?? 0) > SUMMARY_MAX) add({ code: 'department-summary', message: `${label}: the summary is ${d.summary!.length} characters; the limit is ${SUMMARY_MAX}.`, ids: [d.id] })
    if (!Number.isInteger(d.colorSlot) || d.colorSlot < 0 || d.colorSlot >= DEPT_COLOR_SLOTS) add({ code: 'department-slot', message: `${label}: pick one of the ${DEPT_COLOR_SLOTS} colours.`, ids: [d.id] })
    if (!rooms.some((r) => roomDeptIds(r).includes(d.id))) add({ code: 'department-unused', severity: 'warning', message: `${label} has no rooms yet.`, ids: [d.id] })
  }
  for (const l of dup(data.departments.map((d) => d.letter))) add({ code: 'department-letter', message: `Department letter ${l} is used twice.`, ids: [l] })
  if (building.outline.length < 3) add({ code: 'outline', message: 'The building outline needs at least 3 points.', ids: [] })

  // Rooms
  for (const id of dup(rooms.map((r) => r.id))) add({ code: 'room-id-duplicate', message: `Room id ${id} is used twice.`, ids: [id] })
  for (const n of dup(rooms.map((r) => r.number).filter((n): n is string => n !== null && n !== ''))) {
    add({ code: 'room-number-duplicate', message: `Room number ${n} is used twice.`, ids: rooms.filter((r) => r.number === n).map((r) => r.id) })
  }
  const deptIds = new Set(data.departments.map((d) => d.id))
  for (const r of rooms) {
    const at = r.polygon[0]
    const label = r.number ? `${r.number}` : r.name || r.id
    if (!levels.has(r.floor)) add({ code: 'room-floor', message: `${label}: floor ${r.floor} does not exist.`, ids: [r.id] })
    if (r.departmentId !== null && !deptIds.has(r.departmentId)) {
      add({ code: 'room-department', message: `${label}: unknown department ${r.departmentId}.`, floor: r.floor, at, ids: [r.id] })
    }
    if (r.departmentIds !== undefined) {
      if (r.departmentId !== null) add({ code: 'room-department-both', message: `${label}: use departmentId or departmentIds, not both.`, floor: r.floor, at, ids: [r.id] })
      if (r.departmentIds.length < 2) add({ code: 'room-departments-short', message: `${label}: departmentIds needs at least 2 departments (use departmentId for one).`, floor: r.floor, at, ids: [r.id] })
      for (const id of r.departmentIds) {
        if (!deptIds.has(id)) add({ code: 'room-department', message: `${label}: unknown department ${id}.`, floor: r.floor, at, ids: [r.id] })
      }
      for (const id of dup(r.departmentIds)) add({ code: 'room-departments-duplicate', message: `${label}: department ${id} is listed twice.`, floor: r.floor, at, ids: [r.id] })
    }
    if (r.polygon.length < 3) {
      add({ code: 'room-polygon', message: `${label}: a room needs at least 3 corners.`, floor: r.floor, at, ids: [r.id] })
      continue
    }
    if (!polygonInside(r.polygon, building.outline)) {
      add({ code: 'room-outside', message: `${label}: sticks out of the building outline.`, floor: r.floor, at, ids: [r.id] })
    }
    if (!r.name.trim() && !r.nameTh?.trim()) {
      add({ code: 'room-unnamed', severity: 'warning', message: `${r.id} (${r.type}) has no name yet.`, floor: r.floor, at, ids: [r.id] })
    }
  }
  for (const floor of floors) {
    const list = roomsOn(floor.level).filter((r) => r.polygon.length >= 3)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!
        const b = list[j]!
        if (polygonsOverlap(a.polygon, b.polygon)) {
          add({ code: 'room-overlap', message: `${a.number ?? a.id} and ${b.number ?? b.id} overlap.`, floor: floor.level, at: a.polygon[0], ids: [a.id, b.id] })
        }
      }
    }
  }

  // Voids (open atriums): inside the outline, outside every room
  for (const floor of floors) {
    ;(floor.voids ?? []).forEach((v, i) => {
      const label = `Void ${i + 1} on floor ${floor.level}`
      const vid = `void-${floor.level}-${i + 1}`
      if (v.length < 3) { add({ code: 'void-polygon', message: `${label} needs at least 3 corners.`, floor: floor.level, ids: [vid] }); return }
      if (!polygonInside(v, building.outline)) add({ code: 'void-outside', message: `${label} sticks out of the building outline.`, floor: floor.level, at: v[0], ids: [vid] })
      for (const r of roomsOn(floor.level)) {
        if (r.polygon.length >= 3 && polygonsOverlap(v, r.polygon)) {
          add({ code: 'void-room-overlap', message: `${label} overlaps room ${r.number ?? r.id}.`, floor: floor.level, at: v[0], ids: [vid, r.id] })
        }
      }
    })
  }

  // QR points and amenities
  for (const id of dup(data.qrPoints.map((q) => q.id))) add({ code: 'qr-duplicate', message: `QR id ${id} is used twice.`, ids: [id] })
  for (const id of dup(data.amenities.map((a) => a.id))) add({ code: 'amenity-duplicate', message: `Amenity id ${id} is used twice.`, ids: [id] })
  for (const item of [...data.qrPoints, ...data.amenities]) {
    if (!levels.has(item.floor)) add({ code: 'point-floor', message: `${item.id}: floor ${item.floor} does not exist.`, ids: [item.id] })
    else if (!inOutline(item.position, building.outline)) {
      add({ code: 'point-outside', message: `${item.id} is outside the building outline.`, floor: item.floor, at: item.position, ids: [item.id] })
    }
  }

  // Walkways
  for (const id of dup(w.nodes.map((n) => n.id))) add({ code: 'node-duplicate', message: `Node id ${id} is used twice.`, ids: [id] })
  const adjacency = new Map<string, string[]>()
  const link = (a: string, b: string) => adjacency.set(a, [...(adjacency.get(a) ?? []), b])
  for (const e of w.edges) {
    const na = node.get(e.a)
    const nb = node.get(e.b)
    if (!na || !nb) {
      add({ code: 'edge-missing-node', message: `Edge ${e.a} - ${e.b} points at a node that does not exist.`, ids: [e.a, e.b] })
    } else if (na.floor !== nb.floor) {
      add({ code: 'edge-floors', message: `Edge ${e.a} - ${e.b} joins two floors (use a lift or stairs connector).`, floor: na.floor, at: na.position, ids: [e.a, e.b] })
    } else {
      link(e.a, e.b)
      link(e.b, e.a)
    }
  }
  for (const room of rooms) {
    const door = room.door ? node.get(room.door) : undefined
    const label = room.number ?? (room.name || room.id)
    if (!room.door) add({ code: 'room-no-door', message: `${label} has no door yet.`, floor: room.floor, at: room.polygon[0], ids: [room.id] })
    else if (!door) add({ code: 'room-door-missing', message: `${label}: door node ${room.door} does not exist.`, floor: room.floor, at: room.polygon[0], ids: [room.id, room.door] })
    else if (door.floor !== room.floor) add({ code: 'room-door-floor', message: `${label}: door node is on another floor.`, floor: room.floor, at: door.position, ids: [room.id, door.id] })
  }
  const reach = (start: string) => {
    const seen = new Set([start])
    const queue = [start]
    while (queue.length) {
      for (const n of adjacency.get(queue.pop()!) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    }
    return seen
  }
  for (const floor of floors) {
    const doors = roomsOn(floor.level).flatMap((r) => (r.door && node.get(r.door)?.floor === floor.level ? [{ room: r, node: node.get(r.door)! }] : []))
    if (doors.length) {
      const seen = reach(doors[0]!.node.id)
      for (const d of doors) {
        if (!seen.has(d.node.id)) {
          add({ code: 'door-unreachable', message: `${d.room.number ?? d.room.name ?? d.room.id} (door ${d.node.id}) is not connected to the rest of floor ${floor.level}.`, floor: floor.level, at: d.node.position, ids: [d.room.id, d.node.id] })
        }
      }
    }
    // Loose nodes: nothing joins them to the network.
    const doorIds = new Set(doors.map((d) => d.node.id))
    for (const n of w.nodes.filter((n) => n.floor === floor.level)) {
      if (!adjacency.has(n.id) && !doorIds.has(n.id) && !w.connectors.some((c) => Object.values(c.nodes).includes(n.id))) {
        add({ code: 'node-isolated', severity: 'warning', message: `Node ${n.id} is not joined to anything.`, floor: floor.level, at: n.position, ids: [n.id] })
      }
    }
  }
  for (const c of w.connectors) {
    const floorsOf = Object.keys(c.nodes)
    if (c.costPerFloor <= 0) add({ code: 'connector-cost', message: `Connector ${c.id}: cost per floor must be above 0.`, ids: [c.id] })
    if (floorsOf.length < 2) add({ code: 'connector-short', message: `Connector ${c.id} serves only ${floorsOf.length} floor; it needs at least 2.`, floor: Number(floorsOf[0]) || undefined, ids: [c.id] })
    for (const [floor, id] of Object.entries(c.nodes)) {
      const n = node.get(id)
      const owner = rooms.find((r) => r.door === id)
      if (n?.floor !== Number(floor)) add({ code: 'connector-node-floor', message: `Connector ${c.id}: node ${id} is not on floor ${floor}.`, floor: Number(floor), at: n?.position, ids: [c.id, id] })
      else if (owner?.type !== c.kind) {
        add({ code: 'connector-room-type', message: `Connector ${c.id} on floor ${floor}: ${id} must be the door of a ${c.kind === 'elevator' ? 'lift' : 'stairs'} room.`, floor: Number(floor), at: n.position, ids: [c.id, id] })
      }
    }
  }
  for (const n of w.nodes) {
    if (!levels.has(n.floor)) { add({ code: 'node-floor', message: `Node ${n.id}: floor ${n.floor} does not exist.`, ids: [n.id] }); continue }
    if (!inOutline(n.position, building.outline)) add({ code: 'node-outside', message: `Node ${n.id} is outside the building outline.`, floor: n.floor, at: n.position, ids: [n.id] })
    for (const r of roomsOn(n.floor)) {
      if (r.polygon.length >= 3 && pointInPolygon(n.position, r.polygon) && boundaryDistance(n.position, r.polygon) > 0.05) {
        add({ code: 'node-in-room', message: `Node ${n.id} is inside room ${r.number ?? r.id}.`, floor: n.floor, at: n.position, ids: [n.id, r.id] })
      }
    }
    for (const v of voidsOn(n.floor)) {
      if (v.length >= 3 && pointInPolygon(n.position, v) && boundaryDistance(n.position, v) > 0.05) {
        add({ code: 'node-in-void', message: `Node ${n.id} is inside the open atrium.`, floor: n.floor, at: n.position, ids: [n.id] })
      }
    }
  }
  for (const e of w.edges) {
    const na = node.get(e.a)
    const nb = node.get(e.b)
    if (!na || !nb || na.floor !== nb.floor) continue
    const a = na.position
    const b = nb.position
    for (const r of roomsOn(na.floor)) {
      if (r.polygon.length < 3) continue
      const bad = segmentThroughPolygon(a, b, r.polygon)
      if (bad) add({ code: 'edge-through-room', message: `Edge ${e.a} - ${e.b} goes through room ${r.number ?? r.id}.`, floor: na.floor, at: mid(a, b), ids: [e.a, e.b, r.id] })
    }
    for (const v of voidsOn(na.floor)) {
      if (v.length >= 3 && segmentThroughPolygon(a, b, v)) add({ code: 'edge-through-void', message: `Edge ${e.a} - ${e.b} crosses the open atrium.`, floor: na.floor, at: mid(a, b), ids: [e.a, e.b] })
    }
  }

  // Every room reachable from every other, through the connectors.
  const withDoor = rooms.filter((r) => r.door && node.has(r.door))
  if (withDoor.length) {
    const seen = new Set([withDoor[0]!.door!])
    const queue = [withDoor[0]!.door!]
    while (queue.length) {
      const id = queue.pop()!
      const next = [...(adjacency.get(id) ?? [])]
      for (const c of w.connectors) if (Object.values(c.nodes).includes(id)) next.push(...Object.values(c.nodes))
      for (const n of next) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    }
    const lost = withDoor.filter((r) => !seen.has(r.door!))
    // Per-floor "door-unreachable" already names the room when the floor itself is split; add this only for whole-floor islands.
    const reported = new Set(out.filter((p) => p.code === 'door-unreachable').flatMap((p) => p.ids))
    for (const r of lost) {
      if (!reported.has(r.id)) add({ code: 'room-unreachable-building', message: `${r.number ?? r.name ?? r.id} cannot be reached from the rest of the building (check lifts and stairs).`, floor: r.floor, at: r.polygon[0], ids: [r.id] })
    }
  }
  return out
}

/** Problems that matter on one floor: its own, plus building-wide ones. */
export function problemsForFloor(problems: Problem[], floor: number): Problem[] {
  return problems.filter((p) => p.floor === undefined || p.floor === floor)
}
