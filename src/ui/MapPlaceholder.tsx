import { useEffect, useState } from 'react'
import { buildingData as data } from '../data'
import { roomById } from '../data/lookup'
import type { Point } from '../data/types'
import { useT } from '../i18n'
import { roomColor, tokens } from '../theme/colors'
import { useAppStore } from '../state/store'

const outline = data.building.outline
const xs = outline.map((p) => p[0])
const zs = outline.map((p) => p[1])
const PAD = 2
const box = { x: Math.min(...xs) - PAD, z: Math.min(...zs) - PAD, w: Math.max(...xs) - Math.min(...xs) + 2 * PAD, h: Math.max(...zs) - Math.min(...zs) + 2 * PAD }
const pts = (poly: Point[]) => poly.map(([x, z]) => `${x},${z}`).join(' ')
const voidsOf = (level: number) => data.floors.find((f) => f.level === level)?.voids ?? []

/** The floor on show: the chosen one, or the floor of a #/room/... link opened cold. */
function floorShown(view: number | 'all'): number | null {
  if (view !== 'all') return view
  const id = /^#\/room\/([^/?#]+)/.exec(window.location.hash)?.[1]
  return (id && roomById.get(decodeURIComponent(id))?.floor) || null
}

/**
 * Flat SVG outline of the building (and the shown floor's rooms) that stands in for the map until the 3D
 * scene has drawn its first frame; then it fades out over 250 ms and unmounts.
 */
export function MapPlaceholder({ done }: { done: boolean }) {
  const t = useT()
  const view = useAppStore((s) => s.view)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => {
      setGone(true)
      document.getElementById('boot')?.remove() // the static outline from index.html
    }, 300)
    return () => window.clearTimeout(id)
  }, [done])
  if (gone) return null
  const floor = floorShown(view)
  const rooms = floor === null ? [] : data.rooms.filter((r) => r.floor === floor)
  const holes = floor === null ? [] : voidsOf(floor)
  return (
    <div className={done ? 'map-placeholder is-done' : 'map-placeholder'} aria-hidden={done || undefined}>
      <svg viewBox={`${box.x} ${box.z} ${box.w} ${box.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('loading')}>
        <g strokeLinejoin="round" strokeWidth="0.35">
          <polygon points={pts(outline)} fill={tokens.slabTopViewed} stroke={tokens.slabRim} strokeWidth="0.6" />
          {rooms.map((r) => (
            <polygon key={r.id} points={pts(r.polygon)} fill={roomColor(r).top} stroke={tokens.slabRim} />
          ))}
          {holes.map((h, i) => (
            <polygon key={i} points={pts(h)} fill={tokens.voidFloor} stroke={tokens.slabRim} strokeWidth="0.6" />
          ))}
        </g>
      </svg>
      {!done && <p className="loading">{t('loading')}</p>}
    </div>
  )
}
