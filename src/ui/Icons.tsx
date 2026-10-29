import type { ReactNode } from 'react'

function Svg({ children, size = 20, width = 2 }: { children: ReactNode; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const SearchIcon = ({ size = 18 }: { size?: number }) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)
export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </Svg>
)
export const ShareIcon = () => (
  <Svg>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
  </Svg>
)
export const BackIcon = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
export const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const ChevronIcon = () => (
  <Svg size={16}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)
export const ExternalIcon = () => (
  <Svg size={18}>
    <path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5" />
  </Svg>
)
export const ClockIcon = () => (
  <Svg size={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const MoreIcon = () => (
  <Svg>
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </Svg>
)
export const StudyIcon = () => (
  <Svg>
    <path d="M4 6h16v10H4zM2 20h20" />
  </Svg>
)
export const ServicesIcon = InfoIcon
export const PhotoIcon = () => (
  <Svg size={28} width={1.5}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </Svg>
)
