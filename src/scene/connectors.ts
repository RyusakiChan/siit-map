import * as THREE from 'three'
import type { Point } from '../data/types'

/** Shading factor of a wall facing away from the key light (north-west); walls facing it stay at 1. */
export const SHADE_DARK = 0.9

/** 1 for a wall whose outward normal faces north-west, SHADE_DARK for one facing south-east. */
export function wallShade(nx: number, nz: number): number {
  const len = Math.hypot(nx, nz)
  if (len < 1e-6) return 1
  const d = (-nx - nz) / (len * Math.SQRT2) // -1 (south-east) .. 1 (north-west)
  return SHADE_DARK + (1 - SHADE_DARK) * ((d + 1) / 2)
}

/** Adds a per-vertex `color` shade to an extrusion (used with vertexColors on the side material). Caps stay at 1. */
export function shadeExtrusion(g: THREE.BufferGeometry): void {
  const n = g.getAttribute('normal')
  const colors = new Float32Array(n.count * 3)
  for (let i = 0; i < n.count; i++) {
    // The shape lies in the XY plane and is rotated -90° about X: shape y becomes world -z.
    const flat = Math.abs(n.getZ(i)) > 0.5
    const s = flat ? 1 : wallShade(n.getX(i), -n.getY(i))
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = s
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

/** The room as a frame: origin corner, a long axis `u`, a short axis `v` (unit vectors on the floor) and the lengths. */
export interface Frame {
  o: Point
  u: Point
  v: Point
  L: number
  W: number
}

export function frameOf(poly: Point[]): Frame | null {
  if (poly.length !== 4) return null
  const [p0, p1, , p3] = poly as [Point, Point, Point, Point]
  const a: Point = [p1[0] - p0[0], p1[1] - p0[1]]
  const b: Point = [p3[0] - p0[0], p3[1] - p0[1]]
  const la = Math.hypot(...a)
  const lb = Math.hypot(...b)
  if (la < 0.5 || lb < 0.5) return null
  const ua: Point = [a[0] / la, a[1] / la]
  const ub: Point = [b[0] / lb, b[1] / lb]
  return la >= lb ? { o: p0, u: ua, v: ub, L: la, W: lb } : { o: p0, u: ub, v: ua, L: lb, W: la }
}

const toWorld = (f: Frame, lu: number, lv: number): Point => [f.o[0] + lu * f.u[0] + lv * f.v[0], f.o[1] + lu * f.u[1] + lv * f.v[1]]

/** Boxes in a room's frame, merged into one geometry: group 0 holds the tops, group 1 the walls. */
class BoxBuilder {
  private tops: number[] = []
  private walls: number[] = []
  private topShade: number[] = []
  private wallShadeV: number[] = []
  constructor(private f: Frame) {}

  private quad(into: number[], shade: number[], c: [number[], number[], number[], number[]], n: [number, number, number], s: number) {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      into.push(c[k]![0]!, c[k]![1]!, c[k]![2]!, n[0], n[1], n[2])
      shade.push(s)
    }
  }

  /** A box between local (u0..u1, v0..v1), y0..y1. The underside is skipped. */
  box(u0: number, u1: number, v0: number, v1: number, y0: number, y1: number) {
    const f = this.f
    const P = (lu: number, lv: number, y: number): number[] => {
      const [x, z] = toWorld(f, lu, lv)
      return [x, y, z]
    }
    // top
    this.quad(this.tops, this.topShade, [P(u0, v0, y1), P(u0, v1, y1), P(u1, v1, y1), P(u1, v0, y1)], [0, 1, 0], 1)
    const side = (a: [number, number], b: [number, number], nl: [number, number]) => {
      // a, b are local (u, v) corners walking counter-clockwise seen from above; nl is the outward local normal.
      const nx = nl[0] * f.u[0] + nl[1] * f.v[0]
      const nz = nl[0] * f.u[1] + nl[1] * f.v[1]
      this.quad(this.walls, this.wallShadeV, [P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], y1), P(a[0], a[1], y1)], [nx, 0, nz], wallShade(nx, nz))
    }
    side([u0, v0], [u1, v0], [0, -1])
    side([u1, v0], [u1, v1], [1, 0])
    side([u1, v1], [u0, v1], [0, 1])
    side([u0, v1], [u0, v0], [-1, 0])
  }

  build(): THREE.BufferGeometry {
    const pos: number[] = []
    const nor: number[] = []
    const col: number[] = []
    const push = (src: number[], shade: number[]) => {
      for (let i = 0; i < shade.length; i++) {
        pos.push(src[i * 6]!, src[i * 6 + 1]!, src[i * 6 + 2]!)
        nor.push(src[i * 6 + 3]!, src[i * 6 + 4]!, src[i * 6 + 5]!)
        col.push(shade[i]!, shade[i]!, shade[i]!)
      }
    }
    push(this.tops, this.topShade)
    push(this.walls, this.wallShadeV)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.addGroup(0, this.topShade.length, 0)
    g.addGroup(this.topShade.length, this.wallShadeV.length, 1)
    return g
  }
}

