import { pointInPolygon } from '../data/geometry'
import type { BuildingData, Point } from '../data/types'

/** Which way to turn from facing the map poster to the first walking direction. */
export type Turn = 'left' | 'right' | 'around' | 'ahead'

/** Compass bearing, degrees clockwise from north (north is -z), of the walk from a to b. */
export function bearingDeg(a: Point, b: Point): number {
  const deg = (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI
  return (deg + 360) % 360
}

/**
 * Turn needed when the person faces `facingDeg` (toward the poster) and will walk along `bearing`.
 * rel 30-150 is right, 210-330 left, 150-210 around; within 30 degrees of the poster direction is "ahead" (along the wall).
 */
export function turnFor(bearing: number, facingDeg: number): Turn {
  const rel = (((bearing - facingDeg) % 360) + 360) % 360
  if (rel >= 30 && rel < 150) return 'right'
  if (rel >= 150 && rel <= 210) return 'around'
  if (rel > 210 && rel <= 330) return 'left'
  return 'ahead'
}

/** Within this distance of the lift or stairs door the person is "right next to" it. */
export const NEXT_TO_M = 3

/** True when the point is inside the room or within `NEXT_TO_M` of its door. */
export function isBeside(p: Point, roomId: string, data: BuildingData): boolean {
  const room = data.rooms.find((r) => r.id === roomId)
  if (!room) return false
  const door = room.door ? data.walkways.nodes.find((n) => n.id === room.door)?.position : undefined
  if (door && Math.hypot(door[0] - p[0], door[1] - p[1]) <= NEXT_TO_M) return true
  return pointInPolygon(p, room.polygon)
}

export const POSTER_CAP_M = 4
export const POSTER_GAP_M = 0.05

export interface PosterSpot {
  /** Board centre on the floor plane (metres). */
  x: number
  z: number
  /** True when a wall was hit within the cap; false when the board floats at the cap. */
  hit: boolean
  /** Distance from the pin to the board. */
  dist: number
}

/** Where the scanned poster hangs: along the facing from the pin to the first room or floor-outline edge, 0.05 m off the wall. */
export function posterSpot(pin: { x: number; z: number; floor: number; facingDeg: number }, data: BuildingData): PosterSpot {
  const f = (pin.facingDeg * Math.PI) / 180
  const dx = Math.sin(f)
  const dz = -Math.cos(f)
  let best = POSTER_CAP_M
  let hit = false
  const edges = (poly: Point[]) => {
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i]!
      const [bx, bz] = poly[(i + 1) % poly.length]!
      const ex = bx - ax
      const ez = bz - az
      const den = dx * ez - dz * ex
      if (Math.abs(den) < 1e-9) continue
      const t = ((ax - pin.x) * ez - (az - pin.z) * ex) / den
      const u = ((ax - pin.x) * dz - (az - pin.z) * dx) / den
      if (t > 0.05 && u >= 0 && u <= 1 && t < best) {
        best = t
        hit = true
      }
    }
  }
  edges(data.building.outline)
  for (const r of data.rooms) if (r.floor === pin.floor) edges(r.polygon)
  const d = hit ? Math.max(0, best - POSTER_GAP_M) : POSTER_CAP_M
  return { x: pin.x + dx * d, z: pin.z + dz * d, hit, dist: d }
}
