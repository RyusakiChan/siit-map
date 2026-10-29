// Fetches OSM way 195958489 (SIIT Main Building, © OpenStreetMap contributors, ODbL),
// projects it to metres around its centroid (x east, z south) and writes the
// outline and origin into src/data/building.json. Usage: node scripts/osm-outline.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const WAY = 195958489
const FILE = new URL('../src/data/building.json', import.meta.url)
const R = 6378137

const res = await fetch(`https://api.openstreetmap.org/api/0.6/way/${WAY}/full.json`, {
  headers: { 'User-Agent': 'siit-map-student-project (outline script)' },
})
if (!res.ok) throw new Error(`OSM ${res.status}`)
const { elements } = await res.json()
const way = elements.find((e) => e.type === 'way')
const nodes = new Map(elements.filter((e) => e.type === 'node').map((n) => [n.id, n]))
let pts = way.nodes.map((id) => nodes.get(id))
if (pts[0].id === pts[pts.length - 1].id) pts = pts.slice(0, -1)

// Area centroid in lat/lon (small area, so planar is fine).
let a = 0, cx = 0, cy = 0
for (let i = 0; i < pts.length; i++) {
  const p = pts[i], q = pts[(i + 1) % pts.length]
  const f = p.lon * q.lat - q.lon * p.lat
  a += f; cx += (p.lon + q.lon) * f; cy += (p.lat + q.lat) * f
}
const lon0 = cx / (3 * a), lat0 = cy / (3 * a)
const rad = Math.PI / 180
const round = (v) => Math.round(v * 100) / 100
let outline = pts.map((p) => [
  round(R * (p.lon - lon0) * rad * Math.cos(lat0 * rad)),
  round(-R * (p.lat - lat0) * rad),
])
// Keep a consistent winding (counter-clockwise seen from above is irrelevant; just stable).
const json = JSON.parse(readFileSync(FILE, 'utf8'))
json.building.name = 'SIIT Main Building'
json.building.osmWay = WAY
json.building.origin = { lat: Math.round(lat0 * 1e7) / 1e7, lon: Math.round(lon0 * 1e7) / 1e7 }
json.building.outline = outline
writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n')
const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1])
console.log(outline.length, 'points; x', Math.min(...xs), Math.max(...xs), 'z', Math.min(...zs), Math.max(...zs))
console.log(JSON.stringify(outline))
