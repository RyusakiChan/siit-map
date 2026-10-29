import { create } from 'zustand'
import { buildingData as data } from '../data'
import { polygonCentroid } from '../data/geometry'
import { planRoute, type RouteEnd, type RoutePlan } from '../nav'
import { go, routeHashPath } from '../router'
import type { Lang, StringKey } from '../i18n/strings'
import { readStore, writeStore } from '../storage'

/** 'all' shows the stacked building; a number shows that floor alone. */
export type FloorView = 'all' | number
export type Snap = 'peek' | 'full'

/** A request to glide the camera somewhere; `tick` makes repeats count. */
export interface Focus {
  tick: number
  x: number
  z: number
  floor: number
  /** Camera azimuth in radians (0 looks north); omitted keeps the current one. */
  azimuth?: number
}

export interface HerePin {
  id: string
  floor: number
  x: number
  z: number
  facingDeg: number
}

export type NoticeKey = 'roomGone' | 'deptGone' | 'linkCopied' | 'routeNone'

/** Room types a category chip or tile filters the search to. */
export interface TypeFilter {
  labelKey: StringKey
  types: string[]
}

/** A route on show: where it starts, where it goes, its directions and the step the person is on. */
export interface ActiveRoute {
  from: RouteEnd
  toId: string
  plan: RoutePlan
  step: number
}

/** A QR scan counts as "where you are" for this long. */
const SCAN_TTL_MS = 30 * 60 * 1000
const SCAN_KEY = 'siit-map.lastScan'
const STAIRS_KEY = 'siit-map.avoidStairs'
const qrIds = new Set(data.qrPoints.map((q) => q.id))

function loadScan(): { id: string; at: number } | null {
  try {
    const v: unknown = JSON.parse(readStore(SCAN_KEY) ?? 'null')
    const o = v as { id?: unknown; at?: unknown } | null
    return o && typeof o.id === 'string' && typeof o.at === 'number' ? { id: o.id, at: o.at } : null
  } catch {
    return null
  }
}

/** Route link segment for a start: `@<qr id>` for a QR spot, the room id otherwise. */
export const fromToken = (from: RouteEnd): string => (from.kind === 'qr' ? `@${from.id}` : from.id)

/** Reads a route link's start: `@<qr id>` is a QR spot; anything else is a room id. */
export function parseFrom(token: string): RouteEnd | null {
  if (token.startsWith('@')) return qrIds.has(token.slice(1)) ? { kind: 'qr', id: token.slice(1) } : null
  return data.rooms.some((r) => r.id === token) ? { kind: 'room', id: token } : null
}

interface AppState {
  view: FloorView
  selectedRoomId: string | null
  snap: Snap
  /** Height (px) of the peek card, so the map can be framed above it. */
  peekH: number
  /** True when the camera is close enough to show small-room labels. */
  zoomedIn: boolean
  lang: Lang
  searchOpen: boolean
  filter: TypeFilter | null
  keyOpen: boolean
  /** Floor you came from after a cross-floor result, shown as a dot on the picker. */
  previousFloor: number | null
  banner: { floor: number; from: number } | null
  here: HerePin | null
  highlightDeptId: string | null
  focus: Focus | null
  notice: { key: NoticeKey; tick: number } | null
  /** The QR point last scanned and when (remembered on this phone for 30 minutes). */
  lastScan: { id: string; at: number } | null
  route: ActiveRoute | null
  /** "Avoid stairs": routes use lifts only. Remembered on this phone. */
  avoidStairs: boolean
  /** Set while the From picker is open: the destination the person is choosing a start for. */
  fromPicker: { toId: string } | null

  setView: (view: FloorView) => void
  /** Selecting a room also switches to its floor. */
  selectRoom: (id: string | null, opts?: { focus?: boolean; cross?: boolean; snap?: Snap }) => void
  setSnap: (snap: Snap) => void
  setPeekH: (px: number) => void
  setZoomedIn: (zoomedIn: boolean) => void
  setLang: (lang: Lang) => void
  openSearch: (filter?: TypeFilter | null) => void
  closeSearch: () => void
  setKeyOpen: (open: boolean) => void
  dismissBanner: () => void
  showHere: (qrId: string) => boolean
  highlightDept: (id: string | null) => void
  showNotice: (key: NoticeKey) => void
  clearNotice: () => void
  /**
   * Asks for a route by changing the hash (so Back and Share work); RouteEffects then calls `applyRoute`.
   * fromId null means "where I am": the QR spot scanned in the last 30 minutes, else the From picker opens.
   */
  requestRoute: (fromId: string | null, toId: string) => void
  /** Plans and shows a route (called when the hash says so). Returns false when there is none. */
  applyRoute: (from: RouteEnd, toId: string) => boolean
  setRouteStep: (step: number) => void
  /** Leaves route mode and shows the destination's room card. */
  endRoute: () => void
  /** Drops the route state without touching the hash (Back already moved it). */
  clearRoute: () => void
  setAvoidStairs: (avoid: boolean) => void
  openFromPicker: (toId: string) => void
  closeFromPicker: () => void
}

let tick = 0

