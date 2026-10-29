import BuildingScene from './scene/BuildingScene'
import { buildingData as data } from './data'
import { useAppStore } from './state/store'


export default function App() {
  const selectedRoomId = useAppStore((s) => s.selectedRoomId)
  const room = data.rooms.find((r) => r.id === selectedRoomId)
  return (
    <div className="app">
      <BuildingScene />
      {data.building.sampleData && <div className="badge">SAMPLE DATA</div>}
      {room && <div className="selected">{room.name}</div>}
      <div className="credit">© OpenStreetMap contributors</div>
    </div>
  )
}
