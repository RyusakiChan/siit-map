import { buildingData } from '../data'
import { polygonCentroid } from '../data/geometry'
import type { BuildingData, Point } from '../data/types'
import { bearingDeg, isBeside, turnFor, type Turn } from './orient'
import { findRoute, SECONDS_PER_METRE, type Leg, type PlanOptions, type RouteEnd } from './graph'

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
    /** Multi-floor trips, first step: the visitor picks the lift or stairs. `connectorIds` are all of them on the start floor. */
    | { type: 'goFloor'; toFloor: number; liftOnly: boolean; connectorIds: string[] }
    /** Multi-floor trips, second step: look for the room on the destination floor. */
    | { type: 'find'; roomId: string }
    /** Same-floor trips: follow the line on the map. */
    | { type: 'follow'; roomId: string; meters: number }
    /**
     * QR starts only, first step: face the map poster, then turn and walk. `bearing` is the first walking direction
     * (degrees clockwise from north). `beside` means the lift or stairs are right next to the scanner (no turn).
     */
    | { type: 'orient'; qrId: string; turn: Turn | 'beside'; bearing: number; place: { kind: 'lifts' | 'stairs' | 'room'; roomId?: string } }
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

/** "Face the map poster, then turn and walk": toward the lift or stairs the route leaves by, or toward the room on one floor. */
function orientStep(qrId: string, legs: Leg[], toId: string, data: BuildingData): Step | null {
  const qr = data.qrPoints.find((q) => q.id === qrId)
  const first = legs[0]
  if (!qr || !first) return null
  const multi = legs.length > 1
  const connector = multi ? data.rooms.find((r) => r.id === first.endRoomId) : undefined
  const place: { kind: 'lifts' | 'stairs' | 'room'; roomId?: string } = connector
    ? { kind: connector.type === 'elevator' ? 'lifts' : 'stairs', roomId: connector.id }
    : { kind: 'room', roomId: toId }
  const base = { floor: qr.floor, leg: 0, point: qr.position, type: 'orient' as const, qrId, place }
  if (connector && isBeside(qr.position, connector.id, data)) return { ...base, turn: 'beside', bearing: qr.facingDeg }
  const target = first.points.find((p) => Math.hypot(p[0] - qr.position[0], p[1] - qr.position[1]) >= 2) ?? first.points[first.points.length - 1]!
  if (Math.hypot(target[0] - qr.position[0], target[1] - qr.position[1]) < 0.1) return { ...base, turn: 'ahead', bearing: qr.facingDeg }
  const bearing = bearingDeg(qr.position, target)
  return { ...base, turn: turnFor(bearing, qr.facingDeg), bearing }
}

/** Broad directions: one step to change floors (the visitor chooses lift or stairs) and one to find the room; or one to follow the line. */
function buildSteps(from: RouteEnd, legs: Leg[], toId: string, meters: number, avoidStairs: boolean, data: BuildingData): Step[] {
  const first = legs[0]!
  const lastLeg = legs[legs.length - 1]!
  const endRoom = data.rooms.find((r) => r.id === toId)!
  const endPoint = polygonCentroid(endRoom.polygon)
  const orient = from.kind === 'qr' ? orientStep(from.id, legs, toId, data) : null
  if (first.floor === lastLeg.floor) {
    return [...(orient ? [orient] : []), { type: 'follow', roomId: toId, meters, floor: first.floor, leg: 0, point: endPoint }]
  }
  const connectorIds = data.rooms
    .filter((r) => r.floor === first.floor && (r.type === 'elevator' || (!avoidStairs && r.type === 'stairs')))
    .map((r) => r.id)
  return [
    ...(orient ? [orient] : []),
    { type: 'goFloor', toFloor: lastLeg.floor, liftOnly: avoidStairs, connectorIds, floor: first.floor, leg: 0, point: first.points[0]! },
    { type: 'find', roomId: toId, floor: lastLeg.floor, leg: legs.length - 1, point: endPoint },
  ]
}

/** Plans a route and writes its directions. Null when there is no route. */
export function planRoute(from: RouteEnd, toId: string, opts: PlanOptions = {}, data: BuildingData = buildingData): RoutePlan | null {
  const geo = findRoute(from, toId, opts, data)
  if (!geo) return null
  const steps = buildSteps(from, geo.legs, toId, geo.meters, !!opts.avoidStairs, data)
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
