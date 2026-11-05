import * as THREE from 'three'
import type { Point, RoomModel } from '../data/types'
import { wallShade } from './connectors'

/** Real-world heights (m); the scene uses them for labels before the geometry is built. */
export const KIOSK_HEIGHT: Record<RoomModel, number> = { 'atm-krungsri': 1.9, 'kiosk-taobin': 1.95 }

const DIM_AMOUNT = 0.9
const DIM_TOP = new THREE.Color('#EBE6EC')
const DIM_SIDE = new THREE.Color('#D6CFD7')

/** A flat quad on the front of a header panel, kept as its own mesh so a logo texture can be added later. */
export interface LogoFace {
  geometry: THREE.BufferGeometry
  /** Colour of the header it sits on (the quad is plain until a texture is set). */
  color: THREE.Color
  /** Size in metres, centre in world metres (x, y above the floor, z) and the outward normal on the floor plane. */
  width: number
  height: number
  center: [number, number, number]
  normal: Point
}

export interface KioskModel {
  geometry: THREE.BufferGeometry
  /** Faint outline of the main bodies. */
  edges: THREE.BufferGeometry
  logo: LogoFace
  height: number
  /** Unit vector on the floor the front faces (towards the door). */
  front: Point
  /** Footprint of every vertex, world metres. */
  bbox: { minX: number; maxX: number; minZ: number; maxZ: number }
  triangles: number
  base: Float32Array
  dimmed: Float32Array
}

type V3 = [number, number, number]
type Profile = [d: number, y: number][]

const WALL_MIN = 0.76 // wall shade range: tops are 1, walls 0.76 (away from the light) to 0.92 (facing it)
const shadeOf = (n: V3): number => {
  const wall = WALL_MIN + (wallShade(n[0], n[2]) - 0.9) * 1.6
  const up = Math.max(n[1], 0)
  return wall * (1 - up) + up
}

/** Frame of a machine: back-centre `o` on the floor, `f` points out of the front, `r` is the customer's right. */
interface Frame {
  o: Point
  f: Point
  r: Point
}

class Builder {
  pos: number[] = []
  col: number[] = []
  dimCol: number[] = []
  edgePos: number[] = []
  constructor(private fr: Frame) {}

  world(a: number, d: number, y: number): V3 {
    const { o, f, r } = this.fr
    return [o[0] + a * r[0] + d * f[0], y, o[1] + a * r[1] + d * f[1]]
  }

  private tri(p: V3[], c: THREE.Color, edge: boolean) {
    const [A, B, C] = p as [V3, V3, V3]
    const u: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
    const v: V3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
    const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n) || 1
    const nn: V3 = [n[0] / len, n[1] / len, n[2] / len]
    const s = shadeOf(nn)
    const target = nn[1] > 0.5 ? DIM_TOP : DIM_SIDE
    for (const q of p) {
      this.pos.push(...q)
      this.col.push(c.r * s, c.g * s, c.b * s)
      this.dimCol.push(c.r * s + (target.r - c.r * s) * DIM_AMOUNT, c.g * s + (target.g - c.g * s) * DIM_AMOUNT, c.b * s + (target.b - c.b * s) * DIM_AMOUNT)
      if (edge) this.edgePos.push(...q)
    }
  }

  /** A convex prism: `profile` (depth, height) extruded across a0..a1. The underside is skipped. */
  prism(a0: number, a1: number, profile: Profile, hex: string, edge = false) {
    const c = new THREE.Color(hex)
    const cx = profile.reduce((s, p) => s + p[0], 0) / profile.length
    const cy = profile.reduce((s, p) => s + p[1], 0) / profile.length
    const mid = this.world((a0 + a1) / 2, cx, cy)
    const face = (pts: V3[]) => {
      // Wind every face so its normal points away from the prism centre.
      const [A, B, C] = pts as [V3, V3, V3, ...V3[]]
      const n: V3 = [(B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])]
      const out = n[0] * (A[0] - mid[0]) + n[1] * (A[1] - mid[1]) + n[2] * (A[2] - mid[2]) >= 0
      const ordered = out ? pts : [...pts].reverse()
      for (let i = 1; i < ordered.length - 1; i++) this.tri([ordered[0]!, ordered[i]!, ordered[i + 1]!], c, edge)
    }
    for (const a of [a0, a1]) face(profile.map(([d, y]) => this.world(a, d, y)))
    profile.forEach((p, i) => {
      const q = profile[(i + 1) % profile.length]!
      if (p[1] === q[1] && Math.abs(p[0] - q[0]) > 0 && p[1] === Math.min(...profile.map((x) => x[1])) && profile.every((x) => x[1] >= p[1])) return // underside
      face([this.world(a0, p[0], p[1]), this.world(a1, p[0], p[1]), this.world(a1, q[0], q[1]), this.world(a0, q[0], q[1])])
    })
  }

  /** An axis-aligned box: across a0..a1, depth d0..d1, height y0..y1. */
  box(a0: number, a1: number, d0: number, d1: number, y0: number, y1: number, hex: string, edge = false) {
    this.prism(a0, a1, [[d0, y0], [d1, y0], [d1, y1], [d0, y1]], hex, edge)
  }
}

