import type { ReactNode } from 'react'
import type { RoomType } from '../data/types'

const paths: Partial<Record<RoomType, ReactNode>> = {
  restroom: (
    <>
      <circle cx="8" cy="5" r="2" />
      <circle cx="16" cy="5" r="2" />
      <path d="M8 9v11M5.5 20h5M16 9v11M12.5 12h7M13 20h6" />
    </>
  ),
  stairs: <path d="M4 20h4v-4h4v-4h4V8h4" />,
  elevator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 10l3-3 3 3M9 14l3 3 3-3" />
    </>
  ),
  foodservice: <path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2" />,
  library: <path d="M5 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5zM19 4h-6v14h6z" />,
  lobby: <path d="M5 21V4h9v17M14 21h5M10 12h.01" />,
}

/** Facility icon drawn in ink; decorative (the room name is the accessible text). */
export function FacilityIcon({ type }: { type: RoomType }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[type]}
    </svg>
  )
}
