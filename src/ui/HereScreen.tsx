import { useLayoutEffect, useMemo, useRef } from 'react'
import { buildingData as data } from '../data'
import { deptOf, qrById, qrLabel, roomName } from '../data/lookup'
import type { Room } from '../data/types'
import { useT } from '../i18n'
import { nearestPlaces, type NearPlace } from '../nav'
import { go, routeHashPath } from '../router'
import { useAppStore } from '../state/store'
import { FacilityIcon } from '../scene/icons'
import { hasIcon } from '../scene/iconTypes'
import { categories } from './categories'
import { DeptBadge } from './DeptBadge'
import { CloseIcon, LocateIcon } from './Icons'

/** "You are here · Floor 3 · Lift lobby": replaces the SAMPLE line under the chips while a QR spot is on show. */
export function HereBanner() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const here = useAppStore((s) => s.here)
  const open = useAppStore((s) => s.hereOpen)
  const route = useAppStore((s) => s.route !== null)
  const crossFloor = useAppStore((s) => s.banner !== null)
  const closeHere = useAppStore((s) => s.closeHere)
  const qr = here ? qrById.get(here.id) : undefined
  if (!here || !qr || !open || route || crossFloor) return null
  return (
    <div className="banner here-banner" role="status" key={here.id}>
      <span className="banner-floor" aria-hidden="true">{here.floor}</span>
      <div className="banner-text">
        <strong>{t('hereTitle')}</strong>
        <span className="here-where">
          {data.building.sampleData && <span className="sample-badge">{t('sampleData')}</span>}
          {t('hereWhere', { n: here.floor, place: qrLabel(qr, lang) })}
        </span>
        <span className="here-turned">{t('hereTurned')}</span>
      </div>
      <button type="button" className="square-btn small" aria-label={t('hereClose')} onClick={closeHere}>
        <CloseIcon />
      </button>
    </div>
  )
}

function PlaceMark({ room }: { room: Room }) {
  const dept = deptOf(room)
  if (hasIcon(room.type)) return <span className="near-mark"><FacilityIcon type={room.type} /></span>
  if (dept) return <span className="near-mark"><DeptBadge dept={dept} size={24} /></span>
  return <span className="near-mark near-dot" aria-hidden="true" />
}

/** The category tiles that double as quick picks on the Near you sheet. */
const QUICK = ['restrooms', 'lifts', 'food']

const startRoute = (qrId: string, room: Room) => go(routeHashPath(`@${qrId}`, room.id))

/** The Near you sheet: the 5 nearest places, quick picks, and "Find a room from here". */
export function NearSheet() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const here = useAppStore((s) => s.here)
  const openSearchFromHere = useAppStore((s) => s.openSearchFromHere)
  const setPeekH = useAppStore((s) => s.setPeekH)
  const card = useRef<HTMLDivElement>(null)
  const id = here?.id ?? ''
  // One walk over the graph serves the list and the three quick picks.
  const all = useMemo(() => nearestPlaces(id, { count: Infinity }), [id])
  const places = all.slice(0, 5)
  const quick = QUICK.flatMap((id) => {
    const c = categories.find((x) => x.id === id)!
    const place = all.find((p) => c.types.includes(p.room.type))
    return place ? [{ key: c.labelKey, place }] : []
  })

  // The map frames itself above the sheet, so the sheet reports its height.
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const measure = () => setPeekH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setPeekH, id])

  if (!here) return null
  const row = (p: NearPlace) => (
    <li key={p.room.id}>
      <button type="button" className="row near-row" onClick={() => startRoute(here.id, p.room)}>
        <PlaceMark room={p.room} />
        <span className="row-main">
          <span className="row-title">{roomName(p.room, lang)}</span>
          <span className="row-sub">
            {p.room.number && <span className="mono">{p.room.number} · </span>}
            {t('nearWalk', { m: p.meters, min: p.minutes })}
            {!p.sameFloor && ` · ${t('nearOtherFloor', { n: p.room.floor })}`}
          </span>
        </span>
      </button>
    </li>
  )
  return (
    <div ref={card} className="bottom-bar near-sheet" role="region" aria-label={t('nearYou')}>
      <h2 className="near-title">{t('nearYou')}</h2>
      {quick.length > 0 && (
        <div className="near-chips" role="group" aria-label={t('nearChips')}>
          {quick.map((c) => (
            <button key={c.key} type="button" className="chip" onClick={() => startRoute(here.id, c.place.room)}>
              {t(c.key)}
            </button>
          ))}
        </div>
      )}
      <ul className="list near-list">{places.map(row)}</ul>
      <button type="button" className="action-btn wide" onClick={openSearchFromHere}>
        {t('findFromHere')}
      </button>
      <a className="credit-line" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {t('osmCredit')}
      </a>
    </div>
  )
}

/** Round button, bottom left of the map, once the person has moved the view away from the QR spot. */
export function BackToMe() {
  const t = useT()
  const show = useAppStore((s) => s.here !== null && s.hereOpen && s.hereMoved && s.route === null && (s.selectedRoomId === null || s.snap === 'peek'))
  const peekH = useAppStore((s) => s.peekH)
  const recenter = useAppStore((s) => s.recenterHere)
  if (!show) return null
  return (
    <button type="button" className="here-back" style={{ bottom: peekH + 12 }} aria-label={t('backToMe')} title={t('backToMe')} onClick={recenter}>
      <LocateIcon />
    </button>
  )
}
