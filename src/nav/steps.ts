import { buildingData } from '../data'
import { polygonCentroid } from '../data/geometry'
import type { BuildingData, Point } from '../data/types'
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

/** Broad directions: one step to change floors (the visitor chooses lift or stairs) and one to find the room; or one to follow the line. */
function buildSteps(legs: Leg[], toId: string, meters: number, avoidStairs: boolean, data: BuildingData): Step[] {
  const first = legs[0]!
  const lastLeg = legs[legs.length - 1]!
  const endRoom = data.rooms.find((r) => r.id === toId)!
  const endPoint = polygonCentroid(endRoom.polygon)
  if (first.floor === lastLeg.floor) {
    return [{ type: 'follow', roomId: toId, meters, floor: first.floor, leg: 0, point: endPoint }]
  }
  const connectorIds = data.rooms
    .filter((r) => r.floor === first.floor && (r.type === 'elevator' || (!avoidStairs && r.type === 'stairs')))
    .map((r) => r.id)
  return [
    { type: 'goFloor', toFloor: lastLeg.floor, liftOnly: avoidStairs, connectorIds, floor: first.floor, leg: 0, point: first.points[0]! },
    { type: 'find', roomId: toId, floor: lastLeg.floor, leg: legs.length - 1, point: endPoint },
  ]
}

/** Plans a route and writes its directions. Null when there is no route. */
export function planRoute(from: RouteEnd, toId: string, opts: PlanOptions = {}, data: BuildingData = buildingData): RoutePlan | null {
  const geo = findRoute(from, toId, opts, data)
  if (!geo) return null
  const steps = buildSteps(geo.legs, toId, geo.meters, !!opts.avoidStairs, data)
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
