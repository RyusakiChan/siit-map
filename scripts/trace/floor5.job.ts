import { built, connectorRooms } from './floor5'
import { runJob } from './run'

export function main(write: boolean): void {
  const b = built()
  const doorOf = (roomId: string) => b.rooms.find((r) => r.id === roomId)!.door!
  const connectors = [
    { id: 'lift', kind: 'elevator' as const, costPerFloor: 20, node: doorOf(connectorRooms.lift) },
    { id: 'stairs-e', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-e']) },
    { id: 'stairs-s', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-s']) },
  ]
  runJob({ floor: 5, departments: [], report: b.report, slice: { floor: 5, rooms: b.rooms, nodes: b.nodes, edges: b.edges, qrPoints: [], voids: b.voids, amenities: [], connectors } }, write)
}
