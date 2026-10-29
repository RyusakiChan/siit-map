import { create } from 'zustand'
import { buildingData as data } from '../data'

/** 'all' shows the stacked building; a number shows that floor alone. */
export type FloorView = 'all' | number

interface AppState {
  view: FloorView
  selectedRoomId: string | null
  /** True when the camera is close enough to show small-room labels. */
  zoomedIn: boolean
  setView: (view: FloorView) => void
  /** Selecting a room also switches to its floor. */
  selectRoom: (id: string | null) => void
  setZoomedIn: (zoomedIn: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'all',
  selectedRoomId: null,
  zoomedIn: false,
  setView: (view) => {
    const sel = data.rooms.find((r) => r.id === get().selectedRoomId)
    // Leaving a floor clears a selection that would no longer be on show.
    set({ view, selectedRoomId: sel && view !== 'all' && sel.floor !== view ? null : get().selectedRoomId })
  },
  selectRoom: (id) => {
    const room = id ? data.rooms.find((r) => r.id === id) : undefined
    set(room ? { selectedRoomId: room.id, view: room.floor } : { selectedRoomId: null })
  },
  setZoomedIn: (zoomedIn) => set({ zoomedIn }),
}))
