import { amenities, built, connectorRooms, departments } from './floor3'
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
    {
      floor: 3,
      departments,
      report: b.report,
      slice: { floor: 3, rooms: b.rooms, nodes: b.nodes, edges: b.edges, qrPoints: [], voids: b.voids, amenities: amenities(b), connectors },
    },
    write,
  )
}
