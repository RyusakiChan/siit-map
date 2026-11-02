// One-off: builds the real floor 5 from the 2017 plan poster (20261102_121106.jpg) and the 2026 walk-through photos
// and saves it through the trace tool's save code. Run:  node scripts/trace/run.mjs floor5 [--write]
// Plan pixels are the 2000 x 1500 preview of the photo. The plan draws only part of the building: the dark grey L is
// the roof over the lower floors and is not drawn as rooms; the white square is the atrium (floor 3 and 4's voids).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, makeHomography, type Fit, type Plan, type RoomSpec } from './lib'
import type { BuildingData, Point } from '../../src/data/types'

export const outline: Point[] = [[-39.02, -29.96], [13.02, -30.01], [32.56, -29.96], [32.47, 0.37], [32.39, 32.23], [25.57, 32.22], [20.88, 32.21], [12.85, 32.19], [-10.93, 30.95], [-31.39, 31.33], [-31.6, 22.09], [-39.01, 22.1], [-39.01, 18.75]]

// Same four-corner fit as floors 2-4: the plan's outer corners -> the outline's bounding corners (top of the poster is north).
export const alignment = {
  px: [[418, 470], [1222, 478], [1224, 1180], [414, 1190]] as Point[],
  metres: [[-39.02, -29.96], [32.56, -29.96], [32.39, 32.23], [-39.02, 30.8]] as Point[],
}
const hom = makeHomography(alignment.px, alignment.metres)
// The plan is not to scale across the width (the south row and the stair boxes are drawn wider or narrower than floors 3-4,
// the stair core near the lifts lands up to 4.7 m off a plain projective fit). So x goes through a piecewise-linear map whose
// breakpoints are read off floor 4's real x positions of the same structures (the stair and restroom block, the east column's
// west wall, the outline); z comes from the projective fit.
const xMap: [number, number][] = [[414, -39.02], [625, -15.8], [640, -14.6], [715, -8.6], [722, -7.9], [925, 8.4], [1045, 15.8], [1222, 32.4], [1226, 32.56]]
const mapX = (px: number): number => {
  const i = Math.min(Math.max(xMap.findIndex(([p]) => p >= px) - 1, 0), xMap.length - 2)
  const [p0, m0] = xMap[i]!, [p1, m1] = xMap[i + 1]!
  return m0 + ((px - p0) / (p1 - p0)) * (m1 - m0)
}
export const fit: Fit = { m: [0, 0, 0, 0, 0, 0], to: (p) => [mapX(p[0]), hom.to(p)[1]] }

const bd = (): BuildingData => JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/building.json'), 'utf8')) as BuildingData
const f4poly = (id: string): Point[] => bd().rooms.find((r) => r.id === id)!.polygon
const f4voids = (): Point[][] => bd().floors.find((f) => f.level === 4)!.voids!

const none = { departmentId: null as string | null }
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const classroom = (n: string, name: string, nameTh: string, px: Point[], door: Point): RoomSpec => ({
  ...none, id: `f5-${n}`, number: n, name, nameTh, type: 'classroom', px, door,
})
const rs = (id: string, px: Point[], door: Point, link?: Point): RoomSpec => ({
  ...none, id, number: null, name: 'Restrooms', nameTh: 'ห้องน้ำ', type: 'restroom', px, door, ...(link ? { link } : {}),
})

export const rooms: RoomSpec[] = [
  // East column, top to bottom (names from the photos: 1-501 and 1-504 classrooms, 1-502 and 1-503 auditoriums).
  classroom('1-501', 'Classroom', 'ห้องเรียน', rect(1048, 582, 1222, 705), [1048, 645]),
  classroom('1-502', 'Auditorium', 'ห้องประชุมใหญ่', rect(1048, 707, 1222, 850), [1048, 778]),
  classroom('1-503', 'Auditorium', 'ห้องประชุมใหญ่', rect(1048, 852, 1222, 1000), [1048, 925]),
  classroom('1-504', 'Classroom', 'ห้องเรียน', rect(1048, 1002, 1222, 1177), [1048, 1090]),
  // South row.
  classroom('1-507', 'Room 1-507', 'ห้องเรียน', rect(415, 1027, 625, 1187), [520, 1027]),
  classroom('1-506', 'Room 1-506', 'ห้องเรียน', rect(722, 1022, 925, 1182), [820, 1022]),
  { ...none, id: 'f5-1-505', number: '1-505', name: 'Room 1-505', type: 'other', px: rect(935, 1020, 1013, 1082), door: [974, 1020] },
  rs('f5-restroom-top', rect(962, 482, 1105, 538), [1030, 538]),
  rs('f5-restroom-bottom', rect(648, 1105, 718, 1165), [648, 1135], [632, 1135]),
  // Shafts: polygons are floor 4's rooms (same x,z on every floor); the plan only says where on this floor.
  { ...none, id: 'f5-stairs-top-right', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(1135, 495, 1222, 565), metres: f4poly('f4-stairs-top-right'), door: [1180, 565] },
  { ...none, id: 'f5-stairs-bottom', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(640, 1010, 715, 1085), metres: f4poly('f4-stairs-bottom'), door: [678, 1010] },
  { ...none, id: 'f5-lifts', number: null, name: 'Lifts', nameTh: 'ลิฟต์', type: 'elevator', px: rect(660, 905, 755, 960), metres: f4poly('f4-lifts'), door: [707, 960] },
]

export const plan: Plan = {
  floor: 5,
  fit,
  outline,
  gap: 0.25,
  voidsPx: [],
  voidsMetres: f4voids(), // the atrium is the same open square as floors 3 and 4
  rooms,
  corridorNodesPx: {
    tt: [1025, 560], tr: [1180, 560], nc: [1025, 1000], sww: [450, 1000], bw: [632, 1000], bs: [632, 1135], e1: [1025, 1160], bm: [850, 1000],
  },
  corridorEdges: [['tt', 'tr'], ['tt', 'nc'], ['nc', 'e1'], ['nc', 'bm'], ['bm', 'bw'], ['bw', 'sww'], ['bw', 'bs']],
}

export const built = () => build(plan)

export const connectorRooms = { lift: 'f5-lifts', 'stairs-e': 'f5-stairs-top-right', 'stairs-s': 'f5-stairs-bottom' }
