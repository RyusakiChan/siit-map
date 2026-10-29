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
import { clamp01, ease, easeOutExpo, floorState, reducedMotion, roomState, setFrameRequester, startTransition, stepTransition, transition } from './motion'

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

interface RoomLive {
  group: THREE.Group | null
  from: { raise: number; dim: number }
  to: { raise: number; dim: number }
  cur: { raise: number; dim: number }
}

interface FloorVals {
  offset: number
  slab: number // slab opacity
  g: number // 0 = rooms flat inside the slab, 1 = full height
  viewed: number // 1 when this is the single floor on show
}

const lerp = THREE.MathUtils.lerp

function FloorLayer({ level }: { level: number }) {
  const elevation = elevationOf(level)
  const root = useRef<THREE.Group>(null)
  const allSlab = level === 1 ? 0.95 : 0.55
  const anim = useRef({
    epoch: -1,
    from: { offset: 0, slab: allSlab, g: 1, viewed: 0 } as FloorVals,
    to: { offset: 0, slab: allSlab, g: 1, viewed: 0 } as FloorVals,
    cur: { offset: 0, slab: allSlab, g: 1, viewed: 0 } as FloorVals,
  })
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

  useFrame(() => {
    const a = anim.current
    if (a.epoch !== transition.epoch) {
      // A new transition: remember where everything is now and where it has to go.
      const { view, selectedRoomId, highlightDeptId } = useAppStore.getState()
      const selected = data.rooms.find((r) => r.id === selectedRoomId)
      const shown = view === 'all' || view === level
      const first = a.epoch === -1
      a.epoch = transition.epoch
      a.from = { ...a.cur }
      a.to = {
        offset: shown ? 0 : Math.sign(level - (view as number)) * 5,
        slab: !shown ? 0 : view === 'all' ? allSlab : 1,
        g: shown ? 1 : 0,
        viewed: view === level ? 1 : 0,
      }
      if (first) a.from = { ...a.to }
      for (const it of items) {
        const l = live.current.get(it.room.id)
        if (!l) continue
        const isSel = it.room.id === selectedRoomId
        const dim = !isSel && ((selected && selected.floor === level) || (highlightDeptId && it.room.departmentId !== highlightDeptId))
        l.from = { ...l.cur }
        l.to = { raise: isSel ? 1 : 0, dim: dim ? 1 : 0 }
        if (first) l.from = { ...l.to }
      }
    }
    const p = transition.p
    const k = easeOutExpo(p)
    // Rooms finish first (about two thirds of the time); a leaving slab fades after them, an arriving slab is solid early.
    const kRoom = easeOutExpo(clamp01(p / 0.66))
    const slabIn = a.to.slab > a.from.slab
    const kSlab = slabIn ? easeOutExpo(clamp01(p / 0.4)) : easeOutExpo(clamp01((p - 0.15) / 0.85))
    const c = a.cur
    c.offset = lerp(a.from.offset, a.to.offset, k)
    c.g = lerp(a.from.g, a.to.g, kRoom)
    c.slab = lerp(a.from.slab, a.to.slab, kSlab)
    c.viewed = lerp(a.from.viewed, a.to.viewed, k)

    if (root.current) {
      root.current.visible = c.g > 0.002 || c.slab > 0.01
      root.current.position.y = c.offset
    }
    floorState.set(level, { offset: c.offset, g: c.g })
    scratch.lerpColors(slabTop.a, slabTop.b, c.viewed)
    slab[0].color.copy(scratch)
    slab[1].color.copy(slabSide)
    setAlpha(slab, c.slab)

    for (const it of items) {
      const l = live.current.get(it.room.id)
      if (!l) continue
      l.cur.raise = lerp(l.from.raise, l.to.raise, k)
      l.cur.dim = lerp(l.from.dim, l.to.dim, k)
      it.top.color.lerpColors(it.colors.top, dimmed.top, l.cur.dim)
      it.side.color.lerpColors(it.colors.side, dimmed.side, l.cur.dim)
      const sy = c.g * (1 + RISE * l.cur.raise)
      if (l.group) {
        l.group.visible = c.g > 0.002
        l.group.scale.y = Math.max(sy, 0.001)
      }
      roomState.set(it.room.id, { top: c.offset + elevation + ROOM_HEIGHT * sy, g: c.g })
    }
  })

  return (
    <group ref={root}>
      <mesh geometry={slabGeometry} material={slab} position={[0, elevation - SLAB_THICKNESS, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />
      {items.map((it) => (
        <group key={it.room.id} ref={(g) => {
          const l = live.current.get(it.room.id) ?? { group: null, from: { raise: 0, dim: 0 }, to: { raise: 0, dim: 0 }, cur: { raise: 0, dim: 0 } }
          l.group = g
          live.current.set(it.room.id, l)
        }} position={[0, elevation, 0]}>
          <mesh
            geometry={it.geometry}
            material={[it.top, it.side]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              if (e.delta > 6 || anim.current.cur.g < 0.5) return // a drag, or a floor that is leaving
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
  const s = useRef({ epoch: -1, from: { alpha: 0, y: 0 }, to: { alpha: 0, y: 0 }, cur: { alpha: 0, y: 0 } })
  useFrame(() => {
    const a = s.current
    if (a.epoch !== transition.epoch) {
      const { view } = useAppStore.getState()
      const first = a.epoch === -1
      a.epoch = transition.epoch
      a.from = { ...a.cur }
      a.to = { alpha: view === 'all' ? 0 : 1, y: (view === 'all' ? 0 : elevationOf(view)) - 0.9 }
      // It is invisible while the whole stack shows, so it never needs to slide into place.
      if (first) a.from = { ...a.to }
      else if (a.from.alpha < 0.05) a.from.y = a.to.y
    }
    const k = easeOutExpo(transition.p)
    a.cur = { alpha: lerp(a.from.alpha, a.to.alpha, k), y: lerp(a.from.y, a.to.y, k) }
    mats[0].color.set(tokens.slabTop)
    mats[1].color.set(tokens.slabSide)
    setAlpha(mats, a.cur.alpha)
    if (ref.current) {
      ref.current.visible = a.cur.alpha > 0.01
      ref.current.position.y = a.cur.y
    }
  })
  return <mesh ref={ref} geometry={geometry} material={mats} rotation={[-Math.PI / 2, 0, 0]} />
}

/** One ink outline and number tag, riding the top of its room. */
function Outline({ room, role }: { room: Room; role: 'in' | 'out' }) {
  const group = useRef<THREE.Group>(null)
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
  useEffect(() => invalidate(), [invalidate])
  useFrame(() => {
    const r = roomState.get(room.id)
    const g = r?.g ?? 0
    const k = easeOutExpo(transition.p)
    const alpha = role === 'in' ? (transition.selChanged ? k : 1) * g : transition.selChanged ? (1 - k) * g : 0
    if (group.current) {
      group.current.position.y = (r?.top ?? 0) + 0.05
      group.current.visible = alpha > 0.01
    }
    if (matRef.current) matRef.current.opacity = alpha
    if (tagRef.current) tagRef.current.style.opacity = String(alpha)
  })
  const points = useMemo(
    () => [...room.polygon, ...room.polygon.slice(0, 1)].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    [room],
  )
  const [cx, cz] = polygonCentroid(room.polygon)
  return (
    <group ref={group}>
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

/** The chosen room's outline fades in while the previous room's fades out; both follow their rooms. */
function Selection() {
  const id = useAppStore((s) => s.selectedRoomId)
  const current = data.rooms.find((r) => r.id === id)
  const [pair, setPair] = useState<{ cur: Room | undefined; prev: Room | undefined }>({ cur: current, prev: undefined })
  if (current?.id !== pair.cur?.id) setPair({ cur: current, prev: pair.cur })
  const { cur, prev } = pair
  return (
    <>
      {cur && <Outline key={cur.id} room={cur} role="in" />}
      {prev && prev.id !== cur?.id && <Outline key={`out-${prev.id}`} room={prev} role="out" />}
    </>
  )
}

/** The "you are here" pin, wide facing cone and a soft pulsing halo (the only looping motion). */
function HerePin() {
  const here = useAppStore((s) => s.here)
  const halo = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
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
    // The pin rides its floor and grows and shrinks with it.
    if (group.current && here) {
      const f = floorState.get(here.floor)
      const g = f?.g ?? 0
      group.current.visible = g > 0.01
      group.current.position.y = elevationOf(here.floor) + 0.15 + (f?.offset ?? 0)
      group.current.scale.setScalar(Math.max(g, 0.001))
    }
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
  if (!here || !geo) return null
  return (
    <group ref={group} position={[here.x, elevationOf(here.floor) + 0.15, here.z]}>
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

const RIBBON_HALF = 0.3 // the ribbon is 0.6 m wide
const RIBBON_COLOR = new THREE.Color(tokens.youAreHere).lerp(new THREE.Color(tokens.slabTopViewed), 0.15) // 85% pink over the floor

/** Flat triangle strip along a polyline; every segment is a quad, joined by overlapping end caps. */
function ribbonGeometry(points: Point[]): THREE.BufferGeometry | null {
  if (points.length < 2) return null
  const pos: number[] = []
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1]!
    const [bx, bz] = points[i]!
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.01) continue
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const nx = -dz * RIBBON_HALF
    const nz = dx * RIBBON_HALF
    const sx = dx * RIBBON_HALF
    const sz = dz * RIBBON_HALF
    const p: Point[] = [
      [ax - sx + nx, az - sz + nz], [ax - sx - nx, az - sz - nz],
      [bx + sx + nx, bz + sz + nz], [bx + sx - nx, bz + sz - nz],
    ]
    for (const k of [0, 1, 2, 2, 1, 3]) pos.push(p[k]![0], 0, p[k]![1])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** The route: a pink ribbon per floor (shown with that floor), the start pin, the end flag and the lift or stairs outlined. */
function RouteLayer() {
  const route = useAppStore((s) => s.route)
  const legs = route?.plan.legs
  const ribbons = useMemo(() => (legs ?? []).map((l) => ribbonGeometry(l.points)), [legs])
  useEffect(() => () => ribbons.forEach((g) => g?.dispose()), [ribbons])
  const refs = useRef<(THREE.Group | null)[]>([])
  const startRef = useRef<THREE.Group>(null)
  const flagRef = useRef<THREE.Group>(null)
  const flag = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 3.2), new THREE.Vector2(2.6, 2.6), new THREE.Vector2(0, 2)])
    return { pole: new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), cloth: new THREE.ShapeGeometry(shape), dot: new THREE.CircleGeometry(0.9, 24), ring: new THREE.RingGeometry(0.9, 1.3, 24) }
  }, [])
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [invalidate, route])

  const at = (i: number, last: boolean) => {
    const leg = legs![i]!
    return last ? leg.points[leg.points.length - 1]! : leg.points[0]!
  }
  useFrame(() => {
    if (!legs) return
    legs.forEach((leg, i) => {
      const f = floorState.get(leg.floor)
      const g = f?.g ?? 0
      const grp = refs.current[i]
      if (grp) {
        grp.visible = g > 0.01
        grp.position.y = elevationOf(leg.floor) + 0.2 + (f?.offset ?? 0)
        grp.scale.set(1, 1, 1)
      }
    })
    const place = (grp: THREE.Group | null, leg: number, y: number, size = 1) => {
      if (!grp) return
      const f = floorState.get(legs[leg]!.floor)
      const g = f?.g ?? 0
      grp.visible = g > 0.01
      grp.position.y = elevationOf(legs[leg]!.floor) + y + (f?.offset ?? 0)
      grp.scale.setScalar(Math.max(g, 0.001) * size)
    }
    place(startRef.current, 0, 0.25)
    place(flagRef.current, legs.length - 1, ROOM_HEIGHT * (1 + RISE) + 0.1, 1.6)
  })

  if (!route || !legs) return null
  const start = at(0, false)
  const last = legs[legs.length - 1]!.points
  const tip = last[last.length - 1]!
  const before = last[last.length - 2] ?? tip
  const back = Math.hypot(before[0] - tip[0], before[1] - tip[1]) || 1
  // The flag stands a little toward the door, so the room's number tag does not cover it.
  const end: Point = [tip[0] + ((before[0] - tip[0]) / back) * 3, tip[1] + ((before[1] - tip[1]) / back) * 3]
  // The lift or stairs of each leg: the room it leaves by, and the room it arrives in.
  const connectorRooms = new Set(legs.flatMap((l, i) => [l.ride ? l.endRoomId : null, i > 0 ? l.startRoomId : null]).filter((x): x is string => !!x))
  return (
    <>
      {legs.map((_leg, i) => {
        const geo = ribbons[i]
        return (
          <group key={i} ref={(g) => { refs.current[i] = g }} visible={false}>
            {geo && (
              <mesh geometry={geo} renderOrder={4}>
                <meshBasicMaterial color={RIBBON_COLOR} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
              </mesh>
            )}
          </group>
        )
      })}
      <group ref={startRef} position={[start[0], 0.25, start[1]]}>
        <mesh geometry={flag.ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
          <meshBasicMaterial color="#ffffff" depthTest={false} toneMapped={false} />
        </mesh>
        <mesh geometry={flag.dot} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={8}>
          <meshBasicMaterial color={tokens.youAreHere} depthTest={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={flagRef} position={[end[0], 0, end[1]]}>
        <mesh geometry={flag.pole} position={[0, 1.7, 0]} renderOrder={9}>
          <meshBasicMaterial color={tokens.ink} depthTest={false} toneMapped={false} />
        </mesh>
        <mesh geometry={flag.cloth} renderOrder={9}>
          <meshBasicMaterial color={tokens.youAreHere} depthTest={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      {[...connectorRooms].map((id) => {
        const room = data.rooms.find((r) => r.id === id)
        return room && id !== route.toId ? <Outline key={`route-${id}`} room={room} role="in" /> : null
      })}
    </>
  )
}

/** Badges for one floor; they fade with that floor's rooms and ride its slide. */
function FloorLabels({ floor }: { floor: number }) {
  const zoomedIn = useAppStore((s) => s.zoomedIn)
  const selectedId = useAppStore((s) => s.selectedRoomId)
  const group = useRef<THREE.Group>(null)
  const els = useRef(new Set<HTMLElement>())
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [invalidate, zoomedIn, selectedId])
  const rooms = useMemo(
    () =>
      data.rooms
        .filter((r) => r.floor === floor)
        .map((room) => ({
          room,
          big: polygonArea(room.polygon) >= BIG_ROOM_AREA,
          at: polygonCentroid(room.polygon),
          letter: data.departments.find((d) => d.id === room.departmentId)?.letter,
        })),
    [floor],
  )
  useFrame(() => {
    const f = floorState.get(floor)
    if (group.current) group.current.position.y = f?.offset ?? 0
    const o = String(f?.g ?? 0)
    for (const el of els.current) {
      if (el.isConnected) el.style.opacity = o
      else els.current.delete(el)
    }
  })
  const y = elevationOf(floor) + ROOM_HEIGHT + 0.1
  return (
    <group ref={group}>
      {rooms.map(({ room, big, at, letter }) => {
        if (room.id === selectedId || !(big || zoomedIn)) return null
        const keep = (e: HTMLElement | null) => {
          if (e) els.current.add(e)
        }
        const badge = letter ? (
          <span ref={keep} className="map-badge" style={{ borderColor: departmentBadgeColor(room.departmentId), opacity: 0 }}>{letter}</span>
        ) : hasIcon(room.type) ? (
          <span ref={keep} className="map-icon" style={{ opacity: 0 }}><FacilityIcon type={room.type} /></span>
        ) : null
        return badge && (
          <Html key={room.id} position={[at[0], y, at[1]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            {badge}
          </Html>
        )
      })}
    </group>
  )
}

/** Labels of the floor on show; the floor just left keeps its labels until they have faded with its rooms. */
function Labels() {
  const view = useAppStore((s) => s.view)
  const [pair, setPair] = useState<{ cur: FloorView; prev: FloorView | null }>({ cur: view, prev: null })
  if (view !== pair.cur) setPair({ cur: view, prev: pair.cur })
  useFrame(() => {
    if (pair.prev !== null && transition.p >= 1) setPair((s) => (s.prev === null ? s : { ...s, prev: null }))
  })
  return (
    <>
      {pair.prev !== null && pair.prev !== 'all' && <FloorLabels key={pair.prev} floor={pair.prev} />}
      {pair.cur !== 'all' && <FloorLabels key={pair.cur} floor={pair.cur} />}
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
  const invalidate = useThree((s) => s.invalidate)
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
  const offset = useRef({ x: 0, y: 0 })

  // A glide driven by the shared transition value; null when the camera moves on its own.
  const glide = useRef<null | {
    az: number; polar: number; dist: number; tx: number; ty: number; tz: number
    from: { az: number; polar: number; dist: number; tx: number; ty: number; tz: number }
    k0: number; sx0: number; sy0: number
  }>(null)
  const focus = useAppStore((s) => s.focus)
  const lastFocus = useRef(0)
  const lastView = useRef<FloorView | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c || !ready) return
    // Dev-only handle so browser tests can read the camera.
    if (import.meta.env.DEV) {
      Object.assign(window, { __rig: c, __store: useAppStore })
    }
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
    const ty = single ? elevationOf(view as number) + 1 : topElevation / 2 + 1
    shift.current = { x: fit.shiftX, y: fit.shiftY, jump: !animate }
    if (animate && transition.p < 0.5) {
      // Same frame, same curve as the floors and the room: the camera reads the shared progress too.
      const t = c.getTarget(new THREE.Vector3())
      glide.current = {
        az: azimuth, polar, dist: fit.dist, tx: center.x, ty, tz: center.z,
        from: { az: c.azimuthAngle, polar: c.polarAngle, dist: c.distance, tx: t.x, ty: t.y, tz: t.z },
        k0: easeOutExpo(transition.p), sx0: offset.current.x, sy0: offset.current.y,
      }
      invalidate()
    } else {
      glide.current = null
      void c.rotateTo(azimuth, polar, animate)
      void c.dollyTo(fit.dist, animate)
      void c.moveTo(center.x, ty, center.z, animate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allDist follows the size
  }, [attached, view, ready, w, h, focus, hasRoom, snap, peekH])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const stop = () => { glide.current = null }
    c.addEventListener('controlstart', stop)
    return () => c.removeEventListener('controlstart', stop)
  }, [attached])

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
    let x = t.jump ? t.x : ease(o.x, t.x, 9, dt)
    let y = t.jump ? t.y : ease(o.y, t.y, 9, dt)
    const g = glide.current
    if (g) {
      const k = clamp01((easeOutExpo(transition.p) - g.k0) / (1 - g.k0 || 1))
      const f = g.from
      let da = g.az - f.az
      da = Math.atan2(Math.sin(da), Math.cos(da)) // the short way round
      void c.rotateTo(f.az + da * k, lerp(f.polar, g.polar, k), false)
      void c.dollyTo(lerp(f.dist, g.dist, k), false)
      void c.moveTo(lerp(f.tx, g.tx, k), lerp(f.ty, g.ty, k), lerp(f.tz, g.tz, k), false)
      x = lerp(g.sx0, t.x, k)
      y = lerp(g.sy0, t.y, k)
      if (transition.p >= 1) glide.current = null
    }
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
  const getThree = useThree((s) => s.get)
  // Dev-only: lets browser tests render a frame and read the canvas back right away.
  if (import.meta.env.DEV) Object.assign(window, { __getThree: getThree })
  useEffect(() => {
    // After an idle spell the first frame would see a huge delta and finish every glide at once;
    // consuming the clock here makes it see only the time since this wake-up.
    const wake = () => {
      clock.getDelta()
      invalidate()
    }
    setFrameRequester(wake)
    // A change of floor, room, department highlight or camera target starts one shared transition.
    const unsub = useAppStore.subscribe((s, prev) => {
      const viewChanged = s.view !== prev.view
      const selChanged = s.selectedRoomId !== prev.selectedRoomId
      if (viewChanged || selChanged || s.highlightDeptId !== prev.highlightDeptId || s.focus !== prev.focus) {
        startTransition(viewChanged ? 0.45 : 0.3, viewChanged, selChanged)
      }
      wake()
    })
    wake()
    return () => {
      unsub()
      setFrameRequester(() => {})
    }
  }, [invalidate, clock])
  useFrame((_, dt) => stepTransition(dt))
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
      <RouteLayer />
      <Labels />
      <Rig />
    </Canvas>
  )
}