interface Design {
  width: number
  depth: number
  height: number
  build: (b: Builder) => { logo: { a: number; y: number; w: number; h: number; d: number; color: string } }
}

const ATM_W = 0.75
const ATM_D = 0.76
const TAOBIN_W = 1.0
const TAOBIN_D = 0.92

const designs: Record<RoomModel, Design> = {
  // Krungsri ATM: yellow cabinet, taller dark header, sloped screen, keypad shelf and cash slot. No logo, no text.
  'atm-krungsri': {
    width: ATM_W,
    depth: ATM_D,
    height: KIOSK_HEIGHT['atm-krungsri'],
    build(b) {
      const w = ATM_W / 2
      const YEL = '#FFC72C'
      b.box(-w, w, 0, 0.7, 0, 1.0, YEL, true) // lower cabinet
      b.box(-w, w, 0, 0.62, 1.0, 1.35, YEL, true) // upper body
      b.prism(-w, w, [[0.62, 1.0], [0.7, 1.0], [0.62, 1.35]], YEL) // sloped fascia
      // Screen: a thin slab lying on the slope (slope runs from (0.7, 1.0) up to (0.62, 1.35)).
      const P = (t: number): [number, number] => [0.7 - 0.08 * t, 1.0 + 0.35 * t]
      const n = [0.35, 0.08].map((v) => v / Math.hypot(0.35, 0.08)) as [number, number]
      const lift = (p: [number, number], k: number): [number, number] => [p[0] + n[0] * k, p[1] + n[1] * k]
      b.prism(-0.27, 0.27, [P(0.1), P(0.9), lift(P(0.9), 0.014), lift(P(0.1), 0.014)], '#4A4450') // bezel
      b.prism(-0.24, 0.24, [P(0.17), P(0.83), lift(P(0.83), 0.024), lift(P(0.17), 0.024)], '#2A2830') // screen
      b.box(-0.22, 0.22, 0.7, 0.76, 0.9, 0.95, '#D3CFCB') // keypad shelf
      b.box(-0.17, 0.17, 0.7, 0.714, 0.8, 0.88, '#8E8A86') // keypad
      b.box(-0.2, 0.2, 0.7, 0.712, 0.62, 0.65, '#2A2830') // cash slot
      b.box(-w, w, 0, 0.62, 1.35, 1.9, '#5B4A40', true) // header
      return { logo: { a: 0, y: 1.625, w: 0.5, h: 0.46, d: 0.62, color: '#5B4A40' } }
    },
  },
  // Tao Bin drink kiosk: white cabinet, dark top band, portrait touch screen, cup window, pickup slot. No logo, no text.
  'kiosk-taobin': {
    width: TAOBIN_W,
    depth: TAOBIN_D,
    height: KIOSK_HEIGHT['kiosk-taobin'],
    build(b) {
      const w = 0.48
      b.box(-w, w, 0, 0.88, 0, 1.88, '#F7F5F2', true) // cabinet
      b.box(-0.5, -w, 0.05, 0.85, 0.1, 1.7, '#D9D6D2') // side panels
      b.box(w, 0.5, 0.05, 0.85, 0.1, 1.7, '#D9D6D2')
      b.box(-0.5, 0.5, 0, 0.92, 1.88, 1.95, '#E3DFDA', true) // roof cap
      b.box(-w - 0.005, w + 0.005, 0.88, 0.9, 1.45, 1.88, '#2B2421') // top band on the front
      b.box(-w, w, 0.88, 0.9, 0, 0.1, '#BDB8B3') // plinth
      // Portrait touch screen on the customer's left (a < 0)
      b.box(-0.41, -0.04, 0.88, 0.894, 0.83, 1.42, '#4A4448') // bezel
      b.box(-0.385, -0.035 - 0.0, 0.894, 0.906, 0.85, 1.4, '#2A2830') // screen 0.35 x 0.55
      // Cup display window, centre-right
      b.box(0.04, 0.44, 0.88, 0.894, 0.83, 1.47, '#8A7F76') // frame
      b.box(0.06, 0.42, 0.894, 0.902, 0.85, 1.45, '#E9DFD3') // pane
      for (const y of [1.0, 1.15, 1.3]) b.box(0.06, 0.42, 0.902, 0.91, y - 0.006, y + 0.006, '#B5A798') // grid lines
      b.box(0.235, 0.245, 0.902, 0.91, 0.85, 1.45, '#B5A798')
      b.box(0.05, 0.43, 0.88, 0.896, 0.5, 0.72, '#8A7F76') // pickup frame
      b.box(0.08, 0.4, 0.896, 0.905, 0.54, 0.68, '#2B2421') // pickup slot
      return { logo: { a: 0, y: 1.665, w: 0.6, h: 0.4, d: 0.9, color: '#2B2421' } }
    },
  },
}

