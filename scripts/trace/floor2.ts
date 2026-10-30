// One-off: builds the real floor 2 from the 2017 plan poster (+ 2026 on-site photos) and saves it
// through the trace tool's save code. Run:  node scripts/trace/run.mjs floor2 [--write]
// All numbers below were measured on a crop of IMG_2546.jpg (4284 × 5712) that starts at (286, 2256) and was
// shown at 0.7686 of its size, so D() turns a measured crop position into original poster pixels.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, makeHomography, type Plan, type RoomSpec } from './lib'
import type { Amenity, BuildingData, Point, QrPoint } from '../../src/data/types'

const D = (x: number, y: number): Point => [Math.round(286 + x / 0.7686), Math.round(2256 + y / 0.7686)]
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [D(x0, y0), D(x1, y0), D(x1, y1), D(x0, y1)]
const poly = (...pts: [number, number][]): Point[] => pts.map(([x, y]) => D(x, y))

// Same outline as floor 3 (OSM way 195958489, trimmed to the walls the plans show).
export const outline: Point[] = [[-39.02, -29.96], [13.02, -30.01], [32.56, -29.96], [32.47, 0.37], [32.39, 32.23], [25.57, 32.22], [20.88, 32.21], [12.85, 32.19], [-10.93, 30.95], [-31.39, 31.33], [-31.6, 22.09], [-39.01, 22.1], [-39.01, 18.75]]

// Alignment: the plan's four outer corners -> the outline's bounding corners, exactly as for floor 3
// (top of the poster is north). Top-left, top-right, bottom-right are the brief's three points; the fourth
// makes the fit projective.
export const alignment = {
  px: [D(55, 65), D(1725, 62), D(1730, 1357), D(80, 1367)] as Point[],
  metres: [[-39.02, -29.96], [32.56, -29.96], [32.39, 32.23], [-39.02, 30.8]] as Point[],
}
export const fit = makeHomography(alignment.px, alignment.metres)

const f3 = (): BuildingData => JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/building.json'), 'utf8')) as BuildingData
const f3poly = (id: string): Point[] => f3().rooms.find((r) => r.id === id)!.polygon

const none = { departmentId: null as string | null }
const rs = (id: string, name: string, nameTh: string, px: Point[], door: Point, link?: Point): RoomSpec => ({
  ...none, id, number: null, name, nameTh, type: 'restroom', px, door, ...(link ? { link } : {}),
})

