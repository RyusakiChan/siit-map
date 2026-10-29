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
import { ease, reducedMotion, setFrameRequester } from './motion'

const SLAB_THICKNESS = 0.3
const ROOM_HEIGHT = 3
const RISE = 0.3 // a selected room grows 30% taller
const BIG_ROOM_AREA = 200 // m²: bigger rooms are always labelled in single-floor view
const FOV = 40
// The map is fitted into the screen area the chrome leaves free (px).
const INSET_TOP = 158 // below the top bar, chips, status row and banner
const INSET_BOTTOM = 104 // above the bottom bar
const INSET_LEFT = 16
const INSET_RIGHT = 62 // left of the floor picker, with a gap
const FULL_SHEET = 0.53 // the full room card covers the bottom 53% of the screen

const outline = data.building.outline
const bounds = outline.reduce(
  (b, [x, z]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minZ: Math.min(b.minZ, z), maxZ: Math.max(b.maxZ, z) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
)
const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 }
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
    const { view, selectedRoomId, highlightDeptId } = useAppStore.getState()
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
      const dimmedNow = !isSel && ((selected && selected.floor === level) || (highlightDeptId && it.room.departmentId !== highlightDeptId))
      l.dim = ease(l.dim, dimmedNow ? 1 : 0, 12, dt)
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
              selectRoom(selectedRoomId === it.room.id ? null : it.room.id, { focus: selectedRoomId !== it.room.id })
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

/** Ink outline and number tag on the chosen room; fades in and out. */
function Selection() {
  const id = useAppStore((s) => s.selectedRoomId)
  const current = data.rooms.find((r) => r.id === id)
  // Keep showing the last room while its outline fades out.
  const [shown, setShown] = useState<Room | undefined>(current)
  if (current && current.id !== shown?.id) setShown(current)
  const room = current ?? shown
  const state = useRef({ raise: 0, alpha: 0 })
  const lineRef = useRef<THREE.Group>(null)
  const matRef = useRef<{ opacity: number } | null>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  // drei's Html drops its content when it mounts in the very first commit (a deep link opens
  // with a room already chosen), so the tag waits one animation frame.
  const invalidate = useThree((s) => s.invalidate)
  const [tagReady, setTagReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTagReady(true)
      invalidate()
    })
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  useFrame((_, dt) => {
    const s = state.current
    s.raise = ease(s.raise, current ? 1 : 0, 12, dt)
    s.alpha = ease(s.alpha, current ? 1 : 0, 12, dt)
    const y = elevationOf(room?.floor ?? 1) + ROOM_HEIGHT * (1 + RISE * s.raise) + 0.05
    if (lineRef.current) {
      lineRef.current.position.y = y
      lineRef.current.visible = s.alpha > 0.01
    }
    if (matRef.current) matRef.current.opacity = s.alpha
    if (tagRef.current) tagRef.current.style.opacity = String(s.alpha)
  })
  const points = useMemo(
    () => (room ? [...room.polygon, ...room.polygon.slice(0, 1)].map(([x, z]) => new THREE.Vector3(x, 0, z)) : []),
    [room],
  )
  if (!room) return null
  const [cx, cz] = polygonCentroid(room.polygon)
  return (
    <group ref={lineRef} key={room.id}>
      <Line
        points={points}
        color={tokens.ink}
        lineWidth={3}
        transparent
        ref={(l) => { matRef.current = l ? (l.material as unknown as { opacity: number }) : null }}
      />
      {tagReady && (
        <Html position={[cx, 0.6, cz]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="room-tag" ref={tagRef}>{room.number ?? room.name}</div>
        </Html>
      )}
    </group>
  )
}