const AXES: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** The axis direction closest to the way from the polygon centre to the door (default: north). */
export function frontDirection(polygon: Point[], door: Point | undefined): Point {
  if (!door) return [0, -1]
  const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length
  const cz = polygon.reduce((s, p) => s + p[1], 0) / polygon.length
  const v: Point = [door[0] - cx, door[1] - cz]
  return AXES.reduce((best, a) => (a[0] * v[0] + a[1] * v[1] > best[0] * v[0] + best[1] * v[1] ? a : best))
}

/** Builds one machine standing against the wall opposite the door, front towards the door. */
export function buildKiosk(model: RoomModel, polygon: Point[], door: Point | undefined): KioskModel {
  const design = designs[model]
  const f = frontDirection(polygon, door)
  const r: Point = [f[1], -f[0]] // the customer faces -f, so their right is (f.z, -f.x)
  const dots = (axis: Point) => polygon.map((p) => p[0] * axis[0] + p[1] * axis[1])
  const fMin = Math.min(...dots(f))
  const rs = dots(r)
  const rMid = (Math.min(...rs) + Math.max(...rs)) / 2
  const back = fMin + 0.02
  const frame: Frame = { o: [f[0] * back + r[0] * rMid, f[1] * back + r[1] * rMid], f, r }
  const b = new Builder(frame)
  const { logo } = design.build(b)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(b.col.slice(), 3))
  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const edgeSrc = new THREE.BufferGeometry()
  edgeSrc.setAttribute('position', new THREE.Float32BufferAttribute(b.edgePos, 3))
  const edges = new THREE.EdgesGeometry(edgeSrc, 25)
  edgeSrc.dispose()

  // The header's front face as its own quad, a hair in front of the header, with UVs ready for a texture.
  const d = logo.d + 0.004
  const quad = new THREE.BufferGeometry()
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sa, sy]) => b.world(logo.a + (sa! * logo.w) / 2, d, logo.y + (sy! * logo.h) / 2))
  quad.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3))
  quad.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  quad.setIndex([0, 1, 2, 0, 2, 3])
  const centre = b.world(logo.a, d, logo.y)

  const base = new Float32Array(b.col)
  return {
    geometry,
    edges,
    logo: { geometry: quad, color: new THREE.Color(logo.color), width: logo.w, height: logo.h, center: centre, normal: f },
    height: design.height,
    front: f,
    bbox: { minX: bb.min.x, maxX: bb.max.x, minZ: bb.min.z, maxZ: bb.max.z },
    triangles: b.pos.length / 9,
    base,
    dimmed: new Float32Array(b.dimCol),
  }
}

/** Blends the vertex colours from their normal look (0) to the dimmed look (1). */
export function setKioskDim(k: KioskModel, t: number): void {
  const attr = k.geometry.getAttribute('color') as THREE.BufferAttribute
  const out = attr.array as Float32Array
  for (let i = 0; i < out.length; i++) out[i] = k.base[i]! + (k.dimmed[i]! - k.base[i]!) * t
  attr.needsUpdate = true
}
