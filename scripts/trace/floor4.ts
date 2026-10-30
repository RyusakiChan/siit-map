// One-off: builds the real floor 4 from the 2017 plan poster (+ 2026 on-site photos) and saves it
// through the trace tool's save code. Run:  node scripts/trace/run.mjs floor4 [--write]
// All numbers below were measured on a crop of 20261030_122017.jpg (4000 × 3000) that starts at (700, 980),
// 1700 px wide and shown 1800 px wide, so D() turns a measured crop position into original poster pixels.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, makeHomography, type Plan, type RoomSpec } from './lib'
import type { Amenity, BuildingData, Department, Point } from '../../src/data/types'

const K = 1700 / 1800
const D = (x: number, y: number): Point => [Math.round(700 + x * K), Math.round(980 + y * K)]
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [D(x0, y0), D(x1, y0), D(x1, y1), D(x0, y1)]
const poly = (...pts: [number, number][]): Point[] => pts.map(([x, y]) => D(x, y))

export const outline: Point[] = [[-39.02, -29.96], [13.02, -30.01], [32.56, -29.96], [32.47, 0.37], [32.39, 32.23], [25.57, 32.22], [20.88, 32.21], [12.85, 32.19], [-10.93, 30.95], [-31.39, 31.33], [-31.6, 22.09], [-39.01, 22.1], [-39.01, 18.75]]

// Alignment: the plan's four outer corners -> the outline's bounding corners, as for floors 2 and 3
// (top of the poster is north); the fourth corner makes the fit projective.
export const alignment = {
  px: [D(100, 62), D(1710, 58), D(1730, 1320), D(70, 1335)] as Point[],
  metres: [[-39.02, -29.96], [32.56, -29.96], [32.39, 32.23], [-39.02, 30.8]] as Point[],
}
export const fit = makeHomography(alignment.px, alignment.metres)

const bd = (): BuildingData => JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/building.json'), 'utf8')) as BuildingData
const f3poly = (id: string): Point[] => bd().rooms.find((r) => r.id === id)!.polygon
const f3voids = (): Point[][] => bd().floors.find((f) => f.level === 3)!.voids!

export const departments: Department[] = [
  {
    id: 'd-bcet', name: 'School of Bio-Chemical Engineering and Technology', letter: 'BC', colorSlot: 5, aliases: ['BCET', 'Chemical Engineering'],
    summary: 'Teaches chemical engineering with a biology angle: how plants turn raw materials into products through chemical, physical and biological processes. Offers an international Bachelor of Engineering in Chemical Engineering.',
    url: 'https://www.siit.tu.ac.th/about/schools/bcet',
  },
  {
    id: 'd-msme', name: 'School of Management Technology and Mechanical Engineering', letter: 'MS', colorSlot: 6,
    aliases: ['MSME', 'School of MSME', 'School of Manufacturing Systems and Mechanical Engineering', 'Manufacturing Systems and Mechanical Engineering', 'Industrial Engineering', 'Logistics and Supply Chain', 'Systems Engineering', 'Mechanical Engineering'],
    summary: 'Runs two international bachelor’s programs: Industrial Engineering and Smart Logistics, on improving manufacturing and service systems and their supply chains, and Mechanical Engineering, on machines and moving systems in industry.',
    url: 'https://www.siit.tu.ac.th/about/schools/msme',
  },
]

const none = { departmentId: null as string | null }
const classroom = (n: string, px: Point[], door: Point): RoomSpec => ({
  ...none, id: `f4-${n}`, number: n, name: 'Classroom', nameTh: 'ห้องเรียน', type: 'classroom', px, door,
})
const rs = (id: string, px: Point[], door: Point, link?: Point): RoomSpec => ({
  ...none, id, number: null, name: 'Restrooms', nameTh: 'ห้องน้ำ', type: 'restroom', px, door, ...(link ? { link } : {}),
})

