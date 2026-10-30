import { useEffect } from 'react'
import { buildingData as data } from '../data'
import { deptById, deptName, roomById, roomName } from '../data/lookup'
import { useT } from '../i18n'
import { go } from '../router'
import { useAppStore, type FloorView } from '../state/store'
import { deptColor } from '../theme/colors'
import { categories, toFilter } from './categories'
import { CloseIcon, InfoIcon, SearchIcon } from './Icons'

export function TopBar() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const openSearch = useAppStore((s) => s.openSearch)
  const selected = useAppStore((s) => (s.selectedRoomId ? roomById.get(s.selectedRoomId) : undefined))
  return (
    <div className="topbar">
      <button type="button" className="field" onClick={() => openSearch()} aria-label={t('searchLabel')}>
        <SearchIcon />
        <span className={selected ? 'field-text' : 'field-text placeholder'}>{selected ? roomName(selected, lang) : t('searchPlaceholder')}</span>
      </button>
      <button
        type="button"
        className="pill-btn"
        lang={lang === 'th' ? 'en' : 'th'}
        aria-label={t(lang === 'th' ? 'switchToEnglish' : 'switchToThai')}
        onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
      >
        {t('langButton')}
      </button>
      <button type="button" className="square-btn" aria-label={t('aboutLabel')} onClick={() => go('/about')}>
        <InfoIcon />
      </button>
    </div>
  )
}

export function Chips() {
  const t = useT()
  const openSearch = useAppStore((s) => s.openSearch)
  const away = useAppStore((s) => s.banner !== null) // the banner takes their place
  return (
    <div className={away ? 'chips is-away' : 'chips'}>
      {categories.slice(0, 4).map((c) => (
        <button key={c.id} type="button" className="chip" onClick={() => openSearch(toFilter(c))}>
          {c.id !== 'study' && c.icon}
          {t(c.labelKey)}
        </button>
      ))}
    </div>
  )
}

export function StatusRow() {
  const t = useT()
  const view = useAppStore((s) => s.view)
  const hl = useAppStore((s) => (s.highlightDeptId ? deptById.get(s.highlightDeptId) : undefined))
  const lang = useAppStore((s) => s.lang)
  const highlightDept = useAppStore((s) => s.highlightDept)
  const away = useAppStore((s) => s.banner !== null)
  return (
    <div className={away ? 'status-row is-away' : 'status-row'}>
      {data.building.sampleData && <span className="sample-badge">{t('sampleData')}</span>}
      <span className="status-text">
        {t('buildingName')} · {view === 'all' ? t('allFloors') : t('floor', { n: view })}
      </span>
      {hl && (
        <button type="button" className="chip chip-on" onClick={() => highlightDept(null)}>
          {t('showingDept', { name: deptName(hl, lang) })}
          <CloseIcon />
          <span className="sr-only">{t('clear')}</span>
        </button>
      )}
    </div>
  )
}

export function FloorPicker() {
  const t = useT()
  const view = useAppStore((s) => s.view)
  const previous = useAppStore((s) => s.previousFloor)
  const setView = useAppStore((s) => s.setView)
  // The full room card and the steps card cover the lower part of the screen, so the picker packs tighter above it.
  const compact = useAppStore((s) => (s.snap === 'full' && s.selectedRoomId !== null) || s.route !== null)
  const options: { value: FloorView; label: string; aria: string }[] = [
    { value: 'all', label: t('all'), aria: t('allFloors') },
    ...[...data.floors].reverse().map((f) => ({
      value: f.level,
      label: String(f.level),
      aria: f.level === view ? t('floorNow', { n: f.level }) : f.level === previous ? t('floorWas', { n: f.level }) : t('floor', { n: f.level }),
    })),
  ]
  return (
    <div className={compact ? 'floor-picker compact' : 'floor-picker'} role="group" aria-label={t('floors')}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === view ? 'floor-btn on' : 'floor-btn'} aria-label={o.aria} aria-pressed={o.value === view} onClick={() => setView(o.value)}>
          {o.label}
          {o.value === previous && <span className="floor-dot" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}

export function BottomBar() {
  const t = useT()
  const setKeyOpen = useAppStore((s) => s.setKeyOpen)
  const hereFloor = useAppStore((s) => s.here?.floor)
  return (
    <div className="bottom-bar">
      <div className="bottom-row">
        <span className="hint">{hereFloor ? t('youAreHere', { n: hereFloor }) : t('tapHint')}</span>
        <button type="button" className="key-btn" onClick={() => setKeyOpen(true)}>
          <span className="key-swatches" aria-hidden="true">
            {[...new Set(data.departments.map((d) => deptColor(d)?.top).filter(Boolean))].map((top) => (
              <span key={top} style={{ background: top }} />
            ))}
          </span>
          {t('key')}
        </button>
      </div>
      <a className="credit-line" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        {t('osmCredit')}
      </a>
    </div>
  )
}

/** "Now showing Floor 3 · You were on Floor 2 · go up one floor", slides down once. */
export function Banner() {
  const t = useT()
  const banner = useAppStore((s) => s.banner)
  const dismiss = useAppStore((s) => s.dismissBanner)
  if (!banner) return null
  const diff = banner.floor - banner.from
  const n = Math.abs(diff)
  const amount = n === 1 ? t('oneFloor') : t('nFloors', { n })
  return (
    <div className="banner" role="status" key={`${banner.from}-${banner.floor}`}>
      <span className="banner-floor" aria-hidden="true">{banner.floor}</span>
      <div className="banner-text">
        <strong>{t('nowShowing', { n: banner.floor })}</strong>
        <span>
          {t('youWereOn', { n: banner.from })} · {t(diff > 0 ? 'goUp' : 'goDown', { n: amount })}
        </span>
      </div>
      <button type="button" className="square-btn small" aria-label={t('dismiss')} onClick={dismiss}>
        <CloseIcon />
      </button>
    </div>
  )
}

export function Toast() {
  const t = useT()
  const notice = useAppStore((s) => s.notice)
  const clearNotice = useAppStore((s) => s.clearNotice)
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(clearNotice, 3500)
    return () => window.clearTimeout(id)
  }, [notice, clearNotice])
  if (!notice) return null
  return (
    <div className="toast" role="status" key={notice.tick}>
      {t(notice.key)}
    </div>
  )
}
