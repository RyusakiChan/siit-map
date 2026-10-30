import { useMemo, useState, type ReactNode } from 'react'
import { buildingData as data } from '../data'
import { deptName, deptNames, deptRooms, qrById, qrLabel, roomById, roomName, typeLabelKey } from '../data/lookup'
import type { Department, Room, RoomType } from '../data/types'
import { useT, type T } from '../i18n'
import type { Lang } from '../i18n/strings'
import { go, routeHashPath } from '../router'
import { roomsOfTypes, search } from '../search'
import { readStore, writeStore } from '../storage'
import { useAppStore } from '../state/store'
import { deptColor, roomColor, tokens } from '../theme/colors'
import { categories, moreIcon, toFilter } from './categories'
import { ChevronIcon, ClockIcon, SearchIcon } from './Icons'

const RECENT_KEY = 'siit-map.recent'

function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(readStore(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && roomById.has(x)).slice(0, 5) : []
  } catch {
    return []
  }
}

function addRecent(id: string) {
  writeStore(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 5)))
}

function highlight(text: string, query: string): ReactNode {
  const q = query.trim()
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  )
}

function useOpenRoom() {
  const selectRoom = useAppStore((s) => s.selectRoom)
  const closeSearch = useAppStore((s) => s.closeSearch)
  const fromQr = useAppStore((s) => s.searchFromQr)
  return (room: Room) => {
    addRecent(room.id)
    closeSearch()
    if (fromQr) {
      // "Find a room from here": the pick starts a route from the QR spot.
      go(routeHashPath(`@${fromQr}`, room.id))
      return
    }
    selectRoom(room.id, { focus: true, cross: true })
  }
}

function RoomRow({ room, query = '', lang, t, onOpen }: { room: Room; query?: string; lang: Lang; t: T; onOpen: (r: Room) => void }) {
  const color = roomColor(room).top
  const sub = [deptNames(room, lang) ?? t(typeLabelKey[room.type]), t('floor', { n: room.floor })].join(' · ')
  return (
    <li>
      <button type="button" className="row" onClick={() => onOpen(room)}>
        <span className="row-bar" style={{ background: color }} aria-hidden="true" />
        <span className="mono row-num">{room.number ?? ''}</span>
        <span className="row-main">
          <span className="row-title">{highlight(roomName(room, lang), query)}</span>
          <span className="row-sub">{sub}</span>
        </span>
      </button>
    </li>
  )
}

function DeptRow({ dept, lang, t }: { dept: Department; lang: Lang; t: T }) {
  const rooms = deptRooms(dept.id)
  const floors = rooms.map((r) => r.floor)
  const a = Math.min(...floors)
  const b = Math.max(...floors)
  const closeSearch = useAppStore((s) => s.closeSearch)
  return (
    <li>
      <button
        type="button"
        className="row"
        onClick={() => {
          closeSearch()
          go(`/dept/${dept.id}`)
        }}
      >
        <span className="row-swatch" style={{ background: deptColor(dept)?.top ?? tokens.muted }} aria-hidden="true" />
        <span className="row-main">
          <span className="row-title">{deptName(dept, lang)}</span>
          <span className="row-sub">
            {t('roomsCount', { n: rooms.length })} · {a === b ? t('floor', { n: a }) : t('floorsRange', { a, b })}
          </span>
        </span>
        <ChevronIcon />
      </button>
    </li>
  )
}

