import { amenities, built, connectorRooms, qrPoints } from './floor2'
import { runJob } from './run'

export function main(write: boolean): void {
  const b = built()
  const doorOf = (roomId: string) => b.rooms.find((r) => r.id === roomId)!.door!
  const connectors = [
    { id: 'lift', kind: 'elevator' as const, costPerFloor: 20, node: doorOf(connectorRooms.lift) },
    { id: 'stairs-w', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-w']) },
    { id: 'stairs-e', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-e']) },
  ]
  runJob(
    { floor: 2, departments: [], report: b.report, slice: { floor: 2, rooms: b.rooms, nodes: b.nodes, edges: b.edges, qrPoints: qrPoints(b), voids: [], amenities, connectors } },
    write,
  )
}
