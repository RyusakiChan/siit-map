import { buildingData as data } from '../data'
import { config } from '../config'
import { deptById, deptName, deptRooms, roomName } from '../data/lookup'
import { FacilityIcon } from '../scene/icons'
import { hasIcon } from '../scene/iconTypes'
import { useT } from '../i18n'
import { pick } from '../i18n'
import { back, go } from '../router'
import { useAppStore } from '../state/store'
import { circulation, deptColor, tokens, typeTints } from '../theme/colors'
import { typeLabelKey } from '../data/lookup'
import type { RoomType } from '../data/types'
import { BackIcon, ChevronIcon, CloseIcon, ExternalIcon } from './Icons'
import { DeptBadge } from './DeptBadge'

function ScreenHeader({ title }: { title: string }) {
  const t = useT()
  return (
    <div className="screen-head">
      <button type="button" className="square-btn bordered" aria-label={t('backToMap')} onClick={back}>
        <BackIcon />
      </button>
      <span className="screen-title">{title}</span>
    </div>
  )
}

export function DepartmentScreen({ id }: { id: string }) {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const selectRoom = useAppStore((s) => s.selectRoom)
  const highlightDept = useAppStore((s) => s.highlightDept)
  const dept = deptById.get(id)
  if (!dept) return null
  const rooms = deptRooms(id).sort((a, b) => a.floor - b.floor || (a.number ?? '').localeCompare(b.number ?? ''))
  const color = deptColor(dept)?.top ?? tokens.muted
  const second = lang === 'th' ? dept.name : dept.nameTh
  return (
    <div className="screen" role="dialog" aria-label={deptName(dept, lang)}>
      <ScreenHeader title={t('department')} />
      <div className="screen-body padded">
        <div className="dept-bar" style={{ background: color }} aria-hidden="true" />
        <span className="dept-shown">
          <DeptBadge dept={dept} size={28} />
          {t('shownAs', { letter: dept.letter })}
        </span>
        <h1 className="screen-h1">{deptName(dept, lang)}</h1>
        {second && <span className="muted-15">{second}</span>}
        {dept.summary && <p className="body-text">{dept.summary}</p>}
        <a className="link-card" href={dept.url ?? config.siitUrl} target="_blank" rel="noreferrer">
          {t('officialPage')}
          <ExternalIcon />
        </a>
        <h2 className="section">
          {t('rooms')} · {rooms.length}
        </h2>
        <ul className="list flush">
          {rooms.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="row"
                onClick={() => {
                  selectRoom(r.id, { focus: true })
                  go('/')
                }}
              >
                <span className="mono row-num">{r.number}</span>
                <span className="row-main">
                  <span className="row-title">{roomName(r, lang)}</span>
                </span>
                <span className="row-sub">{t('floor', { n: r.floor })}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="screen-foot">
        <button
          type="button"
          className="action-btn wide"
          onClick={() => {
            highlightDept(id)
            go('/')
          }}
        >
          {t('showDeptRooms')}
        </button>
      </div>
    </div>
  )
}

export function AboutScreen() {
  const t = useT()
  return (
    <div className="screen" role="dialog" aria-label={t('aboutTitle')}>
      <ScreenHeader title={t('aboutTitle')} />
      <div className="screen-body padded">
        <h1 className="screen-h1">SIIT Map</h1>
        <p className="body-text first">{t('aboutIntro')}</p>
        <div className="card">
          <span className="section tight">{t('madeBy')}</span>
          <strong className="muted-15 ink">{config.groupName}</strong>
          <span className="body-14">{t('studentProject')}</span>
          <span className="muted-13">{t('notOfficial')}</span>
        </div>
        <h2 className="section">{t('theData')}</h2>
        {data.building.sampleData && (
          <p className="body-14">
            <span className="sample-tag">{t('sampleTag')}</span> {t('sampleNote')}
          </p>
        )}
        <p className="body-14">
          {t('osmNote')}{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            openstreetmap.org/copyright
          </a>
        </p>
        <p className="body-14 muted">{t('lastUpdated', { date: config.buildDate })}</p>
        {config.assistantUrl && (
          <>
            <h2 className="section">{t('askTitle').toUpperCase()}</h2>
            <p className="body-14">{t('askPrivacy')}</p>
          </>
        )}
        {config.reportUrl && (
          <>
            <h2 className="section">{t('somethingWrong')}</h2>
            <p className="body-14">{t('somethingWrongText')}</p>
            <a className="link-card centered" href={config.reportUrl} target="_blank" rel="noreferrer">
              {t('reportProblem')}
            </a>
          </>
        )}
      </div>
      <div className="foot-note">{t('noCookies')}</div>
    </div>
  )
}

const tintRows = [
  ['study', typeTints.study, 'keyTintStudy'],
  ['office', typeTints.office, 'keyTintOffice'],
  ['library', typeTints.library, 'keyTintLibrary'],
  ['facility', typeTints.facility, 'keyTintFacility'],
  ['circulation', circulation, 'keyTintCirculation'],
  ['other', typeTints.other, 'keyTintOther'],
] as const

const facilityTypes: RoomType[] = ['restroom', 'stairs', 'elevator', 'foodservice', 'library', 'lobby']

export function KeySheet() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const setKeyOpen = useAppStore((s) => s.setKeyOpen)
  return (
    <div className="modal" role="dialog" aria-label={t('keyTitle')}>
      <button type="button" className="backdrop" tabIndex={-1} aria-hidden="true" onClick={() => setKeyOpen(false)} />
      <div className="key-sheet">
        <div className="key-head">
          <h2 className="screen-title">{t('keyTitle')}</h2>
          <button type="button" className="square-btn bordered" aria-label={t('close')} onClick={() => setKeyOpen(false)}>
            <CloseIcon />
          </button>
        </div>
        <h3 className="section tight">{t('keyDepartments')}</h3>
        <ul className="list flush">
          {data.departments.map((d) => (
            <li key={d.id} className="key-row">
              <span className="key-swatch" style={{ background: deptColor(d)?.top }} aria-hidden="true" />
              <DeptBadge dept={d} size={24} />
              <span>{pick(lang, d.name, d.nameTh)}</span>
            </li>
          ))}
        </ul>
        <h3 className="section">{t('keyRoomTypes')}</h3>
        <ul className="list flush">
          {tintRows.map(([key, color, label]) => (
            <li key={key} className="key-row">
              <span className="key-swatch" style={{ background: color.top, boxShadow: `inset 0 -3px 0 ${color.side}` }} aria-hidden="true" />
              <span>{t(label)}</span>
            </li>
          ))}
        </ul>
        <h3 className="section">{t('keyFacilities')}</h3>
        <ul className="list flush">
          {facilityTypes.filter(hasIcon).map((type) => (
            <li key={type} className="key-row">
              <span className="map-icon">
                <FacilityIcon type={type} />
              </span>
              <span>{t(typeLabelKey[type])}</span>
            </li>
          ))}
        </ul>
        <p className="muted-13">{t('keyDimmed')}</p>
      </div>
    </div>
  )
}

export { ChevronIcon }
