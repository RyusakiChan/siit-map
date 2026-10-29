import { buildingData } from '../data'
import { polygonCentroid } from '../data/geometry'
import type { BuildingData, Point, Room, RoomType } from '../data/types'
import { buildGraph, findRoute, SECONDS_PER_METRE, type Graph, type Leg, type PlanOptions, type RouteEnd } from './graph'

export type Side = 'left' | 'right' | 'ahead'

interface StepBase {
  /** Floor the step happens on; the map shows this floor. */
  floor: number
  /** Index into `RoutePlan.legs`. */
  leg: number
  /** Where the camera looks while this step is on show. */
  point: Point
}

export type Step = StepBase &
  (
    | { type: 'leave'; roomId: string; side: Side }
    | { type: 'walk'; meters: number; pastId?: string }
    | { type: 'turn'; side: 'left' | 'right'; nearId?: string }
    /** The last corridor turn: the room (or lift, or stairs) is the `nth` door on that side. */
    | { type: 'arrive'; roomId: string; side: Side; nth: number; connector: boolean }
    | { type: 'ride'; kind: 'stairs' | 'elevator'; roomId: string; fromFloor: number; toFloor: number }
  )

export interface RoutePlan {
  from: RouteEnd
  toId: string
  avoidStairs: boolean
  legs: Leg[]
  steps: Step[]
  meters: number
  seconds: number
  minutes: number
  usesStairs: boolean
  usesLift: boolean
}

/** A bend smaller than this (degrees) counts as walking straight on. */
const TURN_MIN = 35
/** A straight stretch shorter than this (metres) gets no "walk" line of its own. */
const WALK_MIN = 3
/** A room whose door lies this far (metres) from the walked line counts as "beside" it. */
const BESIDE = 7

const LANDMARK_TYPES: RoomType[] = ['restroom', 'elevator', 'stairs', 'lobby', 'foodservice', 'library']

/**
 * Compass-style heading in degrees, clockwise from north. The plan has x east and z south, so north is -z:
 * east is 90, north is 0.
 */