export const rooms: RoomSpec[] = [
  classroom('1-409', poly([100, 62], [385, 62], [383, 268], [100, 270]), D(385, 165)),
  classroom('1-408', poly([97, 282], [382, 282], [380, 500], [95, 503]), D(382, 390)),
  classroom('1-407', poly([93, 515], [378, 515], [375, 738], [87, 740]), D(376, 627)),
  classroom('1-406', poly([87, 750], [373, 750], [370, 955], [80, 958]), D(371, 852)),
  classroom('1-405', poly([78, 970], [218, 970], [215, 1148], [75, 1150]), D(217, 1060)),
  classroom('1-410', poly([462, 62], [726, 62], [724, 338], [458, 340]), D(591, 339)),
  classroom('1-411', poly([740, 62], [1000, 62], [1000, 338], [738, 338]), D(869, 338)),
  classroom('1-404', poly([258, 1040], [445, 1040], [440, 1335], [256, 1335]), D(351, 1040)),
  classroom('1-403', poly([460, 1038], [635, 1038], [630, 1330], [455, 1332]), D(547, 1038)),
  classroom('1-402', poly([815, 1035], [1000, 1033], [998, 1325], [813, 1328]), D(906, 1034)),
  classroom('1-401', poly([1012, 1032], [1180, 1030], [1182, 1322], [1010, 1325]), D(1096, 1031)),
  { ...none, id: 'f4-1-417', number: '1-417', name: 'Copy Center', nameTh: 'ศูนย์ถ่ายเอกสาร', type: 'other', px: rect(1195, 1030, 1248, 1118), door: D(1221, 1030) },
  { ...none, id: 'f4-1-416', number: '1-416', name: 'Meeting Room', nameTh: 'ห้องประชุม', type: 'conferenceroom', px: rect(1245, 1133, 1340, 1320), door: D(1292, 1133), link: D(1265, 1120) },
  // Right column: BCET office, the shared BCET/MSME office (plate "1-414 BCET/MSME OFFICE"), the MSME office.
  { ...none, id: 'f4-1-413', number: '1-413', name: 'BCET Office', type: 'office', departmentId: 'd-bcet', px: poly([1340, 205], [1712, 205], [1712, 536], [1345, 536]), door: D(1343, 368) },
  { id: 'f4-1-414', number: '1-414', name: 'BCET/MSME Office', type: 'office', departmentId: null, departmentIds: ['d-bcet', 'd-msme'], px: poly([1345, 546], [1712, 546], [1714, 845], [1347, 845]), door: D(1346, 695) },
  { ...none, id: 'f4-1-415', number: '1-415', name: 'MSME Office', type: 'office', departmentId: 'd-msme', px: poly([1347, 858], [1714, 858], [1727, 1315], [1352, 1315]), door: D(1349, 1085) },
  rs('f4-restroom-top-mid', rect(1008, 65, 1180, 210), D(1180, 140)),
  rs('f4-restroom-top-right', rect(1240, 65, 1445, 148), D(1342, 148)),
  rs('f4-restroom-bottom', rect(640, 1180, 802, 1330), D(690, 1180), D(647, 1163)),
  // Shafts: polygons are floor 3's rooms (same x,z on every floor); the poster only says where on this floor.
  { ...none, id: 'f4-stairs-top-mid', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(1030, 242, 1147, 357), metres: f3poly('f3-stairs-top-mid'), door: D(1147, 300) },
  { ...none, id: 'f4-stairs-top-right', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(1605, 58, 1708, 148), metres: f3poly('f3-stairs-top-right'), door: D(1605, 100) },
  { ...none, id: 'f4-stairs-bottom', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(658, 1030, 802, 1148), metres: f3poly('f3-stairs-bottom'), door: D(730, 1030) },
  { ...none, id: 'f4-lifts', number: null, name: 'Lifts', nameTh: 'ลิฟต์', type: 'elevator', px: rect(657, 838, 798, 920), metres: f3poly('f3-lifts'), door: D(728, 920) },
]

export const plan: Plan = {
  floor: 4,
  fit,
  outline,
  gap: 0.25,
  voidsPx: [],
  voidsMetres: f3voids(), // the atrium is the same open square as floor 3's
  rooms,
  corridorNodesPx: {
    wt: D(425, 120), nw: D(425, 375), ne: D(1265, 375), se: D(1265, 990), sw: D(425, 990), e2: D(1265, 1120),
    sww: D(235, 990), bw: D(647, 990), bs: D(647, 1163),
    tl: D(1265, 175), tm: D(1200, 175), tr: D(1560, 175),
  },
  corridorEdges: [
    ['wt', 'nw'], ['nw', 'ne'], ['nw', 'sw'], ['ne', 'se'], ['sw', 'bw'], ['bw', 'se'], ['se', 'e2'], ['sw', 'sww'], ['bw', 'bs'],
    ['ne', 'tl'], ['tm', 'tl'], ['tl', 'tr'],
  ],
}

export const built = () => build(plan)

/** A "Prayer Room" sign is on a door by the top-middle restrooms (photo IMG_2753); the poster does not show the room. */
export const amenities = (b: ReturnType<typeof build>): Amenity[] => {
  const r = b.rooms.find((x) => x.id === 'f4-restroom-top-mid')!
  const d = b.nodes.find((n) => n.id === r.door)!
  return [{ id: 'f4-prayer-top-mid', floor: 4, position: [Math.round((d.position[0] + 0.5) * 100) / 100, Math.round((d.position[1] + 1.5) * 100) / 100], type: 'prayerroom' }]
}

export const connectorRooms = { lift: 'f4-lifts', 'stairs-e': 'f4-stairs-top-right', 'stairs-w': 'f4-stairs-top-mid', 'stairs-s': 'f4-stairs-bottom' }
