// Shared helpers for tracing a floor from a plan poster (scratch tooling, not shipped).
import { createRequire } from 'node:module'
import { solveAffine, applyAffine, type Affine } from '../../src/trace/affine'
import { planDoor, nearestEdge, splitEdge } from '../../src/trace/walk'
import { polygonArea } from '../../src/data/geometry'
import type { Point, Room, WalkNode, WalkEdge, RoomType } from '../../src/data/types'
const require = createRequire(import.meta.url)
const pc = require('polygon-clipping') as { intersection: (...g: unknown[]) => number[][][][] }

export const round2 = (n: number) => Math.round(n * 100) / 100
export const roundP = (p: Point): Point => [round2(p[0]), round2(p[1])]

export interface Fit { m: Affine; to: (p: Point) => Point }
export function makeFit(px: [Point, Point, Point], metres: [Point, Point, Point]): Fit {
  const m = solveAffine(px, metres)
  if (!m) throw new Error('bad fit')
  return { m, to: (p) => applyAffine(m, p) }
}

/**
 * Projective fit from four poster corners to metres (the poster is photographed at an angle, so an
 * affine fit leaves metres of error at the far corner). Solves the 8 homography parameters.
 */
export function makeHomography(px: Point[], metres: Point[]): Fit {
  const A: number[][] = []
  const b: number[] = []
  px.forEach(([x, y], i) => {
    const [X, Z] = metres[i]!
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X)
    A.push([0, 0, 0, x, y, 1, -Z * x, -Z * y]); b.push(Z)
  })
  // Gaussian elimination
  const n = 8
  const M = A.map((r, i) => [...r, b[i]!])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r
    ;[M[c], M[piv]] = [M[piv]!, M[c]!]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r]![c]! / M[c]![c]!
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!
    }
  }
  const h = M.map((r, i) => r[n]! / r[i]!)
  const to = ([x, y]: Point): Point => {
    const w = h[6]! * x + h[7]! * y + 1
    return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w]
  }
  return { m: [0, 0, 0, 0, 0, 0], to }
}

/** Miter inset of a simple polygon by d metres. */
export function inset(poly: Point[], d: number): Point[] {
  const n = poly.length
  const area = poly.reduce((s, p, i) => s + p[0] * poly[(i + 1) % n]![1] - poly[(i + 1) % n]![0] * p[1], 0) / 2
  const sgn = area > 0 ? 1 : -1
  const norm = (a: Point, b: Point): Point => {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz)
    return [(-dz / l) * sgn, (dx / l) * sgn] // inward normal
  }
  return poly.map((cur, i) => {
    const prev = poly[(i + n - 1) % n]!, next = poly[(i + 1) % n]!
    const n1 = norm(prev, cur), n2 = norm(cur, next)
    const k = d / Math.max(0.3, 1 + n1[0] * n2[0] + n1[1] * n2[1])
    return [cur[0] + (n1[0] + n2[0]) * k, cur[1] + (n1[1] + n2[1]) * k] as Point
  })
}

export interface ClipResult { poly: Point[]; keptFraction: number }
/** Intersection of a polygon with the outline; the biggest piece is kept. */
export function clipToOutline(poly: Point[], outline: Point[]): ClipResult {
  const res = pc.intersection([poly as unknown as number[][]], [outline as unknown as number[][]])
  const a0 = polygonArea(poly)
  if (!res.length) return { poly: [], keptFraction: 0 }
  const rings = res.map((r) => r[0]!.slice(0, -1) as unknown as Point[])
  rings.sort((x, y) => polygonArea(y) - polygonArea(x))
  return { poly: rings[0]!, keptFraction: polygonArea(rings[0]!) / a0 }
}

/** Remove duplicate and collinear points. */
export function clean(poly: Point[]): Point[] {
  let p = poly.filter((q, i) => Math.hypot(q[0] - poly[(i + 1) % poly.length]![0], q[1] - poly[(i + 1) % poly.length]![1]) > 0.02)
  let changed = true
  while (changed && p.length > 3) {
    changed = false
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length]!, b = p[i]!, c = p[(i + 1) % p.length]!
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      if (Math.abs(cr) < 0.02) { p = p.filter((_, j) => j !== i); changed = true; break }
    }
  }
  return p
}

/** Split a quad (top-left, top-right, bottom-right, bottom-left) into n strips left to right. */
export function splitQuad(q: [Point, Point, Point, Point], n: number): Point[][] {
  const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  return Array.from({ length: n }, (_, i) => [lerp(q[0], q[1], i / n), lerp(q[0], q[1], (i + 1) / n), lerp(q[3], q[2], (i + 1) / n), lerp(q[3], q[2], i / n)])
}

export interface RoomSpec {
  id: string
  number: string | null
  name: string
  nameTh?: string
  aliases?: string[]
  type: RoomType
  departmentId?: string | null
  departmentIds?: string[]
  photo?: string
  /** polygon in poster pixels */
  px: Point[]
  /** Use this metre polygon as is (no clipping, no inset): a shaft snapped onto another floor's room. */
  metres?: Point[]
  /** a click near the wall the door goes on (poster pixels) */
  door: Point
  /** optional point on the corridor to join (poster pixels); otherwise the nearest corridor edge */
  link?: Point
}

