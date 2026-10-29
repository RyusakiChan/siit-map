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
  setOpen: (open: boolean) => void
  send: (text: string) => Promise<void>
}

let nextId = 1

/** The conversation lives in memory only: it is gone when the tab closes. */
export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  items: [],
  busy: false,
  failed: false,

  setOpen: (open) => {
    if (open && !get().open) countView('/assistant') // the path only, never any message text
    set({ open })
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