export function SearchScreen() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const filter = useAppStore((s) => s.filter)
  const openSearch = useAppStore((s) => s.openSearch)
  const closeSearch = useAppStore((s) => s.closeSearch)
  const openRoom = useOpenRoom()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [recent] = useState(readRecent)
  const fromQr = useAppStore((s) => s.searchFromQr)
  const fromQrLabel = fromQr && qrById.get(fromQr) ? qrLabel(qrById.get(fromQr)!, lang) : null

  const results = useMemo(() => search(query, data), [query])
  const filtered = useMemo(() => (filter ? roomsOfTypes(filter.types, data) : []), [filter])
  const popular = useMemo(() => data.rooms.filter((r) => r.popular), [])
  const typing = query.trim().length > 0
  const row = (r: Room, q = '') => <RoomRow key={r.id} room={r} query={q} lang={lang} t={t} onOpen={openRoom} />

  let body: ReactNode
  if (typing) {
    const shown = showAll ? results.rooms : results.rooms.slice(0, 5)
    body = (
      <>
        {results.rooms.length === 0 && results.departments.length === 0 && <p className="note">{t('noResults')}</p>}
        {results.rooms.length > 0 && (
          <>
            <h2 className="section">
              {t('rooms')} · {results.rooms.length}
            </h2>
            <ul className="list">{shown.map((r) => row(r, query))}</ul>
            {!showAll && results.rooms.length > 5 && (
              <button type="button" className="link-btn" onClick={() => setShowAll(true)}>
                {t('showAll', { n: results.rooms.length })}
              </button>
            )}
          </>
        )}
        {results.departments.length > 0 && (
          <>
            <h2 className="section">
              {t('departments')} · {results.departments.length}
            </h2>
            <ul className="list">
              {results.departments.map((d) => (
                <DeptRow key={d.id} dept={d} lang={lang} t={t} />
              ))}
            </ul>
          </>
        )}
        <h2 className="section">{t('tryAlso')}</h2>
        <div className="chips wrap">
          {categories.map((c) => (
            <button key={c.id} type="button" className="chip" onClick={() => openSearch(toFilter(c))}>
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      </>
    )
  } else if (moreOpen) {
    const types = [...new Set(data.rooms.map((r) => r.type))] as RoomType[]
    body = (
      <>
        <h2 className="section">{t('allTypes')}</h2>
        <ul className="list">
          {types.map((type) => (
            <li key={type}>
              <button type="button" className="row" onClick={() => { setMoreOpen(false); openSearch({ labelKey: typeLabelKey[type], types: [type] }) }}>
                <span className="row-main">
                  <span className="row-title">{t(typeLabelKey[type])}</span>
                </span>
                <ChevronIcon />
              </button>
            </li>
          ))}
        </ul>
      </>
    )
  } else if (filter) {
    body = (
      <>
        <h2 className="section">
          {t(filter.labelKey)} · {filtered.length}
        </h2>
        {filtered.length === 0 ? <p className="note">{t('noRoomsHere')}</p> : <ul className="list">{filtered.map((r) => row(r))}</ul>}
      </>
    )
  } else {
    body = (
      <>
        {fromQrLabel && <p className="note from-note">{t('findFromHint', { place: fromQrLabel })}</p>}
        <h2 className="section first">{t('findNearby')}</h2>
        <div className="tiles">
          {categories.map((c) => (
            <button key={c.id} type="button" className="tile" onClick={() => openSearch(toFilter(c))}>
              {c.icon}
              {t(c.labelKey)}
            </button>
          ))}
          <button type="button" className="tile" onClick={() => setMoreOpen(true)}>
            {moreIcon}
            {t('catMore')}
          </button>
        </div>
        {popular.length > 0 && (
          <>
            <h2 className="section">{t('popular')}</h2>
            <ul className="list">{popular.map((r) => row(r))}</ul>
          </>
        )}
        {recent.length > 0 && (
          <>
            <h2 className="section">{t('recent')}</h2>
            <ul className="list">
              {recent.map((id) => {
                const r = roomById.get(id)
                return (
                  r && (
                    <li key={id}>
                      <button type="button" className="row" onClick={() => openRoom(r)}>
                        <ClockIcon />
                        <span className="row-main">
                          <span className="row-title">{roomName(r, lang)}</span>
                        </span>
                        <span className="row-sub">{t('floor', { n: r.floor })}</span>
                      </button>
                    </li>
                  )
                )
              })}
            </ul>
            <p className="note">{t('recentNote')}</p>
          </>
        )}
      </>
    )
  }

  return (
    <div className="screen search-screen" role="dialog" aria-label={t('searchLabel')}>
      <div className="search-head">
        <label className="field active">
          <SearchIcon />
          <span className="sr-only">{t('searchLabel')}</span>
          <input
            type="search"
            autoFocus
            value={query}
            placeholder={t('searchInputPlaceholder')}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowAll(false)
            }}
          />
        </label>
        <button type="button" className="text-btn" onClick={closeSearch}>
          {t('cancel')}
        </button>
      </div>
      <p className="sr-only" role="status">
        {typing ? `${t('rooms')} · ${results.rooms.length}, ${t('departments')} · ${results.departments.length}` : ''}
      </p>
      <div className="screen-body">{body}</div>
      {typing && <div className="foot-note">{t('searchHelp')}</div>}
    </div>
  )
}
