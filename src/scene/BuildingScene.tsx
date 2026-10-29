import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { buildingData as data } from '../data'
import { polygonArea, polygonCentroid } from '../data/geometry'
import type { Point, Room } from '../data/types'
import { departmentBadgeColor, roomColor, tokens } from '../theme/colors'
import { useAppStore, type FloorView } from '../state/store'
import { FacilityIcon } from './icons'
import { hasIcon } from './iconTypes'
import { ease } from './motion'

const SLAB_THICKNESS = 0.3
const ROOM_HEIGHT = 3
const RISE = 0.3 // a selected room grows 30% taller
const BIG_ROOM_AREA = 200 // m²: bigger rooms are always labelled in single-floor view
const FOV = 40

const outline = data.building.outline
const bounds = outline.reduce(
  (b, [x, z]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minZ: Math.min(b.minZ, z), maxZ: Math.max(b.maxZ, z) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
)
const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
const halfWidth = (bounds.maxX - bounds.minX) / 2
// Floors are drawn further apart than their real height so the stack reads clearly.
const STACK_SPREAD = 1.75
const elevationOf = (level: number) => (data.floors.find((f) => f.level === level)?.elevation ?? 0) * STACK_SPREAD
const topElevation = Math.max(...data.floors.map((f) => elevationOf(f.level)))

// The shape lives in the XY plane. After rotating -90deg about X, shape y maps
// to world -z and the extrusion depth maps to world +y (up).
function toShape(points: Point[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
}

function extrude(points: Point[], depth: number): THREE.ExtrudeGeometry {
  return new THREE.ExtrudeGeometry(toShape(points), { depth, bevelEnabled: false })
}

// ExtrudeGeometry material groups: 0 = top and bottom caps, 1 = side walls.
function makeMaterials(): [THREE.MeshBasicMaterial, THREE.MeshLambertMaterial] {
  return [new THREE.MeshBasicMaterial({ toneMapped: false }), new THREE.MeshLambertMaterial({ toneMapped: false })]
}

function setAlpha(mats: THREE.Material[], alpha: number) {
  for (const m of mats) {
    m.opacity = alpha
    m.transparent = alpha < 0.999
    m.depthWrite = alpha >= 0.999
  }
}

interface RoomItem {
  room: Room
  geometry: THREE.ExtrudeGeometry
  top: THREE.MeshBasicMaterial
  side: THREE.MeshLambertMaterial
  colors: { top: THREE.Color; side: THREE.Color }
}

/** Per-room animation state, mutated every frame. */
interface RoomLive {
  group: THREE.Group | null
  raise: number
  dim: number
}

interface FloorAnim {
  vis: number // 0 = faded out, 1 = shown
  offset: number // vertical slide while fading out
  slabAlpha: number
  viewed: number // 1 when this is the single floor on show
}

function FloorLayer({ level }: { level: number }) {
  const elevation = elevationOf(level)
  const root = useRef<THREE.Group>(null)
  const anim = useRef<FloorAnim>({ vis: 1, offset: 0, slabAlpha: level === 1 ? 0.95 : 0.55, viewed: 0 })
  const slabGeometry = useMemo(() => extrude(outline, SLAB_THICKNESS), [])
  const slab = useMemo(() => makeMaterials(), [])
  const items = useMemo<RoomItem[]>(
    () =>
      data.rooms
        .filter((r) => r.floor === level)
        .map((room) => {
          const [top, side] = makeMaterials()
          const c = roomColor(room)
          return { room, geometry: extrude(room.polygon, ROOM_HEIGHT), top, side,
            colors: { top: new THREE.Color(c.top), side: new THREE.Color(c.side) } }
        }),
    [level],
  )
  const live = useRef(new Map<string, RoomLive>())
  const scratch = useMemo(() => new THREE.Color(), [])
  const slabTop = useMemo(() => ({ a: new THREE.Color(tokens.slabTop), b: new THREE.Color(tokens.slabTopViewed) }), [])
  const dimmed = useMemo(() => ({ top: new THREE.Color(tokens.dimmedTop), side: new THREE.Color(tokens.dimmedSide) }), [])
  const slabSide = useMemo(() => new THREE.Color(tokens.slabSide), [])

  useEffect(
    () => () => {
      slabGeometry.dispose()
      slab.forEach((m) => m.dispose())
      items.forEach((i) => {
        i.geometry.dispose()
        i.top.dispose()
        i.side.dispose()
      })
    },
    [slabGeometry, slab, items],
  )

  useFrame((_, dt) => {
    const { view, selectedRoomId } = useAppStore.getState()
    const a = anim.current
    const shown = view === 'all' || view === level
    const viewedTarget = view === level ? 1 : 0
    const slabTarget = !shown ? 0 : view === 'all' ? (level === 1 ? 0.95 : 0.55) : 1
    const slideDir = view === 'all' ? 0 : Math.sign(level - view)
    a.vis = ease(a.vis, shown ? 1 : 0, 7, dt)
    a.offset = ease(a.offset, shown ? 0 : slideDir * 5, 5, dt)
    a.slabAlpha = ease(a.slabAlpha, slabTarget, 7, dt)
    a.viewed = ease(a.viewed, viewedTarget, 7, dt)

    if (root.current) {
      root.current.visible = a.vis > 0.01 || a.slabAlpha > 0.01
      root.current.position.y = a.offset
    }
    scratch.lerpColors(slabTop.a, slabTop.b, a.viewed)
    slab[0].color.copy(scratch)
    slab[1].color.copy(slabSide)
    setAlpha(slab, a.slabAlpha)

    const selected = data.rooms.find((r) => r.id === selectedRoomId)
    for (const it of items) {
      const isSel = it.room.id === selectedRoomId
      const l = live.current.get(it.room.id)
      if (!l) continue
      l.raise = ease(l.raise, isSel ? 1 : 0, 12, dt)
      l.dim = ease(l.dim, selected && selected.floor === level && !isSel ? 1 : 0, 12, dt)
      it.top.color.lerpColors(it.colors.top, dimmed.top, l.dim)
      it.side.color.lerpColors(it.colors.side, dimmed.side, l.dim)
      setAlpha([it.top, it.side], a.vis)
      if (l.group) l.group.scale.y = 1 + RISE * l.raise
    }
  })

  return (
    <group ref={root}>
      <mesh geometry={slabGeometry} material={slab} position={[0, elevation - SLAB_THICKNESS, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />
      {items.map((it) => (
        <group key={it.room.id} ref={(g) => {
          const l = live.current.get(it.room.id) ?? { group: null, raise: 0, dim: 0 }
          l.group = g
          live.current.set(it.room.id, l)
        }} position={[0, elevation, 0]}>
          <mesh
            geometry={it.geometry}
            material={[it.top, it.side]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              if (e.delta > 6 || anim.current.vis < 0.5) return // a drag, or a faded-out floor
              e.stopPropagation()
              const { selectedRoomId, selectRoom } = useAppStore.getState()
              selectRoom(selectedRoomId === it.room.id ? null : it.room.id)
            }}
          />
        </group>
      ))}
    </group>
  )
}

/** Thin slab kept under the viewed floor when the other floors are hidden. */
function BaseSlab() {
  const ref = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => extrude(outline, 0.15), [])
  const mats = useMemo(() => makeMaterials(), [])
  const state = useRef({ alpha: 0, y: 0 })
  useFrame((_, dt) => {
    const { view } = useAppStore.getState()
    const s = state.current
    const targetY = (view === 'all' ? 0 : elevationOf(view)) - 0.9
    s.y = view === 'all' || s.alpha < 0.05 ? targetY : ease(s.y, targetY, 7, dt)
    s.alpha = ease(s.alpha, view === 'all' ? 0 : 1, 7, dt)
    mats[0].color.set(tokens.slabTop)
    mats[1].color.set(tokens.slabSide)
    setAlpha(mats, s.alpha)
    if (ref.current) {
      ref.current.visible = s.alpha > 0.01
      ref.current.position.y = s.y
    }
  })
  return <mesh ref={ref} geometry={geometry} material={mats} rotation={[-Math.PI / 2, 0, 0]} />
}

/** Ink outline and number tag on the chosen room. */
function Selection() {
  const id = useAppStore((s) => s.selectedRoomId)
  const room = data.rooms.find((r) => r.id === id)
  const state = useRef({ raise: 0, alpha: 0 })
  const lineRef = useRef<THREE.Group>(null)
  const matRef = useRef<{ opacity: number } | null>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  // Fade out the previous outline quickly instead of animating a stale room.
  useFrame((_, dt) => {
    const s = state.current
    s.raise = ease(s.raise, room ? 1 : 0, 12, dt)
    s.alpha = ease(s.alpha, room ? 1 : 0, 12, dt)
    const y = elevationOf(room?.floor ?? 1) + ROOM_HEIGHT * (1 + RISE * s.raise) + 0.05
    if (lineRef.current) {
      lineRef.current.position.y = y
      lineRef.current.visible = s.alpha > 0.01
    }
    if (matRef.current) matRef.current.opacity = s.alpha
    if (tagRef.current) tagRef.current.style.opacity = String(s.alpha)
  })
  if (!room) return null
  const [cx, cz] = polygonCentroid(room.polygon)
  const points = [...room.polygon, ...room.polygon.slice(0, 1)].map(([x, z]) => new THREE.Vector3(x, 0, z))
  return (
    <group ref={lineRef} key={room.id}>
      <Line
        points={points}
        color={tokens.ink}
        lineWidth={3}
        transparent
        ref={(l) => { matRef.current = l ? (l.material as unknown as { opacity: number }) : null }}
      />
      <Html position={[cx, 0.6, cz]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
        <div className="room-tag" ref={tagRef}>{room.number ?? room.name}</div>
      </Html>
    </group>
  )
}

function Labels() {
  const view = useAppStore((s) => s.view)
  const zoomedIn = useAppStore((s) => s.zoomedIn)
  const selectedId = useAppStore((s) => s.selectedRoomId)
  const rooms = useMemo(
    () =>
      view === 'all'
        ? []
        : data.rooms
            .filter((r) => r.floor === view)
            .map((room) => ({
              room,
              big: polygonArea(room.polygon) >= BIG_ROOM_AREA,
              at: polygonCentroid(room.polygon),
              letter: data.departments.find((d) => d.id === room.departmentId)?.letter,
            })),
    [view],
  )
  if (view === 'all') return null
  const y = elevationOf(view) + ROOM_HEIGHT + 0.1
  return (
    <>
      {rooms.map(({ room, big, at, letter }) => {
        if (room.id === selectedId || !(big || zoomedIn)) return null
        const badge = letter ? (
          <span className="map-badge" style={{ borderColor: departmentBadgeColor(room.departmentId) }}>{letter}</span>
        ) : hasIcon(room.type) ? (
          <span className="map-icon"><FacilityIcon type={room.type} /></span>
        ) : null
        return badge && (
          <Html key={room.id} position={[at[0], y, at[1]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            {badge}
          </Html>
        )
      })}
    </>
  )
}

function fitDistance(radius: number, aspect: number) {
  const vHalf = THREE.MathUtils.degToRad(FOV / 2)
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  return radius / Math.tan(Math.min(vHalf, hHalf))
}

function Rig() {
  const ref = useRef<CameraControlsImpl | null>(null)
  const [attached, setAttached] = useState(false)
  const size = useThree((s) => s.size)
  const view = useAppStore((s) => s.view)
  const ready = size.width > 0 && size.height > 0
  const aspect = ready ? size.width / size.height : 1
  const allDist = fitDistance(halfWidth * 1.15 + 12, aspect)
  const floorDist = fitDistance(halfWidth * 1.2 + 8, aspect)
  const started = useRef(false)
  const zoomed = useRef(false)

  useEffect(() => {
    const c = ref.current
    if (!c || !ready) return
    // Dev-only handle so browser tests can read the camera.
    if (import.meta.env.DEV) (window as unknown as { __rig?: CameraControlsImpl }).__rig = c
    const animate = started.current
    started.current = true
    c.minDistance = 18
    c.maxDistance = allDist * 1.2
    c.minPolarAngle = 0.12
    c.maxPolarAngle = 1.5
    c.setBoundary(new THREE.Box3(new THREE.Vector3(bounds.minX - 10, -3, bounds.minZ - 10), new THREE.Vector3(bounds.maxX + 10, topElevation + 8, bounds.maxZ + 10)))
    const single = view !== ('all' as FloorView)
    const az = animate ? c.azimuthAngle : 0.4
    c.rotateTo(az, single ? 0.8 : 1.0, animate)
    c.dollyTo(single ? floorDist : allDist, animate)
    const y = single ? elevationOf(view as number) + 1 : topElevation / 2 + 1
    c.moveTo(center.x, y, center.z, animate)
  }, [attached, view, ready, allDist, floorDist])

  useFrame(() => {
    const c = ref.current
    if (!c) return
    const near = c.distance < floorDist * 0.7
    if (near !== zoomed.current) {
      zoomed.current = near
      useAppStore.getState().setZoomedIn(near)
    }
  })

  return (
    <CameraControls
      ref={(inst) => {
        ref.current = inst
        setAttached(inst !== null)
      }}
      makeDefault
      smoothTime={0.3}
      draggingSmoothTime={0.08}
      truckSpeed={1.2}
      touches={{
        one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
        two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
        three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
      }}
    />
  )
}

export default function BuildingScene() {
  return (
    <Canvas
      className="scene"
      dpr={[1, 1.75]}
      camera={{ position: [0, 120, 200], fov: FOV, near: 1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useAppStore.getState().selectRoom(null)}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[-40, 80, 60]} intensity={1.1} />
      <BaseSlab />
      {data.floors.map((f) => (
        <FloorLayer key={f.level} level={f.level} />
      ))}
      <Selection />
      <Labels />
      <Rig />
    </Canvas>
  )
}
