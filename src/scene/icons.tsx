import type { ReactNode } from 'react'
import type { RoomType } from '../data/types'

/** Types drawn as solid shapes in ink instead of strokes, so they stay clear at 16 px. */
const filled = new Set<RoomType>(['restroom'])

const paths: Partial<Record<RoomType, ReactNode>> = {
  // ISO 7001 style: man on the left, woman (triangle dress) on the right, a thin divider between them.
  restroom: (
    <>
      <circle cx="6" cy="4.5" r="2" />
      <path d="M4.2 8h3.6a1.4 1.4 0 0 1 1.4 1.4V14H8v7H6.5v-5H5.5v5H4v-7H2.8V9.4A1.4 1.4 0 0 1 4.2 8z" />
      <rect x="11.5" y="3" width="1" height="18" rx="0.5" />
      <circle cx="18" cy="4.5" r="2" />
      <path d="M16.6 8h2.8a1.2 1.2 0 0 1 1.2.9L22.6 16h-2.1v5h-1.7v-5h-1.6v5h-1.7v-5H13.4l2-7.1A1.2 1.2 0 0 1 16.6 8z" />
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
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={filled.has(type) ? 'currentColor' : 'none'}
      stroke={filled.has(type) ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  )
}
