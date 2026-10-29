// Writes the SAMPLE floors (fake names only) into src/data/building.json,
// keeping the OSM outline made by scripts/osm-outline.mjs. Real floors replace
// these one at a time in Week 2. Usage: node scripts/gen-sample-data.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/data/building.json', import.meta.url)
const json = JSON.parse(readFileSync(FILE, 'utf8'))

const G = 0.25 // half gap between neighbouring rooms, metres
const rect = (x0, x1, z0, z1) => [
  [x0 + G, z0 + G], [x1 - G, z0 + G], [x1 - G, z1 - G], [x0 + G, z1 - G],
]
const NZ = [-28, -5]
const SZ = [5, 29]
// North band (z -28..-5) and south band (z 5..29) either side of the corridor.
const slot = {
  stairsW: rect(-37, -32, ...NZ), A: rect(-32, -21, ...NZ), B: rect(-21, -10, ...NZ),
  restroom: rect(-10, -4, ...NZ), lift: rect(-4, 0, ...NZ), C: rect(0, 10, ...NZ),
  D: rect(10, 20, ...NZ), E: rect(20, 26, ...NZ), stairsE: rect(26, 31, ...NZ),
  S0: rect(-37, -31, 5, 20), S1: rect(-31, -20, ...SZ), S2: rect(-20, -8, ...SZ),
  S3: rect(-8, 0, ...SZ), S4: rect(0, 10, ...SZ), S5: rect(10, 20, ...SZ), S6: rect(20, 31, ...SZ),
  lobby: rect(-20, 0, ...SZ), library: rect(10, 31, ...SZ),
  S6L: [[20.25, 5.25], [30.75, 5.25], [30.75, 28.75], [25.25, 28.75], [25.25, 15.25], [20.25, 15.25]],
}

const depts = [
  { id: 'sample-dept-a', letter: 'A', name: 'Sample Dept A', nameTh: 'ภาควิชาตัวอย่าง A',
    aliases: ['dept a'], aliasesTh: ['ภาค เอ'] },
  { id: 'sample-dept-b', letter: 'B', name: 'Sample Dept B', nameTh: 'ภาควิชาตัวอย่าง B',
    aliases: ['dept b'] },
  { id: 'sample-dept-c', letter: 'C', name: 'Sample Dept C', nameTh: 'ภาควิชาตัวอย่าง C' },
].map((d) => ({ ...d, summary: 'A made-up department used to test the map. It is not a real SIIT department.' }))

// [slot, type, dept] per floor; facilities are added for every floor below.
const plan = {
  1: [['lobby', 'lobby'], ['S5', 'foodservice'], ['S1', 'office', 'A'], ['S6', 'classroom', 'B'],
      ['A', 'laboratory', 'A'], ['B', 'classroom', 'B'], ['C', 'office', 'C'], ['D', 'laboratory', 'C'], ['E', 'conferenceroom', 'B']],
  2: [['S0', 'office', 'A'], ['S1', 'classroom', 'A'], ['S2', 'laboratory', 'A'], ['S3', 'office', 'B'],
      ['S4', 'classroom', 'B'], ['S5', 'conferenceroom', 'C'], ['S6L', 'laboratory', 'B'],
      ['A', 'classroom', 'A'], ['B', 'laboratory', 'B'], ['C', 'classroom', 'C'], ['D', 'office', 'C'], ['E', 'laboratory', 'C']],
  3: [['library', 'library'], ['S1', 'classroom', 'C'], ['S2', 'office', 'A'], ['S3', 'laboratory', 'B'],
      ['A', 'office', 'B'], ['B', 'classroom', 'A'], ['C', 'laboratory', 'C'], ['D', 'classroom', 'B'], ['E', 'office', 'A']],
  4: [['S1', 'laboratory', 'B'], ['S2', 'classroom', 'B'], ['S3', 'office', 'C'], ['S4', 'conferenceroom', 'A'],
      ['S5', 'classroom', 'C'], ['S6L', 'office', 'A'], ['A', 'laboratory', 'C'], ['B', 'classroom', 'A'],
      ['C', 'office', 'B'], ['D', 'laboratory', 'A'], ['E', 'classroom', 'B']],
  5: [['S1', 'classroom', 'A'], ['S2', 'laboratory', 'C'], ['S3', 'office', 'A'], ['S4', 'laboratory', 'B'],
      ['S5', 'classroom', 'B'], ['S6', 'office', 'C'], ['A', 'office', 'B'], ['B', 'laboratory', 'A'],
      ['C', 'classroom', 'C'], ['D', 'conferenceroom', 'A'], ['E', 'office', 'B']],
}
const label = { classroom: 'Classroom', laboratory: 'Lab', office: 'Office', conferenceroom: 'Meeting Room' }
const labelTh = { classroom: 'ห้องเรียนตัวอย่าง', laboratory: 'ห้องปฏิบัติการตัวอย่าง', office: 'สำนักงานตัวอย่าง', conferenceroom: 'ห้องประชุมตัวอย่าง' }

