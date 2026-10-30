import { useState } from 'react'
import { DEPT_COLOR_SLOTS, SUMMARY_MAX, roomsUsing, sharedSlots } from '../data/departments.ts'
import type { Department } from '../data/types.ts'
import { slotColors } from '../theme/slots.ts'
import { useTrace } from './store.ts'
import { useAllProblems } from './useProblems.ts'

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function DeptForm({ dept }: { dept: Department }) {
  const { draft, updateDepartment, deleteDepartment } = useTrace()
  const [blocked, setBlocked] = useState<string | null>(null)
  const set = (patch: Partial<Department>) => updateDepartment(dept.id, patch)
  const summary = dept.summary ?? ''
  const shared = sharedSlots(draft.departments).get(dept.colorSlot)
  const text = (k: 'name' | 'nameTh' | 'url') => (
    <input value={dept[k] ?? ''} onChange={(e) => set({ [k]: e.target.value === '' && k !== 'name' ? undefined : e.target.value })} />
  )
  return (
    <section className="card" data-testid="dept-form">
      <h3>Department <code>{dept.id}</code></h3>
      <Field label="Name">{text('name')}</Field>
      <Field label="Thai name">{text('nameTh')}</Field>
      <Field label="Letter (1-2 capital letters, unique)">
        <input value={dept.letter} maxLength={2} onChange={(e) => set({ letter: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} />
      </Field>
      <Field label="Other names (comma separated)">
        <input value={(dept.aliases ?? []).join(', ')} onChange={(e) => set({ aliases: list(e.target.value).length ? list(e.target.value) : undefined })} />
      </Field>
      <Field label="Other names in Thai (comma separated)">
        <input value={(dept.aliasesTh ?? []).join(', ')} onChange={(e) => set({ aliasesTh: list(e.target.value).length ? list(e.target.value) : undefined })} />
      </Field>
      <Field label={`Summary (${summary.length}/${SUMMARY_MAX})`}>
        <textarea rows={4} value={summary} onChange={(e) => set({ summary: e.target.value === '' ? undefined : e.target.value })} />
      </Field>
      <p className={summary.length > SUMMARY_MAX ? 'error' : 'muted'}>Write it in your own words. Don&apos;t copy text from the SIIT website.</p>
      <Field label="Official page (https://…)">{text('url')}</Field>
      <div className="field">
        <span>Colour</span>
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {slotColors.slice(0, DEPT_COLOR_SLOTS).map((c, i) => (
            <button key={i} role="radio" aria-checked={dept.colorSlot === i} aria-label={`Colour ${i + 1}`} className={dept.colorSlot === i ? 'swatch on' : 'swatch'} style={{ background: c.top, borderColor: c.side }} onClick={() => set({ colorSlot: i })} />
          ))}
        </div>
        {shared && <p className="warn-text">Shared with {shared.filter((x) => x !== dept.id).map((x) => draft.departments.find((d) => d.id === x)?.name || x).join(', ')}. Allowed, but the map is easier to read when departments differ.</p>}
      </div>
      <button className="danger" onClick={() => setBlocked(deleteDepartment(dept.id))}>Delete department</button>
      {blocked && <p className="error" role="alert">{blocked}</p>}
    </section>
  )
}

export function DepartmentsPanel() {
  const store = useTrace()
  const { draft, selectedDept, selectDept, addDepartment, setShowDepts, deptsRestored } = store
  const problems = useAllProblems().filter((p) => p.code.startsWith('department'))
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = draft.departments.find((d) => d.id === selectedDept)

  const save = async () => {
    const errors = problems.filter((p) => p.severity === 'error')
    if (errors.length && !window.confirm(`There are ${errors.length} problem(s) with departments:\n\n${errors.slice(0, 10).map((p) => `• ${p.message}`).join('\n')}\n\nSave anyway?`)) return
    setBusy(true)
    try {
      const res = await fetch('/__trace/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ departments: draft.departments }) })
      const out = (await res.json()) as { ok: boolean; backup?: string; error?: string }
      if (!out.ok) throw new Error(out.error ?? 'Save failed')
      store.markDepartmentsSaved(await (await fetch('/__trace/data', { cache: 'no-store' })).json())
      store.setStatus(`Saved departments. Backup: .trace-backups/${out.backup}.`)
    } catch (e) {
      store.setStatus(`Not saved: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    const text = JSON.stringify(draft.departments, null, 2)
    try { await navigator.clipboard.writeText(text); store.setStatus('Departments JSON copied.') } catch { window.prompt('Copy this departments JSON (Ctrl+C):', text) }
  }
  const add = () => {
    if (!name.trim()) return
    addDepartment(name)
    setName('')
  }

  return (
    <aside className="side" data-testid="departments">
      {deptsRestored && <div className="banner">Restored unsaved department changes.</div>}
      <section className="card">
        <h3>Departments <button className="link close" onClick={() => setShowDepts(false)}>Close</button></h3>
        <p className="muted">Enter departments before assigning rooms. Departments belong to the whole building, and are saved separately from a floor.</p>
        <ul className="list depts">
          {draft.departments.map((d) => {
            const n = roomsUsing(draft, d.id)
            return (
              <li key={d.id} className={d.id === selectedDept ? 'active' : ''}>
                <button className="dept-row" onClick={() => selectDept(d.id)}>
                  <span className="badge" style={{ borderColor: slotColors[d.colorSlot]?.side, background: slotColors[d.colorSlot]?.top }}>{d.letter}</span>
                  <span className="dept-name">{d.name || '(no name)'}</span>
                  <span className="muted">{n} room{n === 1 ? '' : 's'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="row">
          <input aria-label="New department name" placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={add}>Add</button>
        </div>
      </section>
      {selected && <DeptForm key={selected.id} dept={selected} />}
      <section className={`card checks ${problems.some((p) => p.severity === 'error') ? 'bad' : 'good'}`}>
        <h3>Department checks</h3>
        {problems.length === 0 && <p className="ok">All clear.</p>}
        <ul className="problems">
          {problems.map((p, i) => <li key={i} className={p.severity}>{p.message}</li>)}
        </ul>
      </section>
      <div className="row">
        <button onClick={copy}>Copy departments JSON</button>
        <button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save departments'}</button>
      </div>
    </aside>
  )
}
