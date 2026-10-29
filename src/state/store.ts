import { create } from 'zustand'
import { buildingData as data } from '../data'
import { polygonCentroid } from '../data/geometry'
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

/** Room types a category chip or tile filters the search to. */
export interface TypeFilter {
  labelKey: StringKey
  types: string[]
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
  notice: { key: 'roomGone' | 'deptGone' | 'linkCopied'; tick: number } | null

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
  showNotice: (key: 'roomGone' | 'deptGone' | 'linkCopied') => void
  clearNotice: () => void
  /** Route mode is built separately; until then this opens the destination room. fromId null means "where I am". */
  requestRoute: (fromId: string | null, toId: string) => void
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

  setView: (view) => {
    const { selectedRoomId } = get()
    const sel = data.rooms.find((r) => r.id === selectedRoomId)
    // Leaving a floor clears a selection that would no longer be on show.
    const keep = !sel || view === 'all' || sel.floor === view
    set({ view, banner: null, previousFloor: null, ...(keep ? {} : { selectedRoomId: null }) })
  },

  selectRoom: (id, opts = {}) => {
    const room = id ? data.rooms.find((r) => r.id === id) : undefined
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
    set({
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
  requestRoute: (_fromId, toId) => get().selectRoom(toId, { focus: true, cross: true }),
}))
