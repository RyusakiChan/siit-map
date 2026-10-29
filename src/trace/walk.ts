import { pointInPolygon, segmentThroughPolygon } from '../data/geometry'
import type { Point, WalkEdge, WalkNode } from '../data/types'
import { projectOnSegment } from './snap'

/** A door node sits this far outside the room's wall, on the corridor side. */
export const DOOR_OFFSET = 0.25

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

export interface DoorPlan {
  /** Where the door node goes. */
  position: Point
  /** The corridor node to join it to (null when no corridor node can be reached yet). */
  linkTo: string | null
  /** Index of the room edge the door sits on. */
  edgeIndex: number
}

/**
 * Plan a door for `room` from a click near one of its walls: the node goes on that wall,
 * 0.25 m outside, and is linked to the nearest corridor node it can reach without crossing a room.
 */
export function planDoor(
  room: Point[],
  click: Point,
  corridorNodes: WalkNode[],
  otherRooms: Point[][],
): DoorPlan | null {
  let edgeIndex = -1
  let onWall: Point = click
  let best = Infinity
  room.forEach((a, i) => {
    const b = room[(i + 1) % room.length]!
    const q = projectOnSegment(click, a, b)
    const d = dist(click, q)
    if (d < best) { best = d; edgeIndex = i; onWall = q }
  })
  if (edgeIndex < 0) return null
  const a = room[edgeIndex]!
  const b = room[(edgeIndex + 1) % room.length]!
  const len = dist(a, b)
  if (len === 0) return null
  const n: Point = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
  // Outward = the side that is not inside this room.
  const probe: Point = [onWall[0] + n[0] * 0.05, onWall[1] + n[1] * 0.05]
  const sign = pointInPolygon(probe, room) ? -1 : 1
  const position: Point = [onWall[0] + sign * n[0] * DOOR_OFFSET, onWall[1] + sign * n[1] * DOOR_OFFSET]

  const blockers = [room, ...otherRooms]
  const reachable = corridorNodes
    .filter((c) => !blockers.some((poly) => segmentThroughPolygon(position, c.position, poly)))
    .sort((p, q) => dist(position, p.position) - dist(position, q.position))
  return { position, linkTo: reachable[0]?.id ?? null, edgeIndex }
}

export interface EdgeHit {
  edge: WalkEdge
  point: Point
  distance: number
}

/** The corridor edge closest to p (within `radius`), with the point on it. */
export function nearestEdge(p: Point, nodes: WalkNode[], edges: WalkEdge[], radius: number): EdgeHit | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let best: EdgeHit | null = null
  for (const e of edges) {
    const a = byId.get(e.a)
    const b = byId.get(e.b)
    if (!a || !b) continue
    const q = projectOnSegment(p, a.position, b.position)
    const d = dist(p, q)
    if (d <= radius && (!best || d < best.distance)) best = { edge: e, point: q, distance: d }
  }
  return best
}

/** Put a new node on an edge, splitting it in two. */
export function splitEdge(edges: WalkEdge[], edge: WalkEdge, nodeId: string): WalkEdge[] {
  return edges.flatMap((e) => (e === edge || (e.a === edge.a && e.b === edge.b) ? [{ a: e.a, b: nodeId }, { a: nodeId, b: e.b }] : [e]))
}

/** Add an edge unless the same two nodes are already joined. */
export function addEdge(edges: WalkEdge[], a: string, b: string): WalkEdge[] {
  if (a === b || edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return edges
  return [...edges, { a, b }]
}
