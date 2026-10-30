import { create } from 'zustand'
import type { BuildingData, Department, Point, QrPoint, Room, RoomType, WalkEdge, WalkNode } from '../data/types.ts'
import { problemsForFloor, validate, type Problem } from '../data/validate.ts'
import { applyAffine, compose, IDENTITY, invertAffine, rotateAbout, scaleAbout, solveAffine, translate, type Affine } from './affine.ts'
import { nextConnectorId, nextNodeId, nextRoomId, qrIdProblem } from './ids.ts'
import { replaceDepartments, replaceFloor, sliceFloor, type FloorSlice } from './saveFloor.ts'
import { deleteBlock, departmentId, freeLetter, freeSlot } from '../data/departments.ts'
import { addEdge, nearestEdge, planDoor, splitEdge } from './walk.ts'

export type Tool = 'select' | 'room' | 'node' | 'edge' | 'door' | 'connector' | 'qr' | 'align'
export type Selection = { kind: 'room'; id: string; vertex?: number } | { kind: 'node'; id: string } | { kind: 'qr'; id: string } | null

interface Snapshot {
  draft: BuildingData
  opened: number[]
}

export interface Photo {
  url: string
  name: string
  w: number
  h: number
  /** Photo pixels -> metres. */
  matrix: Affine
  opacity: number
}

export interface AlignState {
  photoPts: Point[]
  worldPts: Point[]
}

export interface View {
  tx: number
  ty: number
  s: number
}

const DRAFT_KEY = (floor: number) => `siit-trace-draft-f${floor}`
const DEPT_DRAFT_KEY = 'siit-trace-draft-departments'
const PHOTO_KEY = (floor: number) => `siit-trace-photo-f${floor}`

const lsGet = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}
const lsSet = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* private mode: no draft */ }
}

/** Metres of the building: bounding box of the outline. */
export function outlineBox(outline: Point[]) {
  const xs = outline.map((p) => p[0])
  const zs = outline.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}

/** Remove everything the tool owns on one floor (used when an untraced floor is first opened). */
function clearFloor(d: BuildingData, floor: number): BuildingData {
  return {
    ...d,
    rooms: d.rooms.filter((r) => r.floor !== floor),
    qrPoints: d.qrPoints.filter((q) => q.floor !== floor),
    walkways: {
      ...d.walkways,
      nodes: d.walkways.nodes.filter((n) => n.floor !== floor),
      edges: d.walkways.edges.filter((e) => !d.walkways.nodes.some((n) => n.floor === floor && (n.id === e.a || n.id === e.b))),
      connectors: d.walkways.connectors.map((c) => {
        const { [String(floor)]: _gone, ...rest } = c.nodes
        void _gone
        return { ...c, nodes: rest }
      }),
    },
  }
}

interface TraceState {
  saved: BuildingData | null
  draft: BuildingData
  opened: number[]
  floor: number
  past: Snapshot[]
  future: Snapshot[]
  lastEditKey: string | null
  lastEditAt: number
  tool: Tool
  selection: Selection
  drawing: Point[]
  edgeFrom: string | null
  pendingQr: { position: Point; facingDeg: number } | null
  activeConnector: string | null
  view: View
  photo: Photo | null
  align: AlignState
  status: string
  restored: number[]
  focus: { tick: number; point: Point } | null
  showDepts: boolean
  selectedDept: string | null
  deptsRestored: boolean

  init: (saved: BuildingData) => void
  setFloor: (floor: number) => void
  setTool: (t: Tool) => void
  select: (s: Selection) => void
  setView: (v: View) => void
  fitView: (w: number, h: number) => void
  zoomTo: (p: Point, w: number, h: number) => void
  setStatus: (s: string) => void

  edit: (fn: (d: BuildingData) => BuildingData, key?: string) => void
  checkpoint: () => void
  live: (fn: (d: BuildingData) => BuildingData) => void
  undo: () => void
  redo: () => void

