import { built, connectorRooms, qrPoints } from './floor1'
import { runJob } from './run'

export function main(write: boolean): void {
  const bt = built()
  const doorOf = (roomId: string) => bt.rooms.find((r) => r.id === roomId)!.door!
  const connectors = [
    { id: 'lift', kind: 'elevator' as const, costPerFloor: 20, node: doorOf(connectorRooms.lift) },
    { id: 'stairs-w', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-w']) },
    { id: 'stairs-s', kind: 'stairs' as const, costPerFloor: 14, node: doorOf(connectorRooms['stairs-s']) },
  ]
  runJob({ floor: 1, departments: [], report: bt.report, slice: { floor: 1, rooms: bt.rooms, nodes: bt.nodes, edges: bt.edges, qrPoints: qrPoints(bt), voids: [], amenities: [], connectors } }, write)
}
