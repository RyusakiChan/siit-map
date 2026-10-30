// One-off: builds the real floor 3 from the 2017 plan poster (+ 2026 on-site photos) and saves it
// through the trace tool's save code. Run:  node scripts/trace/run.mjs floor3 [--write]
import { build, makeFit, makeHomography, splitQuad, type Plan, type RoomSpec } from './lib'
import type { Amenity, Department, Point } from '../../src/data/types'

// Poster pixels (4000 × 3000 original). All numbers below were measured on a crop that starts at (700, 820).
const P = (x: number, y: number): Point => [x + 700, y + 820]
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]

export const outline: Point[] = [[-39.02, -29.96], [13.02, -30.01], [32.56, -29.96], [32.47, 0.37], [32.39, 32.23], [25.57, 32.22], [20.88, 32.21], [12.85, 32.19], [-10.93, 30.95], [-31.39, 31.33], [-31.6, 22.09], [-39.01, 22.1], [-39.01, 18.75]]

// Alignment: poster building-block corners -> OSM outline. The brief's three points (top-left, top-right,
// bottom-right) are kept; the poster is photographed at an angle, so a fourth corner (bottom-left, measured
// on the poster, mapped to the outline's south edge) makes the fit projective instead of affine.
export const alignment = {
  px: [P(75, 52), P(1825, 95), P(1828, 1438), P(45, 1455)] as Point[],
  metres: [[-39.02, -29.96], [32.56, -29.96], [32.39, 32.23], [-39.02, 30.8]] as Point[],
}
export const fit = makeHomography(alignment.px, alignment.metres)
export const affineFit = makeFit(alignment.px.slice(0, 3) as [Point, Point, Point], alignment.metres.slice(0, 3) as [Point, Point, Point])

export const departments: Department[] = [
  {
    id: 'd-cet', name: 'School of Civil Engineering and Technology', letter: 'CE', colorSlot: 3, aliases: ['CET', 'Civil Engineering'],
    summary: 'One of SIIT’s founding schools. It teaches civil engineering, with study areas in structures, concrete and materials, soil and foundations, water resources, transport and construction management.',
    url: 'https://www.siit.tu.ac.th/about/schools/cet',
  },
  {
    id: 'd-cgs', name: 'School of Integrated Science and Innovation', letter: 'IS', colorSlot: 4,
    aliases: ['ISI', 'CGS', 'Department of Common and Graduate Studies', 'Common and Graduate Studies'],
    summary: 'Brings mathematics, science and cross-subject innovation together, including dual-degree options and research tracks. The 2017 plan and some door plates still call it the Department of Common and Graduate Studies (CGS).',
    url: 'https://www.siit.tu.ac.th/about/schools/isi',
  },
]

const grad = splitQuad([P(75, 52), P(697, 71), P(697, 397), P(68, 383)], 4) // 1-308 .. 1-311, split is approximate
const cls = splitQuad([P(710, 72), P(1065, 80), P(1065, 405), P(710, 400)], 2) // 1-312, 1-313, split is approximate
const southMid = (poly: Point[]): Point => mid(poly[3]!, poly[2]!)

const common = { departmentId: null as string | null }
const lab = (id: string, number: string, px: Point[], door: Point): RoomSpec => ({
  ...common, id, number, name: 'Computer Lab', nameTh: 'ห้องปฏิบัติการคอมพิวเตอร์', type: 'laboratory', px, door,
})
const gradRoom = (i: number, number: string): RoomSpec => ({
  ...common, id: `f3-${number}`, number, name: 'Graduate Room', nameTh: 'ห้องนักศึกษาบัณฑิต', type: 'other', px: grad[i]!, door: southMid(grad[i]!),
})
const classroom = (i: number, number: string): RoomSpec => ({
  ...common, id: `f3-${number}`, number, name: 'Classroom', nameTh: 'ห้องเรียน', type: 'classroom', px: cls[i]!, door: southMid(cls[i]!),
})
const restroom = (id: string, px: Point[], door: Point, link?: Point): RoomSpec => ({ ...common, id, number: null, name: 'Restrooms', nameTh: 'ห้องน้ำ', type: 'restroom', px, door, ...(link ? { link } : {}) })
const stairs = (id: string, px: Point[], door: Point, link?: Point): RoomSpec => ({ ...common, id, number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px, door, ...(link ? { link } : {}) })

