import type { Point } from './types'

export type Seg = [Point, Point]

function edges(poly: Point[]): Seg[] {
  return poly.map((p, i): Seg => [p, poly[(i + 1) % poly.length] ?? p])
}

function distToSegment(p: Point, [a, b]: Seg): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
}

/** Ray-casting test; points within `tol` of the boundary count as inside. */
export function pointInPolygon(p: Point, poly: Point[], tol = 0): boolean {
  if (edges(poly).some((e) => distToSegment(p, e) <= tol)) return true
  let inside = false
  for (const [a, b] of edges(poly)) {
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  return inside
}

/** True when the segments cross at a single interior point (touching ends do not count). */
export function segmentsCross([a, b]: Seg, [c, d]: Seg): boolean {
  const cross = (o: Point, p: Point, q: Point) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Distance from a point to the polygon's boundary. */
export function boundaryDistance(p: Point, poly: Point[]): number {
  return Math.min(...edges(poly).map((e) => distToSegment(p, e)))
}

/** Test points for overlap: vertices and edge midpoints. */
function samples(poly: Point[]): Point[] {
  return edges(poly).flatMap(([a, b]): Point[] => [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]])
}

/**
 * Whether two polygons overlap by more than `tol` metres. Shared edges and
 * touching corners are fine; crossing edges or a point sitting deeper than
 * `tol` inside the other polygon are not.
 */
export function polygonsOverlap(a: Point[], b: Point[], tol = 0.05): boolean {
  for (const ea of edges(a)) for (const eb of edges(b)) if (segmentsCross(ea, eb)) return true
  const deepInside = (pts: Point[], other: Point[]) =>
    pts.some((p) => pointInPolygon(p, other) && boundaryDistance(p, other) > tol)
  return deepInside(samples(a), b) || deepInside(samples(b), a)
}

/** Whether `inner` lies inside `outer` (within `tol` metres of its edge). */
export function polygonInside(inner: Point[], outer: Point[], tol = 0.05): boolean {
  if (!inner.every((p) => pointInPolygon(p, outer, tol))) return false
  // A concave outline can still be crossed by an edge whose ends are inside.
  for (const ei of edges(inner)) for (const eo of edges(outer)) {
    if (segmentsCross(ei, eo)) return false
  }
  return true
}

/** Area-weighted centroid. */
export function polygonCentroid(poly: Point[]): Point {
  let a = 0
  let cx = 0
  let cz = 0
  for (const [p, q] of edges(poly)) {
    const f = p[0] * q[1] - q[0] * p[1]
    a += f
    cx += (p[0] + q[0]) * f
    cz += (p[1] + q[1]) * f
  }
  return a === 0 ? (poly[0] ?? [0, 0]) : [cx / (3 * a), cz / (3 * a)]
}

export function polygonArea(poly: Point[]): number {
  return Math.abs(edges(poly).reduce((s, [p, q]) => s + p[0] * q[1] - q[0] * p[1], 0)) / 2
}
