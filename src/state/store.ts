import { create } from 'zustand'

interface AppState {
  selectedRoomId: string | null
  selectRoom: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedRoomId: null,
  selectRoom: (id) => set({ selectedRoomId: id }),
}))