export const rooms: RoomSpec[] = [
  { ...common, id: 'f3-1-301', number: '1-301', name: 'Computer Lab', nameTh: 'ห้องปฏิบัติการคอมพิวเตอร์', type: 'laboratory', photo: 'photos/1-301-entrance.webp', px: [P(857, 1135), P(1252, 1130), P(1252, 1445), P(855, 1447)], door: P(1054, 1133) },
  { ...common, id: 'f3-1-302', number: '1-302', name: 'Computer and Audiovisual Center', type: 'office', px: [P(478, 1112), P(660, 1108), P(658, 1385), P(478, 1388)], door: P(569, 1110) },
  { ...common, id: 'f3-1-303', number: '1-303', name: 'Virtual Computer Lab', nameTh: 'ห้องปฏิบัติการคอมพิวเตอร์เสมือน', type: 'laboratory', px: [P(343, 1105), P(462, 1105), P(462, 1390), P(655, 1390), P(655, 1450), P(343, 1450)], door: P(402, 1105) },
  lab('f3-1-304', '1-304', [P(57, 1000), P(410, 1000), P(410, 1092), P(338, 1100), P(330, 1452), P(45, 1452)], P(410, 1050)),
  lab('f3-1-305', '1-305', [P(68, 768), P(410, 768), P(410, 1000), P(57, 1000)], P(410, 880)),
  { ...common, id: 'f3-1-306-307', number: '1-306/1-307', name: 'Graduate Room', nameTh: 'ห้องนักศึกษาบัณฑิต', aliases: ['1-306', '1-307'], type: 'other', px: [P(68, 453), P(412, 457), P(410, 750), P(70, 748)], door: P(412, 600) },
  { ...common, id: 'f3-1-308', number: '1-308', name: 'Copy Center', nameTh: 'ศูนย์ถ่ายเอกสาร', type: 'other', px: grad[0]!, door: southMid(grad[0]!) },
  gradRoom(1, '1-309'),
  gradRoom(2, '1-310'),
  gradRoom(3, '1-311'),
  classroom(0, '1-312'),
  classroom(1, '1-313'),
  { ...common, id: 'f3-1-315', number: '1-315', name: 'CET Office', type: 'office', departmentId: 'd-cet', px: [P(1437, 235), P(1822, 238), P(1822, 658), P(1437, 660)], door: P(1437, 445) },
  { id: 'f3-1-316', number: '1-316', name: 'CET/CGS Office', aliases: ['CET/ISI Office'], type: 'office', departmentId: null, departmentIds: ['d-cet', 'd-cgs'], px: [P(1437, 672), P(1822, 672), P(1822, 938), P(1437, 940)], door: P(1437, 806) },
  { ...common, id: 'f3-1-317', number: '1-317', name: 'CGS Office', aliases: ['ISI Office'], type: 'office', departmentId: 'd-cgs', px: [P(1437, 952), P(1822, 952), P(1828, 1438), P(1437, 1438)], door: P(1437, 1195) },
  { ...common, id: 'f3-1-318', number: '1-318', name: 'Meeting Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: rect(1318, 1243, 1422, 1440), door: P(1370, 1243) },
  { ...common, id: 'f3-1-319', number: '1-319', name: 'Room 1-319', type: 'other', px: rect(1265, 1135, 1325, 1228), door: P(1325, 1182) },
  restroom('f3-restroom-top-mid', rect(1077, 80, 1255, 245), P(1166, 245), P(1350, 255)),
  restroom('f3-restroom-top-right', rect(1338, 92, 1518, 185), P(1428, 185)),
  restroom('f3-restroom-bottom', rect(660, 1285, 856, 1448), P(841, 1285), P(841, 1275)),
  stairs('f3-stairs-top-mid', rect(1100, 285, 1240, 422), P(1170, 422)),
  stairs('f3-stairs-top-right', rect(1688, 95, 1825, 228), P(1688, 160)),
  stairs('f3-stairs-bottom', rect(682, 1118, 826, 1265), P(826, 1190), P(841, 1190)),
  { ...common, id: 'f3-lifts', number: null, name: 'Lifts', nameTh: 'ลิฟต์', type: 'elevator', px: rect(692, 918, 843, 1005), door: P(768, 1005) },
]

export const plan: Plan = {
  floor: 3,
  fit,
  outline,
  gap: 0.25,
  // Open atrium: the white-railed square, going round the lift block on its south edge.
  voidsPx: [[P(545, 485), P(1235, 485), P(1235, 1030), P(905, 1030), P(905, 968), P(856, 968), P(856, 908), P(679, 908), P(679, 968), P(625, 968), P(625, 1030), P(545, 1030)]],
  rooms,
  corridorNodesPx: {
    nw0: P(95, 432), nw: P(468, 440), ne: P(1350, 440), se: P(1350, 1078), se2: P(1350, 1237), sw: P(468, 1078),
    spa: P(841, 1078), spb: P(841, 1275), e: P(1350, 208), f: P(1650, 208),
  },
  corridorEdges: [['nw0', 'nw'], ['nw', 'ne'], ['ne', 'se'], ['se', 'se2'], ['sw', 'spa'], ['spa', 'se'], ['spa', 'spb'], ['nw', 'sw'], ['ne', 'e'], ['e', 'f']],
}

export const built = () => build(plan)

/** The prayer-room sign hangs by the 1-308 door (photo IMG_2764 etc.): a pin just inside that door. */
export const amenities = (b: ReturnType<typeof build>): Amenity[] => {
  const r = b.rooms.find((x) => x.id === 'f3-1-308')!
  const d = b.nodes.find((n) => n.id === r.door)!
  const cx = r.polygon.reduce((s, p) => s + p[0], 0) / r.polygon.length
  const cz = r.polygon.reduce((s, p) => s + p[1], 0) / r.polygon.length
  const k = 0.6 / Math.hypot(cx - d.position[0], cz - d.position[1])
  return [{ id: 'f3-prayer-1-308', floor: 3, position: [Math.round((d.position[0] + (cx - d.position[0]) * Math.min(1, k * 1)) * 100) / 100, Math.round((d.position[1] + (cz - d.position[1]) * Math.min(1, k * 1)) * 100) / 100], type: 'prayerroom' }]
}

/** Shafts: which room of the right type each connector uses on this floor. */
export const connectorRooms = { lift: 'f3-lifts', 'stairs-e': 'f3-stairs-top-right', 'stairs-w': 'f3-stairs-top-mid' }
