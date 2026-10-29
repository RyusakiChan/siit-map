import { buildingData } from '../data'
import { polygonCentroid } from '../data/geometry'
import type { BuildingData, Point, Room } from '../data/types'

/** Walking pace used for "about N min": 1.3 m/s, so one metre of cost is about 0.77 s. */
export const SECONDS_PER_METRE = 1 / 1.3

/** Where a route begins: a room's door, or a QR point (the "you are here" spot). */
export type RouteEnd = { kind: 'room'; id: string } | { kind: 'qr'; id: string }

export interface PlanOptions {
  avoidStairs?: boolean
}

/** One floor's part of a route, as a polyline in metres. */
export interface Leg {
  floor: number
  points: Point[]
  /** The room this leg starts in (the start room, or the lift or stairs room it arrived in). */
  startRoomId: string | null
  /** The room this leg ends in (the destination, or the lift or stairs room it leaves by). */
  endRoomId: string
  /** Set when the leg ends by taking a lift or stairs. */
  ride?: { connectorId: string; kind: 'stairs' | 'elevator'; toFloor: number }
}

interface Edge {
  to: string
  cost: number
  /** Connector id for a lift or stairs hop. */
  via?: string
}

export interface Graph {
  data: BuildingData
  pos: Map<string, Point>
  floorOf: Map<string, number>
  adj: Map<string, Edge[]>
  roomByDoor: Map<string, Room>
  kindOfConnector: Map<string, 'stairs' | 'elevator'>
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

const cache = new WeakMap<BuildingData, Graph>()

export function buildGraph(data: BuildingData = buildingData): Graph {
  const hit = cache.get(data)
  if (hit) return hit
  const w = data.walkways
  const pos = new Map(w.nodes.map((n) => [n.id, n.position]))
  const floorOf = new Map(w.nodes.map((n) => [n.id, n.floor]))
  const adj = new Map<string, Edge[]>(w.nodes.map((n) => [n.id, []]))
  for (const e of w.edges) {
    const a = pos.get(e.a)
    const b = pos.get(e.b)
    if (!a || !b) continue
    const cost = dist(a, b)
    adj.get(e.a)!.push({ to: e.b, cost })
    adj.get(e.b)!.push({ to: e.a, cost })
  }
  // A shaft links every pair of floors it serves, so a ride past several floors is one hop.
  for (const c of w.connectors) {
    const stops = Object.entries(c.nodes).map(([floor, id]) => ({ floor: Number(floor), id }))
    for (const a of stops) for (const b of stops) {
      if (a.id !== b.id) adj.get(a.id)?.push({ to: b.id, cost: c.costPerFloor * Math.abs(a.floor - b.floor), via: c.id })
    }
  }
  const graph: Graph = {
    data, pos, floorOf, adj,
    roomByDoor: new Map(data.rooms.filter((r) => r.door).map((r) => [r.door!, r])),
    kindOfConnector: new Map(w.connectors.map((c) => [c.id, c.kind])),
  }
  cache.set(data, graph)
  return graph
}

/** Corridor node (not a door) nearest to a point on a floor: where a QR start joins the graph. */
function nearestCorridorNode(g: Graph, floor: number, p: Point): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const [id, at] of g.pos) {
    if (g.floorOf.get(id) !== floor || g.roomByDoor.has(id)) continue
    const d = dist(at, p)
    if (d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}

interface Resolved {
  node: string
  floor: number
  /** Extra point the ribbon starts or ends on: the room centre, or the QR spot. */
  anchor: Point
  roomId: string | null
}

function resolve(g: Graph, end: RouteEnd): Resolved | null {
  if (end.kind === 'room') {
    const room = g.data.rooms.find((r) => r.id === end.id)
    if (!room?.door) return null
    return { node: room.door, floor: room.floor, anchor: polygonCentroid(room.polygon), roomId: room.id }
  }
  const qr = g.data.qrPoints.find((q) => q.id === end.id)
  if (!qr) return null
  const node = nearestCorridorNode(g, qr.floor, qr.position)
  return node ? { node, floor: qr.floor, anchor: qr.position, roomId: null } : null
}

/** Dijkstra over the walkway graph; returns the node ids from start to goal, or null when unreachable. */
function shortestPath(g: Graph, from: string, to: string, opts: PlanOptions): { nodes: string[]; cost: number } | null {
  const best = new Map<string, number>([[from, 0]])
  const prev = new Map<string, string>()
  const done = new Set<string>()
  // The graph has a few hundred nodes, so a linear scan for the minimum is plenty.
  const open = new Set<string>([from])
  while (open.size) {
    let cur = ''
    let curCost = Infinity
    for (const id of open) {
      const c = best.get(id)!
      if (c < curCost) {
        curCost = c
        cur = id
      }
    }
    open.delete(cur)
    if (cur === to) {
      const nodes = [to]
      while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0]!)!)
      return { nodes, cost: curCost }
    }
    done.add(cur)
    for (const e of g.adj.get(cur) ?? []) {
      if (done.has(e.to)) continue
      if (opts.avoidStairs && e.via && g.kindOfConnector.get(e.via) === 'stairs') continue
      const c = curCost + e.cost
      if (c < (best.get(e.to) ?? Infinity)) {
        best.set(e.to, c)
        prev.set(e.to, cur)
        open.add(e.to)
      }
    }
  }
  return null
}

