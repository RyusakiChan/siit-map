import type { Point } from '../data/types'

/** SVG matrix order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number]

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

export function applyAffine(m: Affine, [x, y]: Point): Point {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** `first` is applied first, then `second`. */
export function compose(second: Affine, first: Affine): Affine {
  const [a1, b1, c1, d1, e1, f1] = second
  const [a2, b2, c2, d2, e2, f2] = first
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1]
}

export function invertAffine(m: Affine): Affine | null {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  if (Math.abs(det) < 1e-12) return null
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

const det3 = (m: number[][]) =>
  m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
  m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
  m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!)

/** Solve [x y 1]·[p q r]ᵀ = v for three points (Cramer's rule). */
function solve3(rows: number[][], v: number[]): [number, number, number] | null {
  const d = det3(rows)
  if (Math.abs(d) < 1e-9) return null
  const col = (k: number) => det3(rows.map((r, i) => r.map((x, j) => (j === k ? v[i]! : x)))) / d
  return [col(0), col(1), col(2)]
}

/**
 * The affine transform that maps three points `from` onto three points `to`.
 * Handles scale, rotation, skew and a slanted photo. Null when the points are in a line.
 */
export function solveAffine(from: [Point, Point, Point], to: [Point, Point, Point]): Affine | null {
  const rows = from.map(([x, y]) => [x, y, 1])
  const xs = solve3(rows, to.map((p) => p[0]))
  const ys = solve3(rows, to.map((p) => p[1]))
  if (!xs || !ys) return null
  return [xs[0], ys[0], xs[1], ys[1], xs[2], ys[2]]
}

export const translate = (dx: number, dz: number): Affine => [1, 0, 0, 1, dx, dz]

export function rotateAbout(deg: number, [cx, cy]: Point): Affine {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]
}

export function scaleAbout(k: number, [cx, cy]: Point): Affine {
  return [k, 0, 0, k, cx - k * cx, cy - k * cy]
}