export const rooms: RoomSpec[] = [
  // The library fills the whole west side. Its 2017 poster shows an interior stair; rooms cannot overlap and
  // there are no holes, so that stair is not a room (see the report).
  { ...none, id: 'f2-library', number: null, name: 'SIIT Library', nameTh: 'ห้องสมุด', type: 'library', px: poly([55, 65], [978, 65], [978, 145], [805, 145], [805, 630], [618, 630], [618, 1185], [530, 1185], [530, 1365], [80, 1365]), door: D(805, 560) },
  { ...none, id: 'f2-1-208', number: '1-208', name: 'International Affairs and Corporate Relations', aliases: ['International and Career'], type: 'office', px: poly([808, 145], [980, 145], [980, 345], [938, 345], [938, 460], [808, 460]), door: D(870, 460) },
  { ...none, id: 'f2-1-207', number: '1-207', name: 'Document Room', nameTh: 'ห้องเก็บเอกสาร', type: 'other', px: poly([628, 640], [805, 640], [805, 742], [725, 742], [725, 812], [628, 812]), door: D(805, 690) },
  { ...none, id: 'f2-1-206', number: '1-206', name: 'Conference Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: rect(860, 515, 1185, 797), door: D(860, 650) },
  { ...none, id: 'f2-1-203', number: '1-203', name: 'Meeting Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: poly([862, 805], [990, 805], [990, 980], [870, 980]), door: D(862, 890) },
  { ...none, id: 'f2-1-204', number: '1-204', name: 'Meeting Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: rect(998, 805, 1070, 980), door: D(1034, 980) },
  { ...none, id: 'f2-1-205', number: '1-205', name: 'Meeting Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: rect(1078, 805, 1182, 980), door: D(1182, 890) },
  { ...none, id: 'f2-1-202', number: '1-202', name: 'Faculty and Staff Lounge', nameTh: 'ห้องพักอาจารย์และเจ้าหน้าที่', type: 'other', px: poly([808, 1075], [898, 1075], [898, 1040], [1182, 1040], [1182, 1362], [898, 1362], [898, 1170], [808, 1170]), door: D(1040, 1040) },
  // Right column: one open hall of service counters (photos 2547-2558). Divisions are not departments.
  {
    ...none, id: 'f2-1-210', number: '1-210', name: 'Research and QA, Student Affairs and Alumni, Supplies and Procurement',
    aliases: ['Research and Academic Quality Assurance', 'Student Affairs and Alumni Relations', 'Supplies and Procurement', 'R&QA', 'R&OA', 'SA&AR', 'SP'],
    type: 'office', px: poly([1235, 215], [1725, 205], [1725, 512], [1235, 512]), door: D(1235, 360),
  },
  {
    ...none, id: 'f2-1-211', number: '1-211', name: 'Academic Services and Registration, Finance and Budget',
    aliases: ['AS&R', 'FIN', 'Academic Services and Registration Division', 'Finance and Budget Division'],
    type: 'office', px: rect(1235, 520, 1725, 772), door: D(1235, 650),
  },
  {
    ...none, id: 'f2-1-212', number: '1-212', name: 'Central Coordinating and Accounting',
    aliases: ['CCo', 'Acc', 'Central Coordinating Division', 'Accounting Division'],
    type: 'office', px: rect(1235, 782, 1725, 1038), door: D(1235, 910),
  },
  { ...none, id: 'f2-1-213', number: '1-213', name: 'Office of the Director', type: 'office', px: rect(1235, 1050, 1725, 1355), door: D(1235, 1200) },
  rs('f2-restroom-top-mid', 'Restrooms', 'ห้องน้ำ', rect(985, 70, 1165, 230), D(1165, 150)),
  rs('f2-restroom-top-right', 'Restrooms', 'ห้องน้ำ', rect(1235, 65, 1490, 150), D(1360, 150)),
  rs('f2-restroom-mid-left', 'Restrooms', 'ห้องน้ำ', poly([658, 828], [725, 828], [725, 757], [810, 757], [810, 868], [658, 868]), D(810, 810)),
  // Shafts: polygons are floor 3's rooms (same x,z on every floor), the poster only says where on this floor.
  { ...none, id: 'f2-stairs-top-mid', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(1012, 246, 1140, 372), metres: f3poly('f3-stairs-top-mid'), door: D(1140, 310) },
  { ...none, id: 'f2-stairs-top-right', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(1585, 62, 1712, 182), metres: f3poly('f3-stairs-top-right'), door: D(1585, 120), link: D(1550, 180) },
  { ...none, id: 'f2-stairs-bottom', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(633, 1040, 795, 1175), metres: f3poly('f3-stairs-bottom'), door: D(795, 1100) },
  { ...none, id: 'f2-lifts', number: null, name: 'Lifts', nameTh: 'ลิฟต์', type: 'elevator', px: rect(650, 897, 770, 965), metres: f3poly('f3-lifts'), door: D(770, 930) },
]

export const plan: Plan = {
  floor: 2,
  fit,
  outline,
  gap: 0.25,
  voidsPx: [], // no atrium on floor 2: the conference block fills the middle
  rooms,
  corridorNodesPx: {
    nw: D(835, 487), ne: D(1210, 487), top: D(1210, 180), topr: D(1530, 180),
    se: D(1210, 1015), sw: D(835, 1015), w: D(640, 1015), wm: D(640, 900), e: D(1210, 1170),
  },
  corridorEdges: [['nw', 'ne'], ['ne', 'top'], ['top', 'topr'], ['ne', 'se'], ['se', 'e'], ['se', 'sw'], ['sw', 'nw'], ['sw', 'w'], ['w', 'wm']],
}

export const built = () => build(plan)

/** The old sample QR spot stays (QR ids never change); it moves onto the real lift's door. */
export const qrPoints = (b: ReturnType<typeof build>): QrPoint[] => {
  const door = b.nodes.find((n) => n.id === b.rooms.find((r) => r.id === 'f2-lifts')!.door)!
  return [{ id: 'sample-f2-lift', floor: 2, position: door.position, facingDeg: 180 }]
}

/** No amenity is visible in the floor-2 photos or poster; the two sample ones are removed (their ids retire). */
export const amenities: Amenity[] = []

export const connectorRooms = { lift: 'f2-lifts', 'stairs-e': 'f2-stairs-top-right', 'stairs-w': 'f2-stairs-top-mid' }
