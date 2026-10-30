// Saves floors 2, 3 and 4 together: the shared stairs-s connector spans all three, and a connector
// needs two floors to validate. Run: node scripts/trace/run.mjs floors234 [--write]
import * as f2 from './floor2'
import * as f3 from './floor3'
import * as f4 from './floor4'
import { runJobs, type FloorJob } from './run'

type Shafts = Record<'lift' | 'stairs-e' | 'stairs-w' | 'stairs-s', string>
const connectors = (b: { rooms: { id: string; door?: string }[] }, rooms: Shafts) => {
  const doorOf = (roomId: string) => b.rooms.find((r) => r.id === roomId)!.door!
  return [
    { id: 'lift', kind: 'elevator' as const, costPerFloor: 20, node: doorOf(rooms.lift) },
    { id: 'stairs-w', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(rooms['stairs-w']) },
    { id: 'stairs-e', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(rooms['stairs-e']) },
    { id: 'stairs-s', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(rooms['stairs-s']) },
  ]
}

export function main(write: boolean): void {
  const b2 = f2.built()
  const b3 = f3.built()
  const b4 = f4.built()
  const jobs: FloorJob[] = [
    { floor: 2, departments: [], report: b2.report, slice: { floor: 2, rooms: b2.rooms, nodes: b2.nodes, edges: b2.edges, qrPoints: f2.qrPoints(b2), voids: [], amenities: f2.amenities, connectors: connectors(b2, f2.connectorRooms as Shafts) } },
    { floor: 3, departments: f3.departments, report: b3.report, slice: { floor: 3, rooms: b3.rooms, nodes: b3.nodes, edges: b3.edges, qrPoints: [], voids: b3.voids, amenities: f3.amenities(b3), connectors: connectors(b3, f3.connectorRooms as Shafts) } },
    { floor: 4, departments: f4.departments, report: b4.report, slice: { floor: 4, rooms: b4.rooms, nodes: b4.nodes, edges: b4.edges, qrPoints: [], voids: b4.voids, amenities: f4.amenities(b4), connectors: connectors(b4, f4.connectorRooms as Shafts) } },
  ]
  runJobs(jobs, write)
}
