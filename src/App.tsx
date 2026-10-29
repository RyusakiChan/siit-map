import { lazy, Suspense } from 'react'
import { buildingData as data } from './data'
import { useAppStore, type FloorView } from './state/store'

// The 3D scene (three.js) loads after the controls have rendered.
const BuildingScene = lazy(() => import('./scene/BuildingScene'))

function FloorPicker() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const options: { value: FloorView; label: string; aria: string }[] = [
    { value: 'all', label: 'All', aria: 'All floors' },
    ...[...data.floors].reverse().map((f) => ({ value: f.level, label: String(f.level), aria: f.label })),
  ]
  return (
    <nav className="floor-picker" aria-label="Floors">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === view ? 'floor-btn on' : 'floor-btn'}
          aria-label={o.aria}
          aria-pressed={o.value === view}
          onClick={() => setView(o.value)}
        >
          {o.label}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const selectedRoomId = useAppStore((s) => s.selectedRoomId)
  const room = data.rooms.find((r) => r.id === selectedRoomId)
  return (
    <div className="app">
      <Suspense fallback={null}>
        <BuildingScene />
      </Suspense>
      {data.building.sampleData && <div className="badge">SAMPLE DATA</div>}
      <FloorPicker />
      {room && <div className="selected" role="status">{room.number ? `${room.number} · ` : ''}{room.name}</div>}
      <div className="credit">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </div>
    </div>
  )
}
