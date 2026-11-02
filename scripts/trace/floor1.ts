// One-off: builds the real floor 1 from the TU100 SEC 5 "Assembly Point" plan (a schematic, not to scale; only the
// layout is read from it) and the two First Aid Room photos, and saves it through the trace tool's save code.
// Run:  node scripts/trace/run.mjs floor1 [--write]
// Plan pixels are the 2000 x 1500 preview of assembly-point-map-tu100-sec5.webp.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, type Fit, type Plan, type RoomSpec } from './lib'
import type { BuildingData, Point, QrPoint } from '../../src/data/types'

// Same outline as floors 2-4 (OSM way 195958489).
export const outline: Point[] = [[-39.02, -29.96], [13.02, -30.01], [32.56, -29.96], [32.47, 0.37], [32.39, 32.23], [25.57, 32.22], [20.88, 32.21], [12.85, 32.19], [-10.93, 30.95], [-31.39, 31.33], [-31.6, 22.09], [-39.01, 22.1], [-39.01, 18.75]]

// Fit: up on the plan is north, as on floors 2-4. X: the lifts' centre (plan x 843) is floor 2's lift centre x -11.45 and
// the library's west wall (plan x 535) lands on the outline's west wall (-39.0), which gives 11.2 px/m. Z: the lifts'
// centre (plan y 904) is z 10.0 and the cafe row's north wall (plan y 570) lands on the outline's north wall (-30.0),
// which gives 8.35 px/m. The plan is schematic, so the two scales differ.
export const alignment = { sx: 11.2, sz: 8.35, lift: [843, 904] as Point, liftM: [-11.45, 10.0] as Point }
export const fit: Fit = {
  m: [0, 0, 0, 0, 0, 0],
  to: ([x, y]) => [alignment.liftM[0] + (x - alignment.lift[0]) / alignment.sx, alignment.liftM[1] + (y - alignment.lift[1]) / alignment.sz],
}
const toPx = ([x, z]: Point): Point => [alignment.lift[0] + (x - alignment.liftM[0]) * alignment.sx, alignment.lift[1] + (z - alignment.liftM[1]) * alignment.sz]

const b = (): BuildingData => JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/building.json'), 'utf8')) as BuildingData
const f2poly = (id: string): Point[] => b().rooms.find((r) => r.id === id)!.polygon
const liftsM = f2poly('f2-lifts')
const stairsTopMidM = f2poly('f2-stairs-top-mid')
const stairsBottomM = f2poly('f2-stairs-bottom')
// Keeps a 1.3 m arcade inside the outline free for the shop doors on the north side.
const northStrip: Point[] = [[-60, -32], [60, -32], [60, -28.7], [-60, -28.7]]

const none = { departmentId: null as string | null }
const poly = (...pts: [number, number][]): Point[] => pts
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
const lobbyM: Point[] = rect(-14.6, 25.6, -6.0, 30.5)
const lobbyPx = [toPx([-14.6, 25.6]), toPx([-6.0, 25.6]), toPx([-6.0, 30.5]), toPx([-14.6, 30.5])]

