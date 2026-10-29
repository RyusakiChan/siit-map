import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { useTrace } from './store.ts'
import './trace.css'

// The browser check (scripts/trace-e2e.mjs) reads the editor state through this.
Object.assign(window, { __trace: useTrace })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