  addDrawPoint: (p: Point) => void
  popDrawPoint: () => void
  cancelDrawing: () => void
  closeRoom: () => void
  updateRoom: (id: string, patch: Partial<Room>) => void
  moveVertex: (id: string, i: number, p: Point) => void
  insertVertex: (id: string, i: number, p: Point) => void
  deleteVertex: (id: string, i: number) => void
  deleteSelection: () => void

  placeNode: (p: Point, radius: number) => void
  edgeClick: (nodeId: string) => void
  moveNode: (id: string, p: Point) => void
  placeDoor: (roomId: string, click: Point) => void

  newConnector: (kind: 'stairs' | 'elevator') => void
  updateConnector: (id: string, patch: { costPerFloor?: number }) => void
  assignConnector: (roomId: string) => void
  removeConnectorFloor: (id: string, floor: number) => void

  startQr: (p: Point) => void
  setPendingQrFacing: (deg: number) => void
  addQr: (id: string) => string | null
  updateQr: (id: string, patch: Partial<QrPoint>) => void

  setPhoto: (p: Photo | null) => void
  updatePhoto: (patch: Partial<Photo>) => void
  adjustPhoto: (m: Affine) => void
  addAlignPoint: (kind: 'photo' | 'world', p: Point) => void
  resetAlign: () => void

  setShowDepts: (v: boolean) => void
  selectDept: (id: string | null) => void
  addDepartment: (name: string) => string
  updateDepartment: (id: string, patch: Partial<Department>) => void
  deleteDepartment: (id: string) => string | null
  markDepartmentsSaved: (saved: BuildingData) => void

  slice: () => FloorSlice
  markSaved: (saved: BuildingData, slice: FloorSlice) => void
  discardDraft: (floor: number) => void
}

const HISTORY = 200
/** Every placed point is kept to the nearest centimetre. */
const rnd = (p: Point): Point => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]

