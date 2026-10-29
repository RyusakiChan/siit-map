import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { buildingData as data } from '../data'
import type { Point, Room } from '../data/types'
import { useAppStore } from '../state/store'

const SLAB_THICKNESS = 0.2
const ROOM_HEIGHT = 3

// The shape lives in the XY plane. After rotating -90deg about X, shape y maps
// to world -z and the extrusion depth maps to world +y (up).
function toShape(points: Point[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
}

function Slab({ elevation, outline }: { elevation: number; outline: Point[] }) {
  const geometry = useMemo(
    () => new THREE.ExtrudeGeometry(toShape(outline), { depth: SLAB_THICKNESS, bevelEnabled: false }),
    [outline],
  )
  return (
    <mesh geometry={geometry} position={[0, elevation - SLAB_THICKNESS, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#b8bcc4" />
    </mesh>
  )
}

function RoomBlock({ room, elevation }: { room: Room; elevation: number }) {
  const selected = useAppStore((s) => s.selectedRoomId === room.id)
  const selectRoom = useAppStore((s) => s.selectRoom)
  const geometry = useMemo(
    () => new THREE.ExtrudeGeometry(toShape(room.polygon), { depth: ROOM_HEIGHT, bevelEnabled: false }),
    [room.polygon],
  )
  return (
    <mesh
      geometry={geometry}
      position={[0, elevation, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        selectRoom(selected ? null : room.id)
      }}
    >
      <meshStandardMaterial color={selected ? '#e0a030' : '#6f93b8'} />
    </mesh>
  )
}

export default function BuildingScene() {
  const elevations = new Map(data.floors.map((f) => [f.level, f.elevation]))
  return (
    <Canvas
      camera={{ position: [50, 40, 60], fov: 45, near: 0.1, far: 500 }}
      onPointerMissed={() => useAppStore.getState().selectRoom(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[30, 60, 20]} intensity={1.2} />
      {data.floors.map((f) => (
        <Slab key={f.level} elevation={f.elevation} outline={data.building.outline} />
      ))}
      {data.rooms.map((r) => (
        <RoomBlock key={r.id} room={r} elevation={elevations.get(r.floor) ?? 0} />
      ))}
      <OrbitControls target={[0, 8, 0]} makeDefault />
    </Canvas>
  )
}