export const rooms: RoomSpec[] = [
  { ...none, id: 'f1-library', number: null, name: 'Library and Information Services Center', nameTh: 'ห้องสมุด', aliases: ['SIIT Library', 'Library'], type: 'library', px: poly([535, 650], [785, 650], [785, 695], [875, 695], [875, 740], [975, 740], [975, 940], [880, 940], [880, 878], [745, 878], [745, 925], [535, 925]), minus: [liftsM, stairsBottomM], door: [975, 860] },
  { ...none, id: 'f1-cafe-amazon', number: null, name: 'Café Amazon', aliases: ['Amazon', 'Cafe Amazon'], type: 'foodservice', px: rect(608, 570, 775, 648), minus: [northStrip], door: [692, 570] },
  { ...none, id: 'f1-coffee-buddy', number: null, name: 'Coffee Buddy', type: 'foodservice', px: rect(528, 565, 605, 648), minus: [northStrip], door: [566, 565] },
  { ...none, id: 'f1-restroom', number: null, name: 'Restrooms', nameTh: 'ห้องน้ำ', aliases: ['Toilet'], type: 'restroom', px: rect(958, 425, 1085, 670), minus: [stairsTopMidM], door: [958, 600] },
  { ...none, id: 'f1-admission', number: null, name: 'Admission Room', nameTh: 'ห้องรับสมัคร', type: 'office', px: rect(1090, 590, 1240, 670), door: [1190, 670] },
  { ...none, id: 'f1-ai-lab', number: null, name: 'AI Lab', nameTh: 'ห้องปฏิบัติการ AI', type: 'laboratory', px: poly([1092, 908], [1148, 908], [1148, 962], [1232, 988], [1232, 1065], [1088, 1065]), door: [1092, 1000] },
  { ...none, id: 'f1-first-aid', number: null, name: 'First Aid Room', nameTh: 'ห้องปฐมพยาบาล', aliases: ['Infirmary', 'Infirmary Room', 'First Aid'], type: 'other', px: rect(718, 935, 768, 1040), door: [768, 990] },
  // Row of narrow strips south-west of the library (plan x 580-715), read as First Aid / 1-102 / 1-101 side by side.
  // Order and exact widths are guesses from the photos: 1-102 adjoins a dark pillar then the First Aid door.
  { ...none, id: 'f1-1-102', number: '1-102', name: 'SIIT Smart Active Learning Room', nameTh: 'ห้องเรียนเชิงรุก', aliases: ['Smart Active Learning Room', 'Active Learning Room'], type: 'classroom', px: rect(645, 935, 715, 1035), door: [680, 1035] },
  { ...none, id: 'f1-1-101', number: '1-101', name: 'Room 1-101', type: 'other', px: rect(582, 935, 640, 1035), door: [610, 1035] },
  { ...none, id: 'f1-lobby', number: null, name: 'Main Entrance', nameTh: 'ทางเข้าหลัก', aliases: ['Main Lobby', 'Lobby', 'Entrance'], type: 'lobby', px: lobbyPx, metres: lobbyM, door: toPx([-10.3, 25.6]) },
  // Shafts: polygons are floor 2's rooms (same x,z on every floor).
  { ...none, id: 'f1-lifts', number: null, name: 'Lifts', nameTh: 'ลิฟต์', type: 'elevator', px: rect(811, 886, 875, 916), metres: liftsM, door: [843, 916] },
  { ...none, id: 'f1-stairs-top-mid', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(993, 650, 1055, 700), metres: stairsTopMidM, door: [1024, 700] },
  { ...none, id: 'f1-stairs-bottom', number: null, name: 'Stairs', nameTh: 'บันได', type: 'stairs', px: rect(807, 964, 869, 1017), metres: stairsBottomM, door: [838, 1017] },
]

export const plan: Plan = {
  floor: 1,
  fit,
  outline,
  gap: 0.25,
  voidsPx: [],
  rooms,
  corridorNodesMetres: { ar1: [-36.2, -29.3], ar2: [-26, -29.3], ar3: [-16.3, -29.3], ar4: [-16.3, -24] },
  corridorNodesPx: {
    w1: [870, 620], wn: [940, 600], w2: [940, 640], w3: [940, 715], e3: [1012, 715], a1: [1195, 715], e2: [1012, 790],
    e1: [1012, 905], c: [1012, 952], d1: [940, 952], l: [843, 938], s3: [940, 1028], s2: [843, 1028], s1: [790, 1028],
    i1: [790, 990], al: [1052, 990], s0: [680, 1052], s0b: [625, 1052], s1b: [790, 1052],
  },
  corridorEdges: [
    ['ar1', 'ar2'], ['ar2', 'ar3'], ['ar3', 'ar4'], ['ar4', 'w1'], ['w1', 'wn'], ['wn', 'w2'], ['w2', 'w3'], ['w3', 'e3'], ['e3', 'a1'],
    ['e3', 'e2'], ['e2', 'e1'], ['e1', 'c'], ['c', 'd1'], ['d1', 'l'], ['d1', 's3'], ['s3', 's2'], ['s2', 's1'], ['s1', 'i1'], ['s1', 's1b'], ['s1b', 's0'], ['s0', 's0b'], ['c', 'al'],
  ],
}

export const built = () => build(plan)

/** The sample lobby QR keeps its id and moves onto the real main entrance's door. */
export const qrPoints = (bt: ReturnType<typeof build>): QrPoint[] => {
  const old = b().qrPoints.find((q) => q.id === 'sample-f1-lobby')!
  const door = bt.nodes.find((n) => n.id === bt.rooms.find((r) => r.id === 'f1-lobby')!.door)!
  return [{ ...old, position: door.position }]
}

/** The three sample pins (information, defibrillator, water) are removed; nothing in the plan or photos shows them. */
export const connectorRooms = { lift: 'f1-lifts', 'stairs-w': 'f1-stairs-top-mid', 'stairs-s': 'f1-stairs-bottom' }