export const useTrace = create<TraceState>((set, get) => {
  const empty = null as unknown as BuildingData
  const snap = (): Snapshot => ({ draft: get().draft, opened: get().opened })
  const pushHistory = () => set((s) => ({ past: [...s.past.slice(-HISTORY), snap()], future: [], lastEditKey: null }))

  const edit = (fn: (d: BuildingData) => BuildingData, key?: string) => {
    const s = get()
    const now = Date.now()
    const coalesce = key !== undefined && key === s.lastEditKey && now - s.lastEditAt < 1200
    if (!coalesce) pushHistory()
    set({ draft: fn(get().draft), lastEditKey: key ?? null, lastEditAt: now })
  }

  const photoSave = () => {
    const { photo, floor } = get()
    if (photo) lsSet(PHOTO_KEY(floor), JSON.stringify({ matrix: photo.matrix, opacity: photo.opacity }))
  }

  const room = (id: string) => get().draft.rooms.find((r) => r.id === id)
  const withNodes = (d: BuildingData, nodes: WalkNode[], edges: WalkEdge[]): BuildingData => ({ ...d, walkways: { ...d.walkways, nodes, edges } })

  /** Remove a walk node and everything that points at it. */
  const dropNode = (d: BuildingData, id: string): BuildingData => ({
    ...d,
    rooms: d.rooms.map((r) => (r.door === id ? (({ door: _door, ...rest }) => (void _door, rest))(r) : r)),
    walkways: {
      nodes: d.walkways.nodes.filter((n) => n.id !== id),
      edges: d.walkways.edges.filter((e) => e.a !== id && e.b !== id),
      connectors: d.walkways.connectors.map((c) => ({ ...c, nodes: Object.fromEntries(Object.entries(c.nodes).filter(([, n]) => n !== id)) })),
    },
  })

  return {
    saved: null,
    draft: empty,
    opened: [],
    floor: 2,
    past: [],
    future: [],
    lastEditKey: null,
    lastEditAt: 0,
    tool: 'select',
    selection: null,
    drawing: [],
    edgeFrom: null,
    pendingQr: null,
    activeConnector: null,
    view: { tx: 0, ty: 0, s: 10 },
    photo: null,
    align: { photoPts: [], worldPts: [] },
    status: '',
    restored: [],
    focus: null,
    showDepts: false,
    selectedDept: null,
    deptsRestored: false,

    init: (saved) => {
      let draft = saved
      const opened: number[] = []
      const restored: number[] = []
      for (const f of saved.floors) {
        const raw = lsGet(DRAFT_KEY(f.level))
        if (!raw) continue
        try {
          draft = replaceFloor(draft, JSON.parse(raw) as FloorSlice, false)
          opened.push(f.level)
          restored.push(f.level)
        } catch { /* unreadable draft: ignore */ }
      }
      let deptsRestored = false
      const rawDepts = lsGet(DEPT_DRAFT_KEY)
      if (rawDepts) {
        try {
          draft = { ...draft, departments: JSON.parse(rawDepts) as Department[] }
          deptsRestored = true
        } catch { /* ignore */ }
      }
      const floor = restored[0] ?? saved.floors.find((f) => !f.traced)?.level ?? 2
      if (!opened.includes(floor) && !saved.floors.find((f) => f.level === floor)?.traced) {
        draft = clearFloor(draft, floor)
        opened.push(floor)
      }
      set({ saved, draft, opened, floor, restored, deptsRestored, past: [], future: [], status: restored.length ? `Restored your unsaved work on floor ${restored.join(', ')}.` : '' })
    },

    setFloor: (floor) => {
      const s = get()
      if (floor === s.floor) return
      photoSave()
      let { draft, opened } = s
      const traced = draft.floors.find((f) => f.level === floor)?.traced
      if (!traced && !opened.includes(floor)) {
        // A floor that is not traced yet starts empty: the sample rooms are never copied into real data.
        pushHistory()
        draft = clearFloor(draft, floor)
        opened = [...opened, floor]
      } else if (traced && !opened.includes(floor)) opened = [...opened, floor]
      set({ floor, draft, opened, selection: null, drawing: [], edgeFrom: null, pendingQr: null, activeConnector: null, photo: null, align: { photoPts: [], worldPts: [] }, tool: 'select' })
    },
    setTool: (tool) => set({ tool, drawing: [], edgeFrom: null, pendingQr: null, align: tool === 'align' ? { photoPts: [], worldPts: [] } : get().align }),
    select: (selection) => set({ selection }),
    setView: (view) => set({ view }),
    fitView: (w, h) => {
      const b = outlineBox(get().draft.building.outline)
      const s = Math.min((w - 40) / (b.x1 - b.x0), (h - 40) / (b.z1 - b.z0))
      set({ view: { s, tx: (w - (b.x1 - b.x0) * s) / 2 - b.x0 * s, ty: (h - (b.z1 - b.z0) * s) / 2 - b.z0 * s } })
    },
    zoomTo: (p, w, h) => {
      const s = Math.max(get().view.s, 22)
      set({ view: { s, tx: w / 2 - p[0] * s, ty: h / 2 - p[1] * s }, focus: { tick: Date.now(), point: p } })
    },
    setStatus: (status) => set({ status }),

    edit,
    checkpoint: pushHistory,
    live: (fn) => set({ draft: fn(get().draft) }),
    undo: () => {
      const { past, future } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({ past: past.slice(0, -1), future: [snap(), ...future], draft: prev.draft, opened: prev.opened, selection: null, drawing: [], edgeFrom: null, lastEditKey: null })
    },
    redo: () => {
      const { past, future } = get()
      const next = future[0]
      if (!next) return
      set({ past: [...past, snap()], future: future.slice(1), draft: next.draft, opened: next.opened, selection: null, lastEditKey: null })
    },

    addDrawPoint: (p) => {
      const d = get().drawing
      const last = d[d.length - 1]
      if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 0.02) return
      set({ drawing: [...d, rnd(p)] })
    },
    popDrawPoint: () => set({ drawing: get().drawing.slice(0, -1) }),
    cancelDrawing: () => set({ drawing: [], edgeFrom: null, pendingQr: null, selection: null }),
    closeRoom: () => {
      const { drawing, floor, draft } = get()
      if (drawing.length < 3) return
      const id = nextRoomId(draft, floor)
      const r: Room = { id, number: null, name: '', floor, departmentId: null, type: 'other', polygon: drawing }
      edit((d) => ({ ...d, rooms: [...d.rooms, r] }))
      set({ drawing: [], selection: { kind: 'room', id } })
    },
    updateRoom: (id, patch) => edit((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }), `room:${id}:${Object.keys(patch).join()}`),
    moveVertex: (id, i, p) => get().live((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, polygon: r.polygon.map((q, k) => (k === i ? rnd(p) : q)) } : r)) })),
    insertVertex: (id, i, p) => {
      edit((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, polygon: [...r.polygon.slice(0, i + 1), rnd(p), ...r.polygon.slice(i + 1)] } : r)) }))
      set({ selection: { kind: 'room', id, vertex: i + 1 } })
    },
    deleteVertex: (id, i) => {
      const r = room(id)
      if (!r || r.polygon.length <= 3) return
      edit((d) => ({ ...d, rooms: d.rooms.map((x) => (x.id === id ? { ...x, polygon: x.polygon.filter((_, k) => k !== i) } : x)) }))
      set({ selection: { kind: 'room', id } })
    },
    deleteSelection: () => {
      const { selection: sel } = get()
      if (!sel) return
      if (sel.kind === 'room') {
        if (sel.vertex !== undefined) return get().deleteVertex(sel.id, sel.vertex)
        const r = room(sel.id)
        edit((d) => {
          // The room's door node goes with it; its id stays in usedIds when saved.
          const gone = { ...d, rooms: d.rooms.filter((x) => x.id !== sel.id), usedIds: [...new Set([...(d.usedIds ?? []), sel.id])] }
          return r?.door ? dropNode(gone, r.door) : gone
        })
      } else if (sel.kind === 'node') edit((d) => dropNode(d, sel.id))
      else edit((d) => ({ ...d, qrPoints: d.qrPoints.filter((q) => q.id !== sel.id), usedIds: [...new Set([...(d.usedIds ?? []), sel.id])] }))
      set({ selection: null })
    },

    placeNode: (p, radius) => {
      const { draft, floor } = get()
      const nodes = draft.walkways.nodes.filter((n) => n.floor === floor)
      const hit = nearestEdge(p, nodes, draft.walkways.edges, radius)
      const id = nextNodeId(draft, floor, 'c')
      const position: Point = rnd(hit ? hit.point : p)
      edit((d) => {
        const edges = hit ? splitEdge(d.walkways.edges, hit.edge, id) : d.walkways.edges
        return withNodes(d, [...d.walkways.nodes, { id, floor, position }], edges)
      })
      set({ selection: { kind: 'node', id } })
    },
    edgeClick: (nodeId) => {
      const from = get().edgeFrom
      if (!from) return set({ edgeFrom: nodeId, selection: { kind: 'node', id: nodeId } })
      if (from === nodeId) return set({ edgeFrom: null })
      edit((d) => withNodes(d, d.walkways.nodes, addEdge(d.walkways.edges, from, nodeId)))
      set({ edgeFrom: nodeId })
    },
    moveNode: (id, p) => get().live((d) => withNodes(d, d.walkways.nodes.map((n) => (n.id === id ? { ...n, position: rnd(p) } : n)), d.walkways.edges)),
    placeDoor: (roomId, click) => {
      const { draft, floor } = get()
      const r = room(roomId)
      if (!r) return
      const door = new Set(draft.rooms.map((x) => x.door))
      const nodes = draft.walkways.nodes.filter((n) => n.floor === floor)
      const plan = planDoor(r.polygon, click, nodes.filter((n) => !door.has(n.id)), draft.rooms.filter((x) => x.floor === floor && x.id !== roomId).map((x) => x.polygon))
      if (!plan) return
      const id = nextNodeId(draft, floor, 'd')
      edit((d) => {
        let base = d
        const old = r.door
        if (old) {
          base = dropNode(base, old)
        }
        let edges = base.walkways.edges
        if (plan.linkTo) edges = addEdge(edges, id, plan.linkTo)
        const next = withNodes(base, [...base.walkways.nodes, { id, floor, position: rnd(plan.position) }], edges)
        const connectors = next.walkways.connectors.map((c) => {
          const key = Object.entries(c.nodes).find(([, n]) => n === old)?.[0]
          return key && old ? { ...c, nodes: { ...c.nodes, [key]: id } } : c
        })
        return { ...next, rooms: next.rooms.map((x) => (x.id === roomId ? { ...x, door: id } : x)), walkways: { ...next.walkways, connectors } }
      })
      set({ selection: { kind: 'node', id }, status: plan.linkTo ? '' : 'Door placed, but there is no corridor node to join it to yet.' })
    },

    newConnector: (kind) => {
      const id = nextConnectorId(get().draft, kind)
      edit((d) => ({ ...d, walkways: { ...d.walkways, connectors: [...d.walkways.connectors, { id, kind, costPerFloor: kind === 'elevator' ? 20 : 14, nodes: {} }] } }))
      set({ activeConnector: id })
    },
    updateConnector: (id, patch) => edit((d) => ({ ...d, walkways: { ...d.walkways, connectors: d.walkways.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }), `conn:${id}`),
    assignConnector: (roomId) => {
      const { activeConnector, floor } = get()
      const r = room(roomId)
      if (!activeConnector) return set({ status: 'Pick or create a lift or stairs connector first.' })
      if (!r?.door) return set({ status: 'That room has no door yet. Add one with the Door tool first.' })
      edit((d) => ({ ...d, walkways: { ...d.walkways, connectors: d.walkways.connectors.map((c) => (c.id === activeConnector ? { ...c, nodes: { ...c.nodes, [String(floor)]: r.door! } } : c)) } }))
      set({ status: '' })
    },
    removeConnectorFloor: (id, floor) =>
      edit((d) => ({ ...d, walkways: { ...d.walkways, connectors: d.walkways.connectors.map((c) => (c.id === id ? { ...c, nodes: Object.fromEntries(Object.entries(c.nodes).filter(([k]) => k !== String(floor))) } : c)) } })),

    startQr: (position) => set({ pendingQr: { position: rnd(position), facingDeg: 0 }, selection: null }),
    setPendingQrFacing: (facingDeg) => {
      const q = get().pendingQr
      if (q) set({ pendingQr: { ...q, facingDeg } })
    },
    addQr: (id) => {
      const { pendingQr, draft, floor } = get()
      const bad = qrIdProblem(id, draft)
      if (bad) return bad
      if (!pendingQr) return 'Click a spot on the map first.'
      edit((d) => ({ ...d, qrPoints: [...d.qrPoints, { id, floor, position: pendingQr.position, facingDeg: ((Math.round(pendingQr.facingDeg) % 360) + 360) % 360, label: '', labelTh: '' }] }))
      set({ pendingQr: null, selection: { kind: 'qr', id } })
      return null
    },
    updateQr: (id, patch) => edit((d) => ({ ...d, qrPoints: d.qrPoints.map((q) => (q.id === id ? { ...q, ...patch, id } : q)) }), `qr:${id}`),

    setPhoto: (photo) => set({ photo }),
    updatePhoto: (patch) => {
      const p = get().photo
      if (p) set({ photo: { ...p, ...patch } })
      photoSave()
    },
    adjustPhoto: (m) => {
      const p = get().photo
      if (p) set({ photo: { ...p, matrix: compose(m, p.matrix) } })
      photoSave()
    },
    addAlignPoint: (kind, pt) => {
      const { align, photo } = get()
      if (!photo) return
      const next = { photoPts: [...align.photoPts], worldPts: [...align.worldPts] }
      if (kind === 'photo' && next.photoPts.length < 3) next.photoPts.push(pt)
      else if (kind === 'world' && next.photoPts.length === 3 && next.worldPts.length < 3) next.worldPts.push(pt)
      else return
      set({ align: next })
      if (next.worldPts.length === 3) {
        const m = solveAffine(next.photoPts as [Point, Point, Point], next.worldPts as [Point, Point, Point])
        if (m) {
          set({ photo: { ...photo, matrix: m, opacity: Math.min(photo.opacity, 0.6) }, status: 'Photo aligned. Check it against the outline, then nudge if needed.' })
          photoSave()
        } else set({ status: 'Those three points are in a line. Pick three corners that are not in a row.', align: { photoPts: [], worldPts: [] } })
      }
    },
    resetAlign: () => set({ align: { photoPts: [], worldPts: [] } }),

    setShowDepts: (showDepts) => set({ showDepts }),
    selectDept: (selectedDept) => set({ selectedDept }),
    addDepartment: (name) => {
      const { draft } = get()
      const id = departmentId(name, draft)
      const dept: Department = { id, name: name.trim(), letter: freeLetter(draft.departments), colorSlot: freeSlot(draft.departments) }
      edit((d) => ({ ...d, departments: [...d.departments, dept] }))
      set({ selectedDept: id })
      return id
    },
    updateDepartment: (id, patch) => edit((d) => ({ ...d, departments: d.departments.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) }), `dept:${id}:${Object.keys(patch).join()}`),
    deleteDepartment: (id) => {
      const why = deleteBlock(get().draft, id)
      if (why) return why
      // The id stays reserved, so a later department can never take it.
      edit((d) => ({ ...d, departments: d.departments.filter((x) => x.id !== id), usedIds: [...new Set([...(d.usedIds ?? []), id])] }))
      set({ selectedDept: null })
      return null
    },
    markDepartmentsSaved: (saved) => {
      set({ saved, draft: replaceDepartments(get().draft, saved.departments), deptsRestored: false })
      lsSet(DEPT_DRAFT_KEY, null)
    },

    slice: () => sliceFloor(get().draft, get().floor),
    markSaved: (saved, slice) => {
      const marked = replaceFloor(get().draft, slice)
      set({ saved, draft: marked, restored: get().restored.filter((f) => f !== slice.floor) })
      lsSet(DRAFT_KEY(slice.floor), null)
    },
    discardDraft: (floor) => {
      lsSet(DRAFT_KEY(floor), null)
      const { saved } = get()
      if (saved) get().init(saved)
    },
  }
})