const rooms = []
for (let f = 1; f <= 5; f++) {
  let n = 0
  const add = (r) => rooms.push({ ...r, floor: f })
  for (const [s, type, d] of plan[f]) {
    const polygon = slot[s]
    if (type === 'lobby') {
      add({ id: 'sample-f1-lobby', number: null, name: 'Sample Lobby', nameTh: 'ล็อบบี้ตัวอย่าง',
        departmentId: null, type, polygon, aliases: ['entrance', 'reception'], popular: true })
    } else if (type === 'foodservice') {
      add({ id: 'sample-f1-cafe', number: null, name: 'Sample Cafe', nameTh: 'คาเฟ่ตัวอย่าง',
        departmentId: null, type, polygon, aliases: ['coffee', 'canteen'], aliasesTh: ['กาแฟ'], popular: true,
        hours: 'Sample hours 08:00–16:00' })
    } else if (type === 'library') {
      add({ id: 'sample-f3-library', number: null, name: 'Sample Library', nameTh: 'ห้องสมุดตัวอย่าง',
        departmentId: null, type, polygon, aliases: ['study room'], aliasesTh: ['อ่านหนังสือ'], popular: true,
        hours: 'Sample hours 09:00–18:00' })
    } else {
      n++
      const num = `${f}-${String(n).padStart(2, '0')}`
      const dept = `sample-dept-${d.toLowerCase()}`
      add({ id: `sample-${type.slice(0, 3)}-${num}`, number: num, name: `Sample ${label[type]} ${num}`,
        ...(n % 2 === 1 ? { nameTh: `${labelTh[type]} ${num}` } : {}),
        departmentId: dept, type, polygon,
        ...(type === 'laboratory' && n % 3 === 0 ? { aliases: ['computer lab'] } : {}),
        ...(type === 'classroom' && f === 2 && n === 2 ? { popular: true, aliases: ['lecture hall'] } : {}) })
    }
  }
  add({ id: `sample-f${f}-restroom`, number: null, name: `Sample Restrooms F${f}`, nameTh: `ห้องน้ำตัวอย่าง ชั้น ${f}`,
    departmentId: null, type: 'restroom', polygon: slot.restroom, aliases: ['toilet', 'wc'], aliasesTh: ['ห้องส้วม'], popular: f === 1 })
  add({ id: `sample-f${f}-lift`, number: null, name: `Sample Lift F${f}`, nameTh: `ลิฟต์ตัวอย่าง ชั้น ${f}`,
    departmentId: null, type: 'elevator', polygon: slot.lift, aliases: ['elevator'] })
  add({ id: `sample-f${f}-stairs-w`, number: null, name: `Sample Stairs West F${f}`, nameTh: 'บันไดตัวอย่างฝั่งตะวันตก',
    departmentId: null, type: 'stairs', polygon: slot.stairsW })
  add({ id: `sample-f${f}-stairs-e`, number: null, name: `Sample Stairs East F${f}`, nameTh: 'บันไดตัวอย่างฝั่งตะวันออก',
    departmentId: null, type: 'stairs', polygon: slot.stairsE })
}

// Walkway graph: one corridor centre line along z = 0 between the bands. Each room's door node sits
// on the corridor side of the room's edge, 0.25 m outside it (z = -5 north, z = 5 south).
const DOOR_X = { S0: -34.5, S6L: 25.5, lobby: -10, library: 20.5 }
const slotOf = (f, room) => plan[f].find(([s]) => slot[s] === room.polygon)?.[0]
const doorSlot = { restroom: 'restroom', lift: 'lift', 'stairs-w': 'stairsW', 'stairs-e': 'stairsE' }
const centreX = (poly) => {
  const xs = poly.map((p) => p[0])
  return Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 100) / 100
}
const nodes = []
const edges = []
const connectors = [
  { id: 'lift', kind: 'elevator', costPerFloor: 20, nodes: {} },
  { id: 'stairs-w', kind: 'stairs', costPerFloor: 14, nodes: {} },
  { id: 'stairs-e', kind: 'stairs', costPerFloor: 14, nodes: {} },
]
for (let f = 1; f <= 5; f++) {
  const spine = new Map() // x -> corridor node id
  const at = (x) => {
    if (!spine.has(x)) {
      const id = `f${f}-c${String(Math.round(x * 10)).replace('-', 'm')}`
      spine.set(x, id)
      nodes.push({ id, floor: f, position: [x, 0] })
    }
    return spine.get(x)
  }
  for (const room of rooms.filter((r) => r.floor === f)) {
    const key = room.id.match(/-(restroom|lift|stairs-w|stairs-e)$/)?.[1]
    const s = key ? doorSlot[key] : slotOf(f, room)
    const north = room.polygon.every((p) => p[1] < 0)
    const x = DOOR_X[s] ?? centreX(room.polygon)
    const id = `f${f}-door-${room.id.replace(/^sample-/, '').replace(/^f\d-/, '')}`
    nodes.push({ id, floor: f, position: [x, north ? -5 : 5] })
    edges.push({ a: id, b: at(x) })
    room.door = id
    const c = connectors.find((k) => key === k.id)
    if (c) c.nodes[f] = id
  }
  const xs = [...spine.keys()].sort((a, b) => a - b)
  for (let i = 1; i < xs.length; i++) edges.push({ a: spine.get(xs[i - 1]), b: spine.get(xs[i]) })
}
json.walkways = { nodes, edges, connectors }

json.departments = depts
json.rooms = rooms
json.qrPoints = [
  { id: 'sample-f2-lift', floor: 2, position: [-2, 1.5], facingDeg: 180 },
  { id: 'sample-f1-lobby', floor: 1, position: [-10, 8], facingDeg: 0 },
]
json.amenities = [
  { id: 'sample-f1-info', floor: 1, position: [-10, 12], type: 'information' },
  { id: 'sample-f1-aed', floor: 1, position: [4, -2], type: 'defibrillator' },
  ...[1, 2, 3, 4, 5].map((f) => ({ id: `sample-f${f}-water`, floor: f, position: [-7, -2], type: 'drinkingfountain' })),
  { id: 'sample-f2-prayer', floor: 2, position: [24, -2], type: 'prayerroom' },
  { id: 'sample-f3-charging', floor: 3, position: [15, 12], type: 'powerchargingstation' },
]
writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n')
console.log(rooms.length, 'rooms;', [1, 2, 3, 4, 5].map((f) => rooms.filter((r) => r.floor === f).length).join('/'), 'per floor')