export interface RouteGeometry {
  legs: Leg[]
  /** Cost in metre-equivalents: walking plus the lift or stairs. */
  cost: number
  meters: number
}

/** Drops repeated points, so zero-length stretches never reach the step builder. */
function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || dist(p, points[i - 1]!) > 0.01)
}

/** Shortest route between two ends, split into one leg per floor. Null when there is none. */
export function findRoute(from: RouteEnd, toRoomId: string, opts: PlanOptions = {}, data: BuildingData = buildingData): RouteGeometry | null {
  const g = buildGraph(data)
  const a = resolve(g, from)
  const b = resolve(g, { kind: 'room', id: toRoomId })
  if (!a || !b || (a.roomId && a.roomId === b.roomId)) return null
  const path = shortestPath(g, a.node, b.node, opts)
  if (!path) return null

  const legs: Leg[] = []
  let meters = 0
  let run: string[] = []
  const flush = (ride?: Leg['ride']) => {
    if (!run.length) return
    const first = run[0]!
    const last = run[run.length - 1]!
    const points = run.map((id) => g.pos.get(id)!)
    for (let i = 1; i < points.length; i++) meters += dist(points[i - 1]!, points[i]!)
    const startRoom = legs.length === 0 ? (data.rooms.find((r) => r.id === a.roomId) ?? null) : (g.roomByDoor.get(first) ?? null)
    if (legs.length === 0) points.unshift(a.anchor) // the start room's centre, or the QR spot
    else if (startRoom) points.unshift(polygonCentroid(startRoom.polygon))
    const endRoom = ride ? g.roomByDoor.get(last)! : data.rooms.find((r) => r.id === b.roomId)!
    points.push(polygonCentroid(endRoom.polygon))
    legs.push({
      floor: g.floorOf.get(first)!,
      // Standing in the lift or stairs room already: the leg is a single point.
      points: startRoom?.id === endRoom.id ? [polygonCentroid(endRoom.polygon)] : dedupe(points),
      startRoomId: startRoom?.id ?? null,
      endRoomId: endRoom.id,
      ...(ride ? { ride } : {}),
    })
    run = []
  }
  for (let i = 0; i < path.nodes.length; i++) {
    const id = path.nodes[i]!
    const next = path.nodes[i + 1]
    run.push(id)
    if (next !== undefined && g.floorOf.get(next) !== g.floorOf.get(id)) {
      const via = g.adj.get(id)!.find((e) => e.to === next && e.via)!.via!
      flush({ connectorId: via, kind: g.kindOfConnector.get(via)!, toFloor: g.floorOf.get(next)! })
    }
  }
  flush()
  return { legs, cost: path.cost, meters }
}