export const problemsNow = (d: BuildingData, floor: number): Problem[] => problemsForFloor(validate(d), floor)

export function facingFrom(a: Point, b: Point): number {
  const deg = (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI
  return (deg + 360) % 360
}

export function persistDraft(d: BuildingData, opened: number[], saved: BuildingData | null) {
  const deptNow = JSON.stringify(d.departments)
  lsSet(DEPT_DRAFT_KEY, saved && deptNow === JSON.stringify(saved.departments) ? null : deptNow)
  for (const f of opened) {
    const s = sliceFloor(d, f)
    const now = JSON.stringify(s)
    // Nothing to keep when the floor equals what is saved, or is still blank.
    const blank = !s.rooms.length && !s.nodes.length && !s.qrPoints.length && !s.connectors.length
    lsSet(DRAFT_KEY(f), blank || (saved && now === JSON.stringify(sliceFloor(saved, f))) ? null : now)
  }
}

export function loadPhotoMatrix(floor: number): { matrix: Affine; opacity: number } | null {
  const raw = lsGet(PHOTO_KEY(floor))
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { matrix: Affine; opacity: number }
    return v.matrix?.length === 6 && v.matrix.every(Number.isFinite) ? v : null
  } catch { return null }
}

export const ROOM_TYPES: RoomType[] = ['classroom', 'laboratory', 'office', 'conferenceroom', 'lobby', 'foodservice', 'library', 'restroom', 'stairs', 'elevator', 'other']

export { applyAffine, IDENTITY, invertAffine, rotateAbout, scaleAbout, translate }
