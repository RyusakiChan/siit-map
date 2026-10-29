import type { ReactNode } from 'react'
import type { StringKey } from '../i18n/strings'
import type { TypeFilter } from '../state/store'
import { FacilityIcon } from '../scene/icons'
import { MoreIcon, ServicesIcon, StudyIcon } from './Icons'

export interface Category {
  id: string
  labelKey: StringKey
  types: string[]
  icon: ReactNode
}

// Services is just the lobby until real data says which rooms are student services.
export const categories: Category[] = [
  { id: 'restrooms', labelKey: 'catRestrooms', types: ['restroom'], icon: <FacilityIcon type="restroom" /> },
  { id: 'food', labelKey: 'catFood', types: ['foodservice'], icon: <FacilityIcon type="foodservice" /> },
  { id: 'lifts', labelKey: 'catLifts', types: ['elevator', 'stairs'], icon: <FacilityIcon type="elevator" /> },
  { id: 'study', labelKey: 'catStudy', types: ['library'], icon: <StudyIcon /> },
  { id: 'services', labelKey: 'catServices', types: ['lobby'], icon: <ServicesIcon /> },
]

export const moreIcon = <MoreIcon />

export const toFilter = (c: Category): TypeFilter => ({ labelKey: c.labelKey, types: c.types })