export interface Plan {
  floor: number
  fit: Fit
  outline: Point[]
  voidsPx: Point[][]
  /** Voids in metres, used instead of voidsPx (the same atrium as another floor). */
  voidsMetres?: Point[][]
  rooms: RoomSpec[]
  corridorNodesPx: Record<string, Point>
  corridorEdges: [string, string][]
  gap: number
}

export interface Built {
  rooms: Room[]
  nodes: WalkNode[]
  edges: WalkEdge[]
  voids: Point[][]
  report: string[]
}

export function build(plan: Plan): Built {
  const { floor, fit, outline } = plan
  const report: string[] = []
  const rooms: Room[] = []
  const polys = new Map<string, Point[]>()
  for (const spec of plan.rooms) {
    let p: Point[]
    if (spec.metres) {
      p = spec.metres
      const c = p.reduce((s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length], [0, 0])
      const f = clean(inset(clean(clipToOutline(spec.px.map((q) => fit.to(q)), outline).poly), plan.gap / 2).map(roundP))
      const fc = f.reduce((s, q) => [s[0] + q[0] / f.length, s[1] + q[1] / f.length], [0, 0])
      report.push(`snap ${spec.id}: floor-3 shaft centre [${c.map(round2)}], this poster put it at [${fc.map(round2)}] (${Math.hypot(c[0] - fc[0], c[1] - fc[1]).toFixed(1)} m apart)`)
    } else {
      const full = spec.px.map((q) => fit.to(q))
      const clipped = clipToOutline(full, outline)
      if (clipped.keptFraction < 0.999) report.push(`clip ${spec.id}: kept ${(clipped.keptFraction * 100).toFixed(0)}% of its area${clipped.keptFraction < 0.75 ? ' (MORE THAN A QUARTER REMOVED)' : ''}`)
      p = clean(inset(clean(clipped.poly), plan.gap / 2).map(roundP))
    }
    polys.set(spec.id, p)
    rooms.push({
      id: spec.id, number: spec.number, name: spec.name, ...(spec.nameTh ? { nameTh: spec.nameTh } : {}),
      ...(spec.aliases?.length ? { aliases: spec.aliases } : {}), floor,
      departmentId: spec.departmentId ?? null,
      ...(spec.departmentIds ? { departmentIds: spec.departmentIds } : {}),
      type: spec.type, polygon: p, ...(spec.photo ? { photo: spec.photo } : {}),
    })
  }
  const voids = plan.voidsMetres ?? plan.voidsPx.map((v) => clean(v.map((p) => fit.to(p)).map(roundP)))

  const nodes: WalkNode[] = []
  let edges: WalkEdge[] = []
  const idOf = new Map<string, string>()
  let c = 0
  let d = 0
  const newC = (pos: Point) => { const id = `f${floor}-c${++c}`; nodes.push({ id, floor, position: roundP(pos) }); return id }
  for (const [k, p] of Object.entries(plan.corridorNodesPx)) idOf.set(k, newC(fit.to(p)))
  for (const [a, b] of plan.corridorEdges) edges.push({ a: idOf.get(a)!, b: idOf.get(b)! })
  const obstacles = [...polys.values(), ...voids]
  for (const spec of plan.rooms) {
    const poly = polys.get(spec.id)!
    const others = obstacles.filter((o) => o !== poly)
    const door = planDoor(poly, fit.to(spec.door), [], others)
    if (!door) { report.push(`NO DOOR PLAN ${spec.id}`); continue }
    const pos = roundP(door.position)
    const target = spec.link ? fit.to(spec.link) : pos
    const hit = nearestEdge(target, nodes, edges, 1e9)
    if (!hit) { report.push(`no corridor for ${spec.id}`); continue }
    const doorId = `f${floor}-d${++d}`
    nodes.push({ id: doorId, floor, position: pos })
    const na = nodes.find((n) => n.id === hit.edge.a)!
    const nb = nodes.find((n) => n.id === hit.edge.b)!
    const near = [na, nb].find((n) => Math.hypot(n.position[0] - hit.point[0], n.position[1] - hit.point[1]) < 0.4)
    let to: string
    if (near) to = near.id
    else {
      to = newC(hit.point)
      edges = splitEdge(edges, hit.edge, to)
    }
    edges.push({ a: doorId, b: to })
    rooms.find((x) => x.id === spec.id)!.door = doorId
    const tp = nodes.find((n) => n.id === to)!.position
    report.push(`door ${spec.id}: ${doorId} at [${pos}] -> ${to} (${Math.hypot(pos[0] - tp[0], pos[1] - tp[1]).toFixed(1)} m) GUESSED`)
  }
  return { rooms, nodes, edges, voids, report }
}
