import { create } from 'zustand'
import { countView } from '../analytics'
import { useAppStore } from '../state/store'
import { askWorker, MAX_CHARS, type AssistantAction, type WireMessage } from './api'

export interface ChatItem {
  id: number
  role: 'user' | 'assistant'
  text: string
  actions: AssistantAction[]
}

interface ChatState {
  open: boolean
  items: ChatItem[]
  busy: boolean
  /** The last request failed or the assistant is switched off: show the "resting" line. */
  failed: boolean
  /** The sheet is on screen; it stays true while it shrinks back into the Ask button. */
  sheetMounted: boolean
  /** Where the Ask button was when the sheet opened; the sheet grows out of this. */
  btnRect: { x: number; y: number } | null
  /** Runs once, when the sheet has finished closing (an action waits for the shrink). */
  afterClose: (() => void) | null
  /** One-shot hint for RouteEffects: a room opened from the assistant keeps the peek card. */
  peekArrival: boolean
  setOpen: (open: boolean) => void
  openFrom: (btn: { x: number; y: number } | null) => void
  finishClose: () => void
  send: (text: string) => Promise<void>
}

let nextId = 1

/** The conversation lives in memory only: it is gone when the tab closes. */
export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  items: [],
  busy: false,
  failed: false,
  sheetMounted: false,
  btnRect: null,
  afterClose: null,
  peekArrival: false,

  setOpen: (open) => {
    if (open && !get().open) countView('/assistant') // the path only, never any message text
    set(open ? { open, sheetMounted: true } : { open })
  },

  openFrom: (btn) => {
    set({ btnRect: btn })
    get().setOpen(true)
  },

  finishClose: () => {
    const run = get().afterClose
    set({ sheetMounted: false, afterClose: null })
    run?.()
  },

  send: async (raw) => {
    const text = raw.trim().slice(0, MAX_CHARS)
    if (!text || get().busy) return
    const user: ChatItem = { id: nextId++, role: 'user', text, actions: [] }
    set((s) => ({ items: [...s.items, user], busy: true, failed: false }))
    const wire: WireMessage[] = get().items.map((i) => ({ role: i.role, content: i.text }))
    const { lang, here } = useAppStore.getState()
    try {
      const reply = await askWorker(wire, lang, here?.id ?? null)
      set((s) => ({ items: [...s.items, { id: nextId++, role: 'assistant', text: reply.reply, actions: reply.actions }], busy: false }))
    } catch {
      set({ busy: false, failed: true })
    }
  },
}))