/** The "you are here" pin, wide facing cone and a soft pulsing halo (the only looping motion). */
function HerePin() {
  const here = useAppStore((s) => s.here)
  const view = useAppStore((s) => s.view)
  const halo = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => {
    if (!here) return null
    const dir = THREE.MathUtils.degToRad(here.facingDeg) // clockwise from north (-z)
    const pts: Point[] = [[0, 0]]
    for (let i = 0; i <= 16; i++) {
      const a = dir - 0.9 + (1.8 * i) / 16
      pts.push([Math.sin(a) * 14, -Math.cos(a) * 14])
    }
    return {
      cone: new THREE.ShapeGeometry(toShape(pts)),
      ring: new THREE.RingGeometry(1.5, 2.2, 32),
      dot: new THREE.CircleGeometry(1.5, 32),
      halo: new THREE.CircleGeometry(2.2, 32),
    }
  }, [here])
  const invalidate = useThree((s) => s.invalidate)
  useFrame(({ clock }) => {
    if (!halo.current) return
    if (reducedMotion()) {
      halo.current.scale.setScalar(1.6)
      return
    }
    const p = (clock.elapsedTime % 2.6) / 2.6
    const e = 1 - Math.pow(1 - p, 3)
    halo.current.scale.setScalar(1 + e * 1.6)
    ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.18 * (1 - p)
    invalidate()
  })
  if (!here || !geo || (view !== 'all' && view !== here.floor)) return null
  const y = elevationOf(here.floor) + 0.15
  return (
    <group position={[here.x, y, here.z]}>
      <mesh geometry={geo.cone} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={5}>
        <meshBasicMaterial color={tokens.youAreHere} transparent opacity={0.22} depthWrite={false} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={halo} geometry={geo.halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} renderOrder={6}>
        <meshBasicMaterial color={tokens.youAreHere} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} renderOrder={7}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} depthTest={false} />
      </mesh>
      <mesh geometry={geo.dot} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} renderOrder={8}>
        <meshBasicMaterial color={tokens.youAreHere} toneMapped={false} depthTest={false} />
      </mesh>
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

type Rect = { left: number; right: number; top: number; bottom: number }

/** The free screen area, which depends on what covers the bottom: nothing, the peek card or the full card. */
function freeRect(w: number, h: number, card: 'none' | 'peek' | 'full', peekH: number): Rect {
  const bottom = card === 'full' ? h * (1 - FULL_SHEET) - 24 : card === 'peek' ? h - peekH - 8 : h - INSET_BOTTOM
  return { left: INSET_LEFT, right: w - INSET_RIGHT, top: INSET_TOP, bottom: Math.max(bottom, INSET_TOP + 120) }
}

const fitCam = new THREE.PerspectiveCamera(FOV, 1, 1, 900)
const fitPoint = new THREE.Vector3()

/**
 * Camera distance (and the picture shift in px) that puts the whole building, or the one floor,
 * inside `rect`, measured by projecting its outline through the real camera.
 */
function fitPose(view: FloorView, azimuth: number, polar: number, w: number, h: number, rect: Rect) {
  const single = view !== ('all' as FloorView)
  const y0 = single ? elevationOf(view as number) : 0
  const y1 = (single ? y0 : topElevation) + ROOM_HEIGHT * (1 + RISE) + 0.3
  const target = new THREE.Vector3(center.x, single ? y0 + 1 : topElevation / 2 + 1, center.z)
  fitCam.aspect = w / h
  fitCam.updateProjectionMatrix()
  const pts = outline.flatMap(([x, z]) => [new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z)])
  const measure = (dist: number) => {
    fitCam.position.set(
      target.x + dist * Math.sin(polar) * Math.sin(azimuth),
      target.y + dist * Math.cos(polar),
      target.z + dist * Math.sin(polar) * Math.cos(azimuth),
    )
    fitCam.lookAt(target)
    fitCam.updateMatrixWorld()
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of pts) {
      fitPoint.copy(p).project(fitCam)
      const px = ((fitPoint.x + 1) / 2) * w
      const py = ((1 - fitPoint.y) / 2) * h
      minX = Math.min(minX, px); maxX = Math.max(maxX, px)
      minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
    return { minX, maxX, minY, maxY }
  }
  const fits = (dist: number) => {
    const m = measure(dist)
    return m.maxX - m.minX <= rect.right - rect.left && m.maxY - m.minY <= rect.bottom - rect.top
  }
  let lo = 20
  let hi = 600
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  const m = measure(hi)
  return {
    dist: hi,
    shiftX: (rect.left + rect.right) / 2 - (m.minX + m.maxX) / 2,
    shiftY: (rect.top + rect.bottom) / 2 - (m.minY + m.maxY) / 2,
  }
}

