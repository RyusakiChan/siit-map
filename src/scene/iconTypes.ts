import type { RoomType } from '../data/types'

const withIcon = new Set<RoomType>(['restroom', 'stairs', 'elevator', 'foodservice', 'library', 'lobby'])

/** Room types that get a facility icon on the map (see icons.tsx). */
export const hasIcon = (type: RoomType): boolean => withIcon.has(type)
