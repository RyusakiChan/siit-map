import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pointInPolygon, polygonArea, polygonCentroid } from '../data/geometry.ts'
import type { Point, Room } from '../data/types.ts'
import { applyAffine, invertAffine } from './affine.ts'
import { qrTip, snapPoint, type Snap } from './snap.ts'
import { facingFrom, useTrace } from './store.ts'
import { useProblems } from './useProblems.ts'
import { planDoor, nearestEdge } from './walk.ts'

type Gesture =
  | { type: 'pan'; x0: number; y0: number; tx0: number; ty0: number }
  | { type: 'click'; x0: number; y0: number; shift: boolean }
  | { type: 'vertex'; roomId: string; i: number }
  | { type: 'node'; id: string }
  | { type: 'qr'; id: string }
  | { type: 'facing'; id: string }
  | { type: 'newQr' }

const HIT_PX = 9
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])
const ptsToStr = (pts: Point[]) => pts.map((p) => p.join(',')).join(' ')

export function Canvas() {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cursor, setCursor] = useState<Snap | null>(null)
  const [doorPreview, setDoorPreview] = useState<Point | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const space = useRef(false)

  const s = useTrace()
  const { draft, floor, view, tool, selection, drawing, photo, align, edgeFrom, pendingQr, activeConnector } = s
  const problems = useProblems()

  const rooms = useMemo(() => draft.rooms.filter((r) => r.floor === floor), [draft.rooms, floor])
  const nodes = useMemo(() => draft.walkways.nodes.filter((n) => n.floor === floor), [draft.walkways.nodes, floor])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const doorIds = useMemo(() => new Set(rooms.map((r) => r.door)), [rooms])
  const connectorNodes = useMemo(() => new Set(draft.walkways.connectors.map((c) => c.nodes[String(floor)])), [draft.walkways.connectors, floor])
  const qrs = useMemo(() => draft.qrPoints.filter((q) => q.floor === floor), [draft.qrPoints, floor])
  const others = useMemo(() => draft.rooms.filter((r) => r.floor !== floor && (r.type === 'elevator' || r.type === 'stairs')), [draft.rooms, floor])
  const loose = useMemo(() => new Set(problems.filter((p) => p.code === 'node-isolated' || p.code === 'door-unreachable').flatMap((p) => p.ids)), [problems])

  // Size of the drawing area, and the first fit.
  useEffect(() => {
    const el = box.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      setSize({ w, h })
      if (first && w > 0) { first = false; useTrace.getState().fitView(w, h) }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const r = box.current!.getBoundingClientRect()
    const v = useTrace.getState().view
    return [(clientX - r.left - v.tx) / v.s, (clientY - r.top - v.ty) / v.s]
  }, [])

  const snapCtx = (p: { drawn?: Point[]; free?: boolean; exclude?: string; cornersOnly?: boolean }) => {
    const st = useTrace.getState()
    return {
      outline: st.draft.building.outline,
      rooms: p.cornersOnly ? [] : st.draft.rooms.filter((r) => r.floor === st.floor && r.id !== p.exclude).map((r) => r.polygon),
      drawn: p.drawn,
      free: p.free,
      radius: HIT_PX / st.view.s,
    }
  }

  const roomAt = (p: Point, wallReach = 0): Room | undefined => {
    const st = useTrace.getState()
    const on = st.draft.rooms.filter((r) => r.floor === st.floor)
    const inside = on.filter((r) => pointInPolygon(p, r.polygon)).sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon))[0]
    if (inside || !wallReach) return inside
    let best: Room | undefined
    let bestD = wallReach
    for (const r of on) {
      for (let i = 0; i < r.polygon.length; i++) {
        const a = r.polygon[i]!
        const b = r.polygon[(i + 1) % r.polygon.length]!
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (dist(a, b) ** 2 || 1)))
        const d = dist(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
        if (d < bestD) { bestD = d; best = r }
      }
    }
    return best
  }

  const hitNode = (p: Point) => {
    const st = useTrace.getState()
    const r = HIT_PX / st.view.s
    let best: string | null = null
    let bestD = r
    for (const n of st.draft.walkways.nodes) {
      if (n.floor !== st.floor) continue
      const d = dist(p, n.position)
      if (d <= bestD) { best = n.id; bestD = d }
    }
    return best
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const st = useTrace.getState()
    const r = box.current!.getBoundingClientRect()
    const x0 = e.clientX - r.left
    const y0 = e.clientY - r.top
    if (e.button === 1 || space.current) {
      gesture.current = { type: 'pan', x0, y0, tx0: st.view.tx, ty0: st.view.ty }
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    const rad = HIT_PX / st.view.s
    if (st.tool === 'select') {
      const sel = st.selection
      if (sel?.kind === 'room') {
        const room = st.draft.rooms.find((q) => q.id === sel.id)
        const i = room?.polygon.findIndex((v) => dist(v, p) <= rad) ?? -1
        if (room && i >= 0) {
          st.checkpoint()
          st.select({ kind: 'room', id: room.id, vertex: i })
          gesture.current = { type: 'vertex', roomId: room.id, i }
          return
        }
        // "+" handle on a wall
        if (room) {
          for (let k = 0; k < room.polygon.length; k++) {
            const a = room.polygon[k]!
            const b = room.polygon[(k + 1) % room.polygon.length]!
            const m: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            if (dist(m, p) <= rad && dist(a, b) > 3 * rad) {
              st.insertVertex(room.id, k, m)
              st.checkpoint()
              gesture.current = { type: 'vertex', roomId: room.id, i: k + 1 }
              return
            }
          }
        }
      }
      const q = st.draft.qrPoints.find((x) => x.floor === st.floor && (dist(x.position, p) <= rad * 1.2 || dist(qrTip(x.position, x.facingDeg, st.view.s), p) <= rad))
      if (q) {
        const onTip = dist(qrTip(q.position, q.facingDeg, st.view.s), p) <= rad && dist(q.position, p) > rad
        st.checkpoint()
        st.select({ kind: 'qr', id: q.id })
        gesture.current = onTip ? { type: 'facing', id: q.id } : { type: 'qr', id: q.id }
        return
      }
      const nid = hitNode(p)
      if (nid) {
        st.checkpoint()
        st.select({ kind: 'node', id: nid })
        gesture.current = { type: 'node', id: nid }
        return
      }
    }
    if (st.tool === 'qr') {
      st.startQr(snapPoint(p, snapCtx({ cornersOnly: true })).point)
      gesture.current = { type: 'newQr' }
      return
    }
    gesture.current = { type: 'click', x0, y0, shift: e.shiftKey }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const st = useTrace.getState()
    const r = box.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const p = toWorld(e.clientX, e.clientY)
    const g = gesture.current
    if (g?.type === 'click' && Math.hypot(x - g.x0, y - g.y0) > 4) {
      gesture.current = { type: 'pan', x0: g.x0, y0: g.y0, tx0: st.view.tx, ty0: st.view.ty }
    }
    const cur = gesture.current
    if (cur?.type === 'pan') {
      st.setView({ ...st.view, tx: cur.tx0 + (x - cur.x0), ty: cur.ty0 + (y - cur.y0) })
    } else if (cur?.type === 'vertex') {
      st.moveVertex(cur.roomId, cur.i, snapPoint(p, snapCtx({ exclude: cur.roomId, free: e.shiftKey })).point)
    } else if (cur?.type === 'node') {
      st.moveNode(cur.id, p)
    } else if (cur?.type === 'qr') {
      st.live((d) => ({ ...d, qrPoints: d.qrPoints.map((q) => (q.id === cur.id ? { ...q, position: snapPoint(p, snapCtx({ cornersOnly: true })).point.map((v) => Math.round(v * 100) / 100) as Point } : q)) }))
    } else if (cur?.type === 'facing') {
      const q = st.draft.qrPoints.find((z) => z.id === cur.id)
      if (q) st.live((d) => ({ ...d, qrPoints: d.qrPoints.map((z) => (z.id === cur.id ? { ...z, facingDeg: Math.round(facingFrom(q.position, p)) } : z)) }))
    } else if (cur?.type === 'newQr' && st.pendingQr && dist(st.pendingQr.position, p) > 0.3) {
      st.setPendingQrFacing(facingFrom(st.pendingQr.position, p))
    } else if (!cur) {
      if (st.tool === 'room') setCursor(snapPoint(p, snapCtx({ drawn: st.drawing, free: e.shiftKey })))
      else if (st.tool === 'align' && st.align.photoPts.length === 3) setCursor(snapPoint(p, snapCtx({ cornersOnly: true })))
      else if (st.tool === 'qr') setCursor(snapPoint(p, snapCtx({ cornersOnly: true })))
      else setCursor({ point: p, kind: 'none' })
      if (st.tool === 'door') {
        const room = roomAt(p, 1.5)
        const plan = room && planDoor(room.polygon, p, [], [])
        setDoorPreview(plan ? plan.position : null)
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (g?.type !== 'click') return
    const st = useTrace.getState()
    const p = toWorld(e.clientX, e.clientY)
    const rad = HIT_PX / st.view.s
    switch (st.tool) {
      case 'select': {
        const room = roomAt(p)
        st.select(room ? { kind: 'room', id: room.id } : null)
        break
      }
      case 'room': {
        const sp = snapPoint(p, snapCtx({ drawn: st.drawing, free: g.shift })).point
        if (st.drawing.length >= 3 && dist(sp, st.drawing[0]!) <= rad * 1.5) st.closeRoom()
        else st.addDrawPoint(sp)
        break
      }
      case 'node':
        st.placeNode(hitNode(p) ? nodeById.get(hitNode(p)!)!.position : p, rad)
        break
      case 'edge': {
        const n = hitNode(p)
        if (n) st.edgeClick(n)
        break
      }
      case 'door': {
        const room = roomAt(p, 1.5)
        if (room) st.placeDoor(room.id, p)
        break
      }
      case 'connector': {
        const room = roomAt(p)
        if (room) st.assignConnector(room.id)
        break
      }
      case 'align': {
        if (!st.photo) break
        if (st.align.photoPts.length < 3) {
          const inv = invertAffine(st.photo.matrix)
          if (inv) st.addAlignPoint('photo', applyAffine(inv, p))
        } else st.addAlignPoint('world', snapPoint(p, snapCtx({ cornersOnly: true })).point)
        break
      }
    }
  }

  // Wheel zoom (and trackpad pinch) about the cursor; needs a non-passive listener.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useTrace.getState()
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      const s2 = Math.max(2, Math.min(200, st.view.s * k))
      const f = s2 / st.view.s
      st.setView({ s: s2, tx: x - (x - st.view.tx) * f, ty: y - (y - st.view.ty) * f })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      const st = useTrace.getState()
      if (typing(e.target)) { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return }
      if (e.code === 'Space') { space.current = true; e.preventDefault(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); st.redo(); return }
      if (e.key === 'Enter' && st.tool === 'room') st.closeRoom()
      else if (e.key === 'Escape') st.cancelDrawing()
      else if (e.key === 'Backspace' && st.tool === 'room' && st.drawing.length) { e.preventDefault(); st.popDrawPoint() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection) { e.preventDefault(); st.deleteSelection() }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') space.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const px = 1 / view.s
  const outline = draft.building.outline
  const selRoom = selection?.kind === 'room' ? rooms.find((r) => r.id === selection.id) : undefined
  const activeCon = draft.walkways.connectors.find((c) => c.id === activeConnector)
  const cursorClass = tool === 'select' ? '' : ' crosshair'

  return (
    <div ref={box} className={`canvas${cursorClass}`} data-testid="canvas">
      <svg
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <polygon className="outline-bg" points={ptsToStr(outline)} />
          {photo && (
            <image href={photo.url} width={photo.w} height={photo.h} opacity={photo.opacity} transform={`matrix(${photo.matrix.join(' ')})`} preserveAspectRatio="none" />
          )}
          <polygon className="outline" points={ptsToStr(outline)} vectorEffect="non-scaling-stroke" />
          {others.map((r) => (
            <polygon key={r.id} className="ghost" points={ptsToStr(r.polygon)} vectorEffect="non-scaling-stroke" />
          ))}
          {rooms.map((r) => {
            const sel = selection?.kind === 'room' && selection.id === r.id
            const c = polygonCentroid(r.polygon)
            const hot = tool === 'connector' && activeCon && r.type === activeCon.kind
            return (
              <g key={r.id}>
                <polygon
                  className={`room t-${r.type}${sel ? ' sel' : ''}${hot ? ' hot' : ''}`}
                  points={ptsToStr(r.polygon)}
                  vectorEffect="non-scaling-stroke"
                  data-room={r.id}
                />
                <text x={c[0]} y={c[1]} fontSize={11 * px} className="label" textAnchor="middle" dominantBaseline="middle">
                  {r.number || r.name || r.id.replace('r-', '')}
                </text>
              </g>
            )
          })}
          {draft.walkways.edges.map((e, i) => {
            const a = nodeById.get(e.a)
            const b = nodeById.get(e.b)
            return a && b ? <line key={i} className="edge" x1={a.position[0]} y1={a.position[1]} x2={b.position[0]} y2={b.position[1]} vectorEffect="non-scaling-stroke" /> : null
          })}
          {nodes.map((n) => {
            const isDoor = doorIds.has(n.id)
            const sel = (selection?.kind === 'node' && selection.id === n.id) || edgeFrom === n.id
            return (
              <g key={n.id} data-node={n.id}>
                {connectorNodes.has(n.id) && <circle cx={n.position[0]} cy={n.position[1]} r={8 * px} className="conn-ring" vectorEffect="non-scaling-stroke" />}
                <circle
                  cx={n.position[0]}
                  cy={n.position[1]}
                  r={(isDoor ? 4 : 5) * px}
                  className={`node ${isDoor ? 'door' : 'corridor'}${loose.has(n.id) ? ' loose' : ''}${sel ? ' sel' : ''}`}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
          {qrs.map((q) => (
            <g key={q.id} className={`qr${selection?.kind === 'qr' && selection.id === q.id ? ' sel' : ''}`}>
              <line x1={q.position[0]} y1={q.position[1]} x2={qrTip(q.position, q.facingDeg, view.s)[0]} y2={qrTip(q.position, q.facingDeg, view.s)[1]} vectorEffect="non-scaling-stroke" />
              <circle cx={qrTip(q.position, q.facingDeg, view.s)[0]} cy={qrTip(q.position, q.facingDeg, view.s)[1]} r={4 * px} />
              <rect x={q.position[0] - 6 * px} y={q.position[1] - 6 * px} width={12 * px} height={12 * px} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {pendingQr && (
            <g className="qr pending">
              <line x1={pendingQr.position[0]} y1={pendingQr.position[1]} x2={qrTip(pendingQr.position, pendingQr.facingDeg, view.s)[0]} y2={qrTip(pendingQr.position, pendingQr.facingDeg, view.s)[1]} vectorEffect="non-scaling-stroke" />
              <circle cx={qrTip(pendingQr.position, pendingQr.facingDeg, view.s)[0]} cy={qrTip(pendingQr.position, pendingQr.facingDeg, view.s)[1]} r={4 * px} />
              <rect x={pendingQr.position[0] - 6 * px} y={pendingQr.position[1] - 6 * px} width={12 * px} height={12 * px} vectorEffect="non-scaling-stroke" />
            </g>
          )}
          {selRoom &&
            selRoom.polygon.map((v, i) => {
              const nxt = selRoom.polygon[(i + 1) % selRoom.polygon.length]!
              const m: Point = [(v[0] + nxt[0]) / 2, (v[1] + nxt[1]) / 2]
              const isSel = selection?.kind === 'room' && selection.vertex === i
              return (
                <g key={i}>
                  <circle cx={v[0]} cy={v[1]} r={5 * px} className={`handle${isSel ? ' sel' : ''}`} vectorEffect="non-scaling-stroke" />
                  {dist(v, nxt) > 3 * HIT_PX * px && <circle cx={m[0]} cy={m[1]} r={3.5 * px} className="plus" vectorEffect="non-scaling-stroke" />}
                </g>
              )
            })}
          {drawing.length > 0 && (
            <g className="drawing">
              <polyline points={ptsToStr(cursor && tool === 'room' ? [...drawing, cursor.point] : drawing)} vectorEffect="non-scaling-stroke" />
              {drawing.map((v, i) => (
                <circle key={i} cx={v[0]} cy={v[1]} r={(i === 0 ? 6 : 4) * px} className={i === 0 ? 'first' : ''} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          )}
          {edgeFrom && cursor && nodeById.get(edgeFrom) && tool === 'edge' && (
            <line className="edge preview" x1={nodeById.get(edgeFrom)!.position[0]} y1={nodeById.get(edgeFrom)!.position[1]} x2={cursor.point[0]} y2={cursor.point[1]} vectorEffect="non-scaling-stroke" />
          )}
          {tool === 'door' && doorPreview && <circle className="node door preview" cx={doorPreview[0]} cy={doorPreview[1]} r={4 * px} vectorEffect="non-scaling-stroke" />}
          {tool === 'node' && cursor && (() => {
            const hit = nearestEdge(cursor.point, nodes, draft.walkways.edges, HIT_PX * px)
            const pt = hit ? hit.point : cursor.point
            return <circle className={`node corridor preview${hit ? ' on-edge' : ''}`} cx={pt[0]} cy={pt[1]} r={5 * px} vectorEffect="non-scaling-stroke" />
          })()}
          {cursor && cursor.kind !== 'none' && ['room', 'align', 'qr'].includes(tool) && (
            <g className={`snap k-${cursor.kind}`}>
              <circle cx={cursor.point[0]} cy={cursor.point[1]} r={7 * px} vectorEffect="non-scaling-stroke" />
              <text x={cursor.point[0] + 10 * px} y={cursor.point[1] - 8 * px} fontSize={11 * px}>
                {cursor.kind === 'corner' ? 'corner' : cursor.kind === 'edge' ? 'wall' : '90°'}
              </text>
            </g>
          )}
          {photo &&
            align.photoPts.map((pt, i) => {
              const w = applyAffine(photo.matrix, pt)
              return (
                <g key={`p${i}`} className="align-pt photo">
                  <circle cx={w[0]} cy={w[1]} r={6 * px} vectorEffect="non-scaling-stroke" />
                  <text x={w[0] + 8 * px} y={w[1] - 8 * px} fontSize={12 * px}>P{i + 1}</text>
                </g>
              )
            })}
          {align.worldPts.map((w, i) => (
            <g key={`w${i}`} className="align-pt world">
              <circle cx={w[0]} cy={w[1]} r={6 * px} vectorEffect="non-scaling-stroke" />
              <text x={w[0] + 8 * px} y={w[1] + 14 * px} fontSize={12 * px}>B{i + 1}</text>
            </g>
          ))}
          {problems
            .filter((p) => p.floor === floor && p.at && p.severity === 'error')
            .map((p, i) => (
              <circle key={i} className="problem" cx={p.at![0]} cy={p.at![1]} r={10 * px} vectorEffect="non-scaling-stroke" />
            ))}
        </g>
      </svg>
    </div>
  )
}