const WALL = 0.25 // thickness of the low wall round a stair core
const WALL_H = 0.3
const STEP_RISE = 0.19 // the target height of one step

/**
 * Stairs inside a rectangular room: a switchback (two flights and a half landing) when the room is at
 * least 2.4 m across its short side, otherwise one straight flight. The first step is at the end of the room
 * nearest `door`. Group 0 is every top (treads, wall tops), group 1 every riser and wall. Null for other shapes.
 */
export function stairsGeometry(poly: Point[], door: Point | undefined, height: number): THREE.BufferGeometry | null {
  const f = frameOf(poly)
  if (!f) return null
  const b = new BoxBuilder(f)
  const { L, W } = f
  // Flight direction: s runs from the door end (0) to the far end (L). u = s, or L - s when the door is at the high end.
  const du = door ? (door[0] - f.o[0]) * f.u[0] + (door[1] - f.o[1]) * f.u[1] : 0
  const flip = du > L / 2
  const U = (s0: number, s1: number): [number, number] => {
    const a = flip ? L - s0 : s0
    const c = flip ? L - s1 : s1
    return [Math.min(a, c), Math.max(a, c)]
  }
  const sbox = (s0: number, s1: number, v0: number, v1: number, y1: number, y0 = 0) => {
    const [u0, u1] = U(s0, s1)
    b.box(u0, u1, v0, v1, y0, y1)
  }
  // low wall round the edge
  b.box(0, L, 0, WALL, 0, WALL_H)
  b.box(0, L, W - WALL, W, 0, WALL_H)
  b.box(0, WALL, WALL, W - WALL, 0, WALL_H)
  b.box(L - WALL, L, WALL, W - WALL, 0, WALL_H)
  const s0 = WALL
  const s1 = L - WALL
  const v0 = WALL
  const v1 = W - WALL
  if (W >= 2.4) {
    const half = height / 2
    const n = Math.max(3, Math.round(half / STEP_RISE))
    const h = half / n
    const landing = Math.max(1.4, W / 2)
    const lf = s1 - s0 - landing
    const d = lf / n
    const mid = W / 2
    for (let i = 0; i < n; i++) sbox(s0 + i * d, s0 + (i + 1) * d, v0, mid - 0.04, (i + 1) * h) // up
    sbox(s0 + lf, s1, v0, v1, half) // landing
    for (let j = 0; j < n; j++) sbox(s0 + lf - (j + 1) * d, s0 + lf - j * d, mid + 0.04, v1, half + (j + 1) * h) // back down the other side
  } else {
    const n = Math.max(6, Math.round(height / STEP_RISE))
    const h = height / n
    const d = (s1 - s0) / n
    for (let i = 0; i < n; i++) sbox(s0 + i * d, s0 + (i + 1) * d, v0, v1, (i + 1) * h)
  }
  return b.build()
}

/** Two door leaves on the face of a rectangular room nearest `door`, just proud of the wall. Null for other shapes. */
export function liftDoorGeometry(poly: Point[], door: Point | undefined): THREE.BufferGeometry | null {
  if (!door || poly.length < 3) return null
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length
  let best: { a: Point; b: Point; d: number } | null = null
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len2 = dx * dx + dz * dz
    if (len2 < 0.25) return
    const t = Math.max(0, Math.min(1, ((door[0] - a[0]) * dx + (door[1] - a[1]) * dz) / len2))
    const d = Math.hypot(door[0] - (a[0] + t * dx), door[1] - (a[1] + t * dz))
    if (!best || d < best.d) best = { a, b, d }
  })
  if (!best) return null
  const { a, b } = best as { a: Point; b: Point }
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const tx = (b[0] - a[0]) / len
  const tz = (b[1] - a[1]) / len
  let nx = -tz
  let nz = tx
  const mx = (a[0] + b[0]) / 2
  const mz = (a[1] + b[1]) / 2
  if ((mx - cx) * nx + (mz - cz) * nz < 0) {
    nx = -nx
    nz = -nz
  }
  const w = Math.min(len * 0.7, 2.6)
  const gap = 0.05
  const h = 2.3
  const off = 0.04
  const pos: number[] = []
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -w / 2 : gap / 2
    const x1 = side < 0 ? -gap / 2 : w / 2
    const P = (s: number, y: number): number[] => [mx + tx * s + nx * off, y, mz + tz * s + nz * off]
    const q = [P(x0, 0), P(x1, 0), P(x1, h), P(x0, h)]
    // wound so that the front (outward) face is the visible one
    for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...q[k]!)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}