export function heading(a: Point, b: Point): number {
  return (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI
}

/** Signed turn from heading h1 to h2 in (-180, 180]: negative is a left turn, positive a right turn. */
export function turnBetween(h1: number, h2: number): number {
  let d = (h2 - h1) % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

const sideOfTurn = (deg: number): Side => (Math.abs(deg) <= TURN_MIN ? 'ahead' : deg < 0 ? 'left' : 'right')

/** Which side of a line a..dir a point lies on, seen when walking along dir (x east, z south). */
function sideOfPoint(a: Point, dir: Point, p: Point): 'left' | 'right' {
  const cross = dir[0] * (p[1] - a[1]) - dir[1] * (p[0] - a[0])
  return cross < 0 ? 'left' : 'right'
}

interface Stretch {
  a: Point
  b: Point
  heading: number
  len: number
}

/** Joins consecutive segments that bend by less than TURN_MIN into straight stretches. */
function stretches(points: Point[]): Stretch[] {
  const out: Stretch[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const h = heading(a, b)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const last = out[out.length - 1]
    if (last && Math.abs(turnBetween(last.heading, h)) <= TURN_MIN) {
      last.b = b
      last.len += len
    } else {
      out.push({ a, b, heading: h, len })
    }
  }
  return out
}

const along = (s: Stretch, p: Point): number => {
  const len = s.len || 1
  return ((p[0] - s.a[0]) * (s.b[0] - s.a[0]) + (p[1] - s.a[1]) * (s.b[1] - s.a[1])) / len
}

const distToLine = (s: Stretch, p: Point): number => {
  const len = s.len || 1
  return Math.abs((s.b[0] - s.a[0]) * (p[1] - s.a[1]) - (s.b[1] - s.a[1]) * (p[0] - s.a[0])) / len
}

/** First facility (lift, stairs, restrooms, lobby, cafe, library) beside a stretch, other than the rooms at its ends. */
function landmarkAlong(g: Graph, floor: number, s: Stretch, skip: Set<string>): string | undefined {
  let best: { id: string; t: number } | undefined
  for (const room of g.data.rooms) {
    if (room.floor !== floor || skip.has(room.id) || !room.door || !LANDMARK_TYPES.includes(room.type)) continue
    const at = g.pos.get(room.door)!
    const t = along(s, at)
    if (t > 0.5 && t < s.len - 0.5 && distToLine(s, at) <= BESIDE && (!best || t < best.t)) best = { id: room.id, t }
  }
  return best?.id
}

/** Which door on its side the room is, counting from where the walker turned into the corridor. */
function doorOrdinal(g: Graph, floor: number, s: Stretch, room: Room): { side: 'left' | 'right'; nth: number } {
  const door = g.pos.get(room.door!)!
  const dir: Point = [s.b[0] - s.a[0], s.b[1] - s.a[1]]
  const side = sideOfPoint(s.a, dir, door)
  const tDoor = along(s, door)
  let nth = 0
  for (const other of g.data.rooms) {
    if (other.floor !== floor || !other.door) continue
    const at = g.pos.get(other.door)!
    const t = along(s, at)
    if (distToLine(s, at) <= BESIDE && t > 0.5 && t <= tDoor + 0.01 && sideOfPoint(s.a, dir, at) === side) nth++
  }
  return { side, nth: Math.max(1, nth) }
}

function stepsForLeg(g: Graph, leg: Leg, index: number): Step[] {
  const ss = stretches(leg.points)
  const out: Step[] = []
  const base = (point: Point) => ({ floor: leg.floor, leg: index, point })
  const endRoom = g.data.rooms.find((r) => r.id === leg.endRoomId)!
  const endCentre = polygonCentroid(endRoom.polygon)
  const skip = new Set([leg.endRoomId, ...(leg.startRoomId ? [leg.startRoomId] : [])])
  let k = 0

  if (leg.startRoomId === leg.endRoomId) {
    // Starting inside the lift or stairs: just ride.
    if (leg.ride) out.push({ type: 'ride', kind: leg.ride.kind, roomId: leg.endRoomId, fromFloor: leg.floor, toFloor: leg.ride.toFloor, ...base(endCentre) })
    return out
  }

  if (leg.startRoomId && ss[0]) {
    const next = ss[1]
    out.push({ type: 'leave', roomId: leg.startRoomId, side: next ? sideOfTurn(turnBetween(ss[0].heading, next.heading)) : 'ahead', ...base(ss[0].b) })
    k = 1
  }

  // The final stretch runs from the corridor into the end room; the turn before it is the arrival.
  const lastWalk = ss.length - 2
  for (let i = k; i <= lastWalk; i++) {
    const s = ss[i]!
    if (s.len >= WALK_MIN) {
      const pastId = landmarkAlong(g, leg.floor, s, skip)
      out.push({ type: 'walk', meters: s.len, ...(pastId ? { pastId } : {}), ...base(s.b) })
    }
    const turn = turnBetween(s.heading, ss[i + 1]!.heading)
    if (i === lastWalk) {
      const { side, nth } = endRoom.door ? doorOrdinal(g, leg.floor, s, endRoom) : { side: sideOfTurn(turn), nth: 1 }
      out.push({ type: 'arrive', roomId: endRoom.id, side: sideOfTurn(turn) === 'ahead' ? 'ahead' : side, nth, connector: !!leg.ride, ...base(endCentre) })
    } else {
      const near = landmarkAlong(g, leg.floor, { ...ss[i + 1]!, a: s.b }, skip)
      out.push({ type: 'turn', side: turn < 0 ? 'left' : 'right', ...(near ? { nearId: near } : {}), ...base(s.b) })
    }
  }
  if (lastWalk < k) {
    // Nothing to walk: the room is straight across from where the walker is.
    out.push({ type: 'arrive', roomId: endRoom.id, side: 'ahead', nth: 1, connector: !!leg.ride, ...base(endCentre) })
  }
  if (leg.ride) {
    out.push({ type: 'ride', kind: leg.ride.kind, roomId: leg.endRoomId, fromFloor: leg.floor, toFloor: leg.ride.toFloor, ...base(endCentre) })
  }
  return out
}

/** Plans a route and writes its step-by-step directions. Null when there is no route. */
export function planRoute(from: RouteEnd, toId: string, opts: PlanOptions = {}, data: BuildingData = buildingData): RoutePlan | null {
  const geo = findRoute(from, toId, opts, data)
  if (!geo) return null
  const g = buildGraph(data)
  const steps = geo.legs.flatMap((leg, i) => stepsForLeg(g, leg, i))
  const seconds = geo.cost * SECONDS_PER_METRE
  return {
    from,
    toId,
    avoidStairs: !!opts.avoidStairs,
    legs: geo.legs,
    steps,
    meters: geo.meters,
    seconds,
    minutes: Math.max(1, Math.round(seconds / 60)),
    usesStairs: geo.legs.some((l) => l.ride?.kind === 'stairs'),
    usesLift: geo.legs.some((l) => l.ride?.kind === 'elevator'),
  }
}
