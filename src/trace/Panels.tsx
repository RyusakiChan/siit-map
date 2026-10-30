import { useRef, useState } from 'react'
import type { Room, RoomType } from '../data/types.ts'
import type { Problem } from '../data/validate.ts'
import { IDENTITY, rotateAbout, scaleAbout, translate, type Affine } from './affine.ts'
import { qrIdProblem } from './ids.ts'
import { loadPhotoMatrix, outlineBox, ROOM_TYPES, useTrace, type Tool } from './store.ts'
import { useAllProblems, useProblems } from './useProblems.ts'

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'select', label: 'Select', hint: 'Click a room, node or QR point. Drag corners to reshape. Delete removes.' },
  { id: 'align', label: 'Align photo', hint: 'Click 3 spots on the photo, then the same 3 spots on the outline.' },
  { id: 'room', label: 'Room', hint: 'Click corners. Click the first point or press Enter to close. Esc cancels. Hold Shift for free angles.' },
  { id: 'node', label: 'Corridor node', hint: 'Click along the middle of the corridor. Clicking on a line splits it.' },
  { id: 'edge', label: 'Corridor line', hint: 'Click one node, then the next. Esc to stop.' },
  { id: 'door', label: 'Door', hint: 'Click a room wall (or the room). The door goes 0.25 m outside, joined to the nearest corridor node.' },
  { id: 'connector', label: 'Lift / stairs', hint: 'Pick or create a connector, then click the lift or stairs room on each floor.' },
  { id: 'qr', label: 'QR point', hint: 'Click a spot, drag to point the arrow where a person faces, then type the id.' },
]

