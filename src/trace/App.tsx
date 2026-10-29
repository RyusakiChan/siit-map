import { useEffect, useState } from 'react'
import type { BuildingData } from '../data/types.ts'
import { Canvas } from './Canvas.tsx'
import { Hint, Side, Toolbar } from './Panels.tsx'
import { persistDraft, useTrace } from './store.ts'

export function App() {
  const [error, setError] = useState<string | null>(null)
  const ready = useTrace((s) => !!s.draft)
  useEffect(() => {
    fetch('/__trace/data', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<BuildingData>) : Promise.reject(new Error('The trace tool only works with `npm run dev`.'))))
      .then((d) => useTrace.getState().init(d))
      .catch((e) => setError(String(e instanceof Error ? e.message : e)))
    // Draft autosave: vector data only, never the photo.
    return useTrace.subscribe((s, prev) => {
      if (s.draft && s.draft !== prev.draft) persistDraft(s.draft, s.opened, s.saved)
    })
  }, [])
  if (error) return <p className="fatal">{error}</p>
  if (!ready) return <p className="fatal">Loading…</p>
  return (
    <div className="app">
      <Toolbar />
      <Hint />
      <main className="work">
        <Canvas />
        <Side />
      </main>
    </div>
  )
}