function Rig() {
  const ref = useRef<CameraControlsImpl | null>(null)
  const [attached, setAttached] = useState(false)
  const size = useThree((s) => s.size)
  const view = useAppStore((s) => s.view)
  const hasRoom = useAppStore((s) => s.selectedRoomId !== null)
  const snap = useAppStore((s) => s.snap)
  const peekH = useAppStore((s) => s.peekH)
  const ready = size.width > 0 && size.height > 0
  const w = size.width || 1
  const h = size.height || 1
  // Reference distances with nothing covering the map: the zoom limit and the "zoomed in" test.
  const allDist = useMemo(() => fitPose('all', 0.15, 0.6, w, h, freeRect(w, h, 'none', 0)).dist, [w, h])
  const floorDist = useMemo(() => fitPose(1, 0.15, 0.65, w, h, freeRect(w, h, 'none', 0)).dist, [w, h])
  const started = useRef(false)
  const zoomed = useRef(false)
  const shift = useRef({ x: 0, y: 0, jump: true })

  const focus = useAppStore((s) => s.focus)
  const lastFocus = useRef(0)
  const lastView = useRef<FloorView | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !ready) return
    // Dev-only handle so browser tests can read the camera.
    if (import.meta.env.DEV) (window as unknown as { __rig?: CameraControlsImpl }).__rig = c
    const animate = started.current && !reducedMotion()
    const first = !started.current
    started.current = true
    c.minDistance = 18
    c.maxDistance = allDist * 1.2
    c.minPolarAngle = 0.12
    c.maxPolarAngle = 1.5
    c.setBoundary(new THREE.Box3(new THREE.Vector3(bounds.minX - 10, -3, bounds.minZ - 10), new THREE.Vector3(bounds.maxX + 10, topElevation + 8, bounds.maxZ + 10)))
    const newFocus = focus !== null && focus.tick !== lastFocus.current
    if (focus && newFocus) lastFocus.current = focus.tick
    const viewChanged = view !== lastView.current
    lastView.current = view
    const single = view !== ('all' as FloorView)
    // A new view picks the standard tilt; a re-fit (resize, card moved) keeps the user's angles.
    const azimuth = newFocus && focus?.azimuth !== undefined ? focus.azimuth : first ? 0.15 : c.azimuthAngle
    const polar = first || viewChanged || newFocus ? (single ? 0.65 : 0.6) : c.polarAngle
    const card = !hasRoom ? 'none' : snap === 'full' ? 'full' : 'peek'
    const fit = fitPose(view, azimuth, polar, w, h, freeRect(w, h, card, peekH))
    shift.current = { x: fit.shiftX, y: fit.shiftY, jump: !animate }
    void c.rotateTo(azimuth, polar, animate)
    void c.dollyTo(fit.dist, animate)
    void c.moveTo(center.x, single ? elevationOf(view as number) + 1 : topElevation / 2 + 1, center.z, animate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allDist follows the size
  }, [attached, view, ready, w, h, focus, hasRoom, snap, peekH])

  const offset = useRef({ x: 0, y: 0 })
  useFrame(({ camera, size: sz }, dt) => {
    const c = ref.current
    if (!c) return
    const near = c.distance < floorDist * 0.8
    if (near !== zoomed.current) {
      zoomed.current = near
      useAppStore.getState().setZoomedIn(near)
    }
    // Shift the picture so the fitted map sits in the free area; eases when the card moves.
    const o = offset.current
    const t = shift.current
    const x = t.jump ? t.x : ease(o.x, t.x, 9, dt)
    const y = t.jump ? t.y : ease(o.y, t.y, 9, dt)
    if ((x !== o.x || y !== o.y || !camera.view?.enabled) && camera instanceof THREE.PerspectiveCamera) {
      o.x = x
      o.y = y
      camera.setViewOffset(sz.width, sz.height, -x, -y, sz.width, sz.height)
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

/** Demand rendering: any store change or unfinished ease asks for another frame. */
function FrameBridge() {
  const invalidate = useThree((s) => s.invalidate)
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    // After an idle spell the first frame would see a huge delta and finish every glide at once;
    // consuming the clock here makes it see only the time since this wake-up.
    const wake = () => {
      clock.getDelta()
      invalidate()
    }
    setFrameRequester(wake)
    const unsub = useAppStore.subscribe(wake)
    wake()
    return () => {
      unsub()
      setFrameRequester(() => {})
    }
  }, [invalidate, clock])
  return null
}

export default function BuildingScene() {
  return (
    <Canvas
      className="scene"
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [0, 120, 200], fov: FOV, near: 1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useAppStore.getState().selectRoom(null)}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[-40, 80, 60]} intensity={1.1} />
      <FrameBridge />
      <BaseSlab />
      {data.floors.map((f) => (
        <FloorLayer key={f.level} level={f.level} />
      ))}
      <Selection />
      <HerePin />
      <Labels />
      <Rig />
    </Canvas>
  )
}
