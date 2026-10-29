import type { Point } from '../data/types'

export type SnapKind = 'corner' | 'edge' | 'angle' | 'none'
export interface Snap {
  point: Point
  kind: SnapKind
}

export interface SnapContext {
  outline: Point[]
  /** Polygons of the other rooms on this floor (their corners and walls are snap targets). */
  rooms: Point[][]
  /** Points already placed in the shape being drawn; the last one is the anchor for angle snapping. */
  drawn?: Point[]
  /** Snap distance in metres (depends on the zoom). */
  radius: number
  /** Hold Shift to draw at free angles. */
  free?: boolean
  /** Snap to outline and room edges as well as corners. Default true. */
  edges?: boolean
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Closest point to p on segment ab. */
export function projectOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  return [a[0] + t * dx, a[1] + t * dz]
}

function ringEdges(poly: Point[]): [Point, Point][] {
  return poly.map((p, i) => [p, poly[(i + 1) % poly.length]!])
}

/** Snap a cursor position to corners, walls and right angles. */
export function snapPoint(p: Point, ctx: SnapContext): Snap {
  const rings = [ctx.outline, ...ctx.rooms]
  let best: Snap | null = null
  let bestD = ctx.radius

  for (const ring of rings) {
    for (const c of ring) {
      const d = dist(p, c)
      if (d <= bestD) { best = { point: c, kind: 'corner' }; bestD = d }
    }
  }
  if (best) return best

  if (ctx.edges !== false) {
    for (const ring of rings) {
      for (const [a, b] of ringEdges(ring)) {
        const q = projectOnSegment(p, a, b)
        const d = dist(p, q)
        if (d <= bestD) { best = { point: q, kind: 'edge' }; bestD = d }
      }
    }
    if (best) return best
  }

  const drawn = ctx.drawn ?? []
  if (!ctx.free && drawn.length >= 1) {
    const anchor = drawn[drawn.length - 1]!
    const prev = drawn[drawn.length - 2]
    // Directions that keep a right angle: the axes, or (once there is an edge) along and across the last edge.
    const dirs: Point[] = [[1, 0], [0, 1]]
    if (prev && dist(prev, anchor) > 0.01) {
      const l = dist(prev, anchor)
      const u: Point = [(anchor[0] - prev[0]) / l, (anchor[1] - prev[1]) / l]
      dirs.unshift(u, [-u[1], u[0]])
    }
    let bestLine: Point | null = null
    let bestOff = ctx.radius
    for (const u of dirs) {
      const t = (p[0] - anchor[0]) * u[0] + (p[1] - anchor[1]) * u[1]
      const q: Point = [anchor[0] + t * u[0], anchor[1] + t * u[1]]
      const off = dist(p, q)
      if (off <= bestOff) { bestLine = q; bestOff = off }
    }
    if (bestLine) return { point: bestLine, kind: 'angle' }
  }
  return { point: p, kind: 'none' }
}
