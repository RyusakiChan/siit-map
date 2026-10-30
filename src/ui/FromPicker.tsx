import { useMemo, useState } from 'react'
import { buildingData as data } from '../data'
import { deptNames, roomById, roomName, typeLabelKey } from '../data/lookup'
import type { Room } from '../data/types'
import { useT } from '../i18n'
import { go, routeHashPath } from '../router'
import { search } from '../search'
import { recentScanId, useAppStore } from '../state/store'
import { roomColor } from '../theme/colors'
import { SearchIcon } from './Icons'

/** "Directions to X": pick where the route starts. Opens when no QR was scanned in the last 30 minutes. */
export function FromPicker() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const picker = useAppStore((s) => s.fromPicker)
  const closeFromPicker = useAppStore((s) => s.closeFromPicker)
  const [query, setQuery] = useState('')
  const dest = picker ? roomById.get(picker.toId) : undefined
  const results = useMemo(() => (query.trim() ? search(query, data).rooms : []), [query])
  if (!picker || !dest) return null

  const choose = (room: Room) => {
    if (room.id === dest.id) return
    go(routeHashPath(room.id, dest.id)) // RouteEffects plans it; the picker closes with the route
  }
  const entrance = data.rooms.find((r) => r.type === 'lobby' && r.floor === 1)
  const lift = data.rooms.find((r) => r.type === 'elevator' && r.floor === 1)
  const scanId = recentScanId()
  const scan = scanId ? data.qrPoints.find((q) => q.id === scanId) : undefined
  const popular = data.rooms.filter((r) => r.popular)
  const list = (query.trim() ? results : popular).filter((r) => r.id !== dest.id)

  return (
    <div className="screen search-screen" role="dialog" aria-label={t('directionsTo', { room: roomName(dest, lang) })}>
      <div className="search-head">
        <label className="field active">
          <SearchIcon />
          <span className="sr-only">{t('fromPlaceholder')}</span>
          <input type="search" autoFocus value={query} placeholder={t('fromPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="text-btn" onClick={closeFromPicker}>
          {t('cancel')}
        </button>
      </div>
      <div className="screen-body">
        <h2 className="section first">{t('directionsTo', { room: roomName(dest, lang) })}</h2>
        {!query.trim() && (
          <>
            <h2 className="section">{t('fromQuick')}</h2>
            <div className="chips wrap">
              {scan && (
                <button type="button" className="chip" onClick={() => go(routeHashPath(`@${scan.id}`, dest.id))}>
                  {t('quickScanned', { n: scan.floor })}
                </button>
              )}
              {entrance && entrance.id !== dest.id && (
                <button type="button" className="chip" onClick={() => choose(entrance)}>
                  {t('quickEntrance')}
                </button>
              )}
              {lift && lift.id !== dest.id && (
                <button type="button" className="chip" onClick={() => choose(lift)}>
                  {t('quickLift', { n: 1 })}
                </button>
              )}
            </div>
          </>
        )}
        <h2 className="section">{query.trim() ? t('rooms') : t('fromPopular')}</h2>
        {query.trim() && list.length === 0 && <p className="note">{t('noResults')}</p>}
        <ul className="list">
          {list.map((room) => {
            return (
              <li key={room.id}>
                <button type="button" className="row" onClick={() => choose(room)}>
                  <span className="row-bar" style={{ background: roomColor(room).top }} aria-hidden="true" />
                  <span className="mono row-num">{room.number ?? ''}</span>
                  <span className="row-main">
                    <span className="row-title">{roomName(room, lang)}</span>
                    <span className="row-sub">
                      {[deptNames(room, lang) ?? t(typeLabelKey[room.type]), t('floor', { n: room.floor })].join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