export function Toolbar() {
  const { floor, setFloor, tool, setTool, undo, redo, past, future, draft, showDepts, setShowDepts } = useTrace()
  return (
    <header className="bar">
      <strong className="brand">SIIT Map trace</strong>
      <div className="seg" role="group" aria-label="Floor">
        {draft.floors.map((f) => (
          <button key={f.level} className={f.level === floor ? 'on' : ''} onClick={() => setFloor(f.level)} title={f.traced ? 'Traced' : 'Sample data'}>
            {f.level}
            <i className={f.traced ? 'dot ok' : 'dot'} />
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Tool">
        {TOOLS.map((t) => (
          <button key={t.id} className={t.id === tool ? 'on' : ''} onClick={() => setTool(t.id)} title={t.hint}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="seg">
        <button className={showDepts ? 'on' : ''} onClick={() => setShowDepts(!showDepts)}>Departments</button>
      </div>
      <div className="seg">
        <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">Undo</button>
        <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
      </div>
      <SaveButtons />
    </header>
  )
}

export function Hint() {
  const { tool, status, floor, draft } = useTrace()
  const hint = TOOLS.find((t) => t.id === tool)?.hint
  const f = draft.floors.find((x) => x.level === floor)
  return (
    <div className="hint" data-testid="hint">
      <span className="hint-main">Floor {floor} {f?.traced ? '(traced)' : '(not traced yet: starts empty)'} — {hint}</span>
      {status && <span className="status" role="status">{status}</span>}
    </div>
  )
}

function SaveButtons() {
  const store = useTrace()
  const all = useAllProblems()
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const slice = store.slice()
    const bad = all.filter((p) => p.floor === store.floor || p.floor === undefined)
    if (bad.length) {
      const list = bad.slice(0, 15).map((p) => `• ${p.message}`).join('\n')
      const more = bad.length > 15 ? `\n…and ${bad.length - 15} more` : ''
      if (!window.confirm(`There are ${bad.length} problem(s) on this floor:\n\n${list}${more}\n\nSave anyway?`)) return
    }
    setBusy(true)
    try {
      const res = await fetch('/__trace/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(slice) })
      const out = (await res.json()) as { ok: boolean; backup?: string; error?: string }
      if (!out.ok) throw new Error(out.error ?? 'Save failed')
      const fresh = await (await fetch('/__trace/data', { cache: 'no-store' })).json()
      store.markSaved(fresh, slice)
      store.setStatus(`Saved floor ${slice.floor}. Backup: .trace-backups/${out.backup}. Open / to see it in the app.`)
    } catch (e) {
      store.setStatus(`Not saved: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    const text = JSON.stringify(store.slice(), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      store.setStatus('Floor JSON copied.')
    } catch {
      window.prompt('Copy this floor JSON (Ctrl+C):', text)
    }
  }

  return (
    <div className="seg right">
      <button onClick={copy} title="Copy this floor's data as JSON (fallback if saving fails)">Copy floor JSON</button>
      <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save floor'}</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function RoomForm({ room }: { room: Room }) {
  const { draft, updateRoom } = useTrace()
  const set = <K extends keyof Room>(k: K, v: Room[K] | undefined) => updateRoom(room.id, { [k]: v } as Partial<Room>)
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const text = (k: 'name' | 'nameTh' | 'hours' | 'contact' | 'description') => (
    <input value={room[k] ?? ''} onChange={(e) => set(k, e.target.value === '' && k !== 'name' ? undefined : e.target.value)} />
  )
  return (
    <section className="card" data-testid="room-form">
      <h3>Room <code>{room.id}</code></h3>
      <Field label="Number"><input value={room.number ?? ''} onChange={(e) => set('number', e.target.value === '' ? null : e.target.value)} /></Field>
      <Field label="Name">{text('name')}</Field>
      <Field label="Thai name">{text('nameTh')}</Field>
      <Field label="Type">
        <select value={room.type} onChange={(e) => set('type', e.target.value as RoomType)}>
          {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Department">
        <select
          value={room.departmentIds ? '__shared' : (room.departmentId ?? '')}
          onChange={(e) => updateRoom(room.id, { departmentId: e.target.value || null, departmentIds: undefined })}
        >
          <option value="">(none)</option>
          {room.departmentIds && <option value="__shared">Shared: {room.departmentIds.map((id) => draft.departments.find((d) => d.id === id)?.letter ?? id).join(' + ')}</option>}
          {draft.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Aliases (comma separated)">
        <input value={(room.aliases ?? []).join(', ')} onChange={(e) => set('aliases', list(e.target.value).length ? list(e.target.value) : undefined)} />
      </Field>
      <Field label="Opening hours">{text('hours')}</Field>
      <Field label="Contact">{text('contact')}</Field>
      <Field label="Description (your own words)">{text('description')}</Field>
      <label className="check"><input type="checkbox" checked={!!room.popular} onChange={(e) => set('popular', e.target.checked || undefined)} /> Popular (shows in quick picks)</label>
      <p className="muted">{room.door ? `Door: ${room.door}` : 'No door yet: use the Door tool.'}</p>
      <button className="danger" onClick={() => useTrace.getState().deleteSelection()}>Delete room</button>
    </section>
  )
}

function QrForm({ id }: { id: string }) {
  const { draft, saved, updateQr, deleteSelection } = useTrace()
  const q = draft.qrPoints.find((x) => x.id === id)
  if (!q) return null
  const locked = !!saved?.qrPoints.some((x) => x.id === id && saved.floors.find((f) => f.level === x.floor)?.traced)
  return (
    <section className="card">
      <h3>QR point <code>{q.id}</code></h3>
      <p className="muted">{locked ? 'Saved: this id is permanent, because printed QR codes link to it.' : 'Not saved yet. After you save, the id is permanent.'}</p>
      <Field label="Place (English), e.g. Lift lobby">
        <input value={q.label} onChange={(e) => updateQr(id, { label: e.target.value })} aria-label="QR place, English" />
      </Field>
      <Field label="Place (Thai)">
        <input value={q.labelTh} onChange={(e) => updateQr(id, { labelTh: e.target.value })} aria-label="QR place, Thai" />
      </Field>
      <Field label="Facing (degrees clockwise from north)">
        <input type="number" min={0} max={359} value={q.facingDeg} onChange={(e) => updateQr(id, { facingDeg: ((Number(e.target.value) % 360) + 360) % 360 })} />
      </Field>
      <button className="danger" onClick={deleteSelection}>Delete QR point</button>
    </section>
  )
}

function PendingQr() {
  const { pendingQr, addQr, draft } = useTrace()
  const [id, setId] = useState('')
  const [err, setErr] = useState<string | null>(null)
  if (!pendingQr) return null
  const live = id ? qrIdProblem(id, draft) : null
  return (
    <section className="card">
      <h3>New QR point</h3>
      <p className="muted">Facing {Math.round(pendingQr.facingDeg)}°. Drag on the map to turn the arrow.</p>
      <Field label="QR id (permanent once saved)">
        <input value={id} onChange={(e) => { setId(e.target.value.trim()); setErr(null) }} placeholder="e.g. lobby-north" aria-label="QR id" />
      </Field>
      {(err ?? live) && <p className="error">{err ?? live}</p>}
      <button className="primary" onClick={() => { const e = addQr(id); setErr(e); if (!e) setId('') }}>Add QR point</button>
    </section>
  )
}

function Connectors() {
  const { draft, floor, activeConnector, newConnector, updateConnector, removeConnectorFloor } = useTrace()
  const set = (id: string | null) => useTrace.setState({ activeConnector: id })
  const rooms = new Map(draft.rooms.map((r) => [r.door, r]))
  return (
    <section className="card">
      <h3>Lifts and stairs</h3>
      <p className="muted">One connector is one shaft. Pick it, then click its room on each floor.</p>
      <div className="row">
        <button onClick={() => newConnector('elevator')}>+ New lift</button>
        <button onClick={() => newConnector('stairs')}>+ New stairs</button>
      </div>
      <ul className="list">
        {draft.walkways.connectors.map((c) => (
          <li key={c.id} className={c.id === activeConnector ? 'active' : ''}>
            <button className="link" onClick={() => set(c.id)}>{c.id}</button>
            <span className="muted"> floors: {Object.keys(c.nodes).sort().map((f) => {
              const r = rooms.get(c.nodes[f])
              return `${f}${r?.number ? ` (${r.number})` : ''}`
            }).join(', ') || 'none'}</span>
            {c.id === activeConnector && (
              <div className="row">
                <label>Cost per floor <input type="number" min={1} value={c.costPerFloor} onChange={(e) => updateConnector(c.id, { costPerFloor: Number(e.target.value) })} /></label>
                {c.nodes[String(floor)] && <button onClick={() => removeConnectorFloor(c.id, floor)}>Remove floor {floor}</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function PhotoPanel() {
  const { photo, floor, setPhoto, updatePhoto, adjustPhoto, align, resetAlign, draft, setTool, tool } = useTrace()
  const input = useRef<HTMLInputElement>(null)
  const load = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const b = outlineBox(draft.building.outline)
      const k = Math.min((b.x1 - b.x0) / img.naturalWidth, (b.z1 - b.z0) / img.naturalHeight)
      const saved = loadPhotoMatrix(floor)
      const fit: Affine = [k, 0, 0, k, b.x0, b.z0]
      if (photo) URL.revokeObjectURL(photo.url)
      setPhoto({ url, name: file.name, w: img.naturalWidth, h: img.naturalHeight, matrix: saved?.matrix ?? fit, opacity: saved?.opacity ?? 0.5 })
      useTrace.getState().setStatus(saved ? 'Loaded the alignment saved for this floor. Re-align if it is a different photo.' : 'Photo loaded. Choose "Align photo" to line it up.')
      setTool('align')
    }
    img.src = url
  }
  const centre = outlineBox(draft.building.outline)
  const mid: [number, number] = [(centre.x0 + centre.x1) / 2, (centre.z0 + centre.z1) / 2]
  const nudge = (dx: number, dz: number) => () => adjustPhoto(translate(dx, dz))
  return (
    <section className="card">
      <h3>Floor plan photo</h3>
      <p className="muted">The photo stays in this browser tab only. It is never uploaded or saved.</p>
      <input ref={input} type="file" accept="image/*" aria-label="Floor plan photo" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      {photo && (
        <>
          <Field label={`Opacity ${Math.round(photo.opacity * 100)}%`}>
            <input type="range" min={0.05} max={1} step={0.05} value={photo.opacity} onChange={(e) => updatePhoto({ opacity: Number(e.target.value) })} />
          </Field>
          <p className="muted">
            {tool === 'align'
              ? align.photoPts.length < 3 ? `Click spot ${align.photoPts.length + 1} of 3 on the photo (building corners work best).` : align.worldPts.length < 3 ? `Now click the same spot ${align.worldPts.length + 1} of 3 on the outline.` : 'Aligned.'
              : 'Use "Align photo" to place it again.'}
          </p>
          <div className="row wrap">
            <button onClick={nudge(-0.1, 0)}>←</button><button onClick={nudge(0.1, 0)}>→</button>
            <button onClick={nudge(0, -0.1)}>↑</button><button onClick={nudge(0, 0.1)}>↓</button>
            <button onClick={() => adjustPhoto(rotateAbout(-0.5, mid))}>⟲ 0.5°</button>
            <button onClick={() => adjustPhoto(rotateAbout(0.5, mid))}>⟳ 0.5°</button>
            <button onClick={() => adjustPhoto(scaleAbout(0.99, mid))}>− size</button>
            <button onClick={() => adjustPhoto(scaleAbout(1.01, mid))}>+ size</button>
          </div>
          <div className="row">
            <button onClick={() => { resetAlign(); setTool('align') }}>Align again</button>
            <button onClick={() => { const b = outlineBox(draft.building.outline); const k = Math.min((b.x1 - b.x0) / photo.w, (b.z1 - b.z0) / photo.h); updatePhoto({ matrix: [k, 0, 0, k, b.x0, b.z0] }); resetAlign() }}>Reset</button>
            <button onClick={() => { URL.revokeObjectURL(photo.url); setPhoto(null); resetAlign() }}>Remove photo</button>
          </div>
        </>
      )}
      {!photo && IDENTITY && null}
    </section>
  )
}

function Checks() {
  const problems = useProblems()
  const { zoomTo, select, draft } = useTrace()
  const errors = problems.filter((p) => p.severity === 'error')
  const go = (p: Problem) => {
    const canvas = document.querySelector('[data-testid="canvas"]') as HTMLElement | null
    if (p.at && canvas) zoomTo(p.at, canvas.clientWidth, canvas.clientHeight)
    const id = p.ids[0]
    if (id && draft.rooms.some((r) => r.id === id)) select({ kind: 'room', id })
    else if (id && draft.walkways.nodes.some((n) => n.id === id)) select({ kind: 'node', id })
  }
  return (
    <section className={`card checks ${errors.length ? 'bad' : 'good'}`} data-testid="checks">
      <h3>Checks <span className="count" data-testid="error-count">{errors.length}</span>{problems.length > errors.length && <span className="count warn"> +{problems.length - errors.length} notes</span>}</h3>
      {problems.length === 0 && <p className="ok">All clear. Nothing to fix on this floor.</p>}
      <ul className="problems">
        {[...errors, ...problems.filter((p) => p.severity === 'warning')].map((p, i) => (
          <li key={i} className={p.severity}>
            <button className="link" onClick={() => go(p)} title={p.code}>{p.message}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Side() {
  const { selection, draft, tool, restored, discardDraft, floor } = useTrace()
  const room = selection?.kind === 'room' ? draft.rooms.find((r) => r.id === selection.id) : undefined
  return (
    <aside className="side">
      {restored.length > 0 && (
        <div className="banner">
          Restored unsaved work (floor {restored.join(', ')}).{' '}
          <button className="link" onClick={() => restored.forEach(discardDraft)}>Discard it</button>
        </div>
      )}
      <Checks />
      {room && <RoomForm room={room} />}
      {selection?.kind === 'qr' && <QrForm id={selection.id} />}
      {selection?.kind === 'node' && <NodeInfo id={selection.id} />}
      {tool === 'qr' && <PendingQr />}
      {tool === 'connector' && <Connectors />}
      {(tool === 'align' || tool === 'select' || tool === 'room') && <PhotoPanel key={floor} />}
    </aside>
  )
}

function NodeInfo({ id }: { id: string }) {
  const { draft } = useTrace()
  const n = draft.walkways.nodes.find((x) => x.id === id)
  if (!n) return null
  const owner = draft.rooms.find((r) => r.door === id)
  return (
    <section className="card">
      <h3>Node <code>{id}</code></h3>
      <p className="muted">{owner ? `Door of ${owner.number ?? owner.name ?? owner.id}` : 'Corridor node'} · {draft.walkways.edges.filter((e) => e.a === id || e.b === id).length} line(s)</p>
      <button className="danger" onClick={() => useTrace.getState().deleteSelection()}>Delete node</button>
    </section>
  )
}