function loadLang(): Lang {
  // English by default (PLAN.md); only a remembered choice changes it.
  return readStore('siit-map.lang') === 'th' ? 'th' : 'en'
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'all',
  selectedRoomId: null,
  snap: 'peek',
  peekH: 130,
  zoomedIn: false,
  lang: loadLang(),
  searchOpen: false,
  filter: null,
  keyOpen: false,
  previousFloor: null,
  banner: null,
  here: null,
  highlightDeptId: null,
  focus: null,
  notice: null,
  lastScan: loadScan(),
  route: null,
  avoidStairs: readStore(STAIRS_KEY) === '1',
  fromPicker: null,

  setView: (view) => {
    const { selectedRoomId, route } = get()
    const sel = data.rooms.find((r) => r.id === selectedRoomId)
    // Leaving a floor clears a selection that would no longer be on show.
    const keep = !sel || view === 'all' || sel.floor === view || route !== null
    set({ view, banner: null, previousFloor: null, ...(keep ? {} : { selectedRoomId: null }) })
  },

  selectRoom: (id, opts = {}) => {
    const room = id ? data.rooms.find((r) => r.id === id) : undefined
    const active = get().route
    if (active) {
      // In route mode a tap on empty map keeps the route; choosing another room ends it.
      if (!room || room.id === active.toId) return
      set({ route: null })
      go('/', true)
    }
    if (!room) {
      set({ selectedRoomId: null, snap: 'peek' })
      return
    }
    const { view, here } = get()
    const from = typeof view === 'number' ? view : (here?.floor ?? null)
    const cross = opts.cross && from !== null && from !== room.floor
    const [x, z] = polygonCentroid(room.polygon)
    set({
      selectedRoomId: room.id,
      view: room.floor,
      snap: opts.snap ?? 'peek',
      banner: cross ? { floor: room.floor, from } : null,
      previousFloor: cross ? from : null,
      ...(opts.focus ? { focus: { tick: ++tick, x, z, floor: room.floor } } : {}),
    })
  },

  setSnap: (snap) => set({ snap }),
  setPeekH: (peekH) => set({ peekH }),
  setZoomedIn: (zoomedIn) => set({ zoomedIn }),
  setLang: (lang) => {
    writeStore('siit-map.lang', lang)
    set({ lang })
  },
  openSearch: (filter = null) => set({ searchOpen: true, filter }),
  closeSearch: () => set({ searchOpen: false, filter: null }),
  setKeyOpen: (keyOpen) => set({ keyOpen }),
  dismissBanner: () => set({ banner: null }),

  /** Returns false for an unknown QR id (the caller then shows the normal map). */
  showHere: (qrId) => {
    const qr = data.qrPoints.find((q) => q.id === qrId)
    if (!qr) return false
    const scan = { id: qr.id, at: Date.now() }
    writeStore(SCAN_KEY, JSON.stringify(scan))
    set({
      lastScan: scan,
      route: null,
      here: { id: qr.id, floor: qr.floor, x: qr.position[0], z: qr.position[1], facingDeg: qr.facingDeg },
      view: qr.floor,
      selectedRoomId: null,
      banner: null,
      previousFloor: null,
      focus: { tick: ++tick, x: qr.position[0], z: qr.position[1], floor: qr.floor, azimuth: (qr.facingDeg * Math.PI) / 180 },
    })
    return true
  },

  highlightDept: (highlightDeptId) => set({ highlightDeptId, ...(highlightDeptId ? { selectedRoomId: null, view: 'all' as const } : {}) }),
  showNotice: (key) => set({ notice: { key, tick: ++tick } }),
  clearNotice: () => set({ notice: null }),
  requestRoute: (fromId, toId) => {
    if (!data.rooms.some((r) => r.id === toId)) {
      get().showNotice('roomGone')
      return
    }
    const scan = fromId === null ? recentScanId() : null
    if (fromId === null && !scan) {
      // No start known: show the destination and ask where from.
      get().selectRoom(toId, { focus: true, cross: true })
      get().openFromPicker(toId)
      return
    }
    // The assistant names a room id; a room id wins over a QR id with the same text.
    const token = scan ? `@${scan}` : (fromId as string)
    if (!parseFrom(token)) {
      get().showNotice('routeNone')
      return
    }
    go(routeHashPath(token, toId))
  },

  applyRoute: (from, toId) => {
    const plan = planRoute(from, toId, { avoidStairs: get().avoidStairs })
    if (!plan || plan.steps.length === 0) {
      get().showNotice('routeNone')
      return false
    }
    const step = plan.steps[0]!
    set({
      route: { from, toId, plan, step: 0 },
      fromPicker: null,
      searchOpen: false,
      filter: null,
      selectedRoomId: toId,
      snap: 'peek',
      banner: null,
      previousFloor: null,
      highlightDeptId: null,
      view: step.floor,
      focus: { tick: ++tick, x: step.point[0], z: step.point[1], floor: step.floor },
    })
    return true
  },

  setRouteStep: (index) => {
    const { route } = get()
    if (!route) return
    const i = Math.max(0, Math.min(route.plan.steps.length - 1, index))
    const step = route.plan.steps[i]!
    set({
      route: { ...route, step: i },
      view: step.floor,
      focus: { tick: ++tick, x: step.point[0], z: step.point[1], floor: step.floor },
    })
  },

  endRoute: () => {
    const { route } = get()
    if (!route) return
    set({ route: null })
    go(`/room/${encodeURIComponent(route.toId)}`, true)
  },

  clearRoute: () => {
    if (get().route) set({ route: null })
  },

  setAvoidStairs: (avoidStairs) => {
    writeStore(STAIRS_KEY, avoidStairs ? '1' : '0')
    set({ avoidStairs })
    const { route } = get()
    if (route) get().applyRoute(route.from, route.toId)
  },

  openFromPicker: (toId) => set({ fromPicker: { toId }, searchOpen: false }),
  closeFromPicker: () => set({ fromPicker: null }),
}))

/** The QR point scanned in the last 30 minutes (this visit or an earlier one), if any. */
export function recentScanId(now = Date.now()): string | null {
  const scan = useAppStore.getState().lastScan
  return scan && qrIds.has(scan.id) && now - scan.at < SCAN_TTL_MS ? scan.id : null
}
