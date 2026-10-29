import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { deptName, deptOf, roomById, roomName } from '../data/lookup'
import { useT } from '../i18n'
import { go, roomUrl } from '../router'
import { useAppStore } from '../state/store'
import { DeptBadge } from './DeptBadge'
import { CloseIcon, PhotoIcon, ShareIcon } from './Icons'

function Credit({ className = 'credit-line' }: { className?: string }) {
  const t = useT()
  return (
    <a className={className} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
      {t('osmCredit')}
    </a>
  )
}

export function RoomSheet() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const id = useAppStore((s) => s.selectedRoomId)
  const snap = useAppStore((s) => s.snap)
  const setSnap = useAppStore((s) => s.setSnap)
  const setPeekHStore = useAppStore((s) => s.setPeekH)
  const selectRoom = useAppStore((s) => s.selectRoom)
  const showNotice = useAppStore((s) => s.showNotice)
  const room = id ? roomById.get(id) : undefined
  const sheet = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const [peekH, setPeekH] = useState(120)
  const [dragY, setDragY] = useState<number | null>(null)
  const drag = useRef({ startY: 0, startOffset: 0, max: 0, moved: false })

  useLayoutEffect(() => {
    const el = head.current
    if (!el) return
    const measure = () => {
      setPeekH(el.offsetHeight)
      if (useAppStore.getState().snap === 'peek') setPeekHStore(el.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [room?.id, snap, setPeekHStore])

  // Scroll the full card back to the top when another room opens.
  useEffect(() => {
    sheet.current?.querySelector('.sheet-body')?.scrollTo?.({ top: 0 })
  }, [id])

  if (!room) return null
  const dept = deptOf(room)
  const other = lang === 'th' ? (room.nameTh ? room.name : undefined) : room.nameTh

  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    const h = sheet.current?.offsetHeight ?? 0
    const max = Math.max(0, h - peekH)
    drag.current = { startY: e.clientY, startOffset: snap === 'full' ? 0 : max, max, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragY(drag.current.startOffset)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (dragY === null) return
    const d = drag.current
    const dy = e.clientY - d.startY
    if (Math.abs(dy) > 6) d.moved = true
    setDragY(Math.min(d.max, Math.max(0, d.startOffset + dy)))
  }
  const onUp = (e: ReactPointerEvent) => {
    if (dragY === null) return
    const d = drag.current
    const dy = e.clientY - d.startY
    if (!d.moved) setSnap(snap === 'full' ? 'peek' : 'full')
    else setSnap(dy < 0 || (snap === 'full' && dy < d.max / 3) ? (dy < -30 || dragY < d.max / 2 ? 'full' : snap) : 'peek')
    setDragY(null)
  }

  const share = async () => {
    const url = roomUrl(room.id)
    try {
      if (navigator.share) {
        await navigator.share({ title: roomName(room, lang), url })
        return
      }
      await navigator.clipboard.writeText(url)
      showNotice('linkCopied')
    } catch {
      /* the user cancelled the share sheet, or the clipboard is blocked */
    }
  }

  const style = dragY !== null ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined
  const details: [string, string | undefined][] = [
    [t('where'), `${t('floor', { n: room.floor })} · ${t('buildingName')}`],
    [t('hours'), room.hours],
    [t('contact'), room.contact],
  ]

  return (
    <div
      ref={sheet}
      className={`sheet ${snap}`}
      style={{ ...style, ['--peek-h' as string]: `${peekH}px` }}
      role="dialog"
      aria-label={roomName(room, lang)}
      key={room.id}
    >
      <div ref={head} className="sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDragY(null)}>
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-title-row">
          <div className="sheet-title">
            <h2 className="room-name">{roomName(room, lang)}</h2>
            <span className="room-meta">
              {room.number && <span className="mono ink">{room.number}</span>}
              {room.number && ' · '}
              {t('floor', { n: room.floor })}
              {dept && (
                <>
                  {' · '}
                  <span className="dept-inline">
                    <DeptBadge dept={dept} />
                    {deptName(dept, lang)}
                  </span>
                </>
              )}
            </span>
          </div>
          <button type="button" className="square-btn" aria-label={t('share')} onClick={share}>
            <ShareIcon />
          </button>
          {snap === 'full' && (
            <button type="button" className="square-btn" aria-label={t('closeCard')} onClick={() => selectRoom(null)}>
              <CloseIcon />
            </button>
          )}
        </div>
        {snap === 'peek' ? (
          <button type="button" className="hint-btn" onClick={() => setSnap('full')}>
            {t('swipeUp')}
          </button>
        ) : (
          <span className="hint-btn spacer" aria-hidden="true" />
        )}
        {snap === 'peek' && <Credit />}
      </div>

      {snap === 'full' && <Credit className="credit-float" />}
      <div className="sheet-body" inert={snap === 'peek'}>
        <div className="sheet-intro">
          <div className="photo-ph">
            <PhotoIcon />
            <span>{t('noPhoto')}</span>
          </div>
          <div className="sheet-intro-text">
            {other && <p className="room-other">{other}</p>}
            <dl className="details">
              {details.map(([k, v]) => v && (
                <div key={k} className="detail">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {room.description && <p className="body-text">{room.description}</p>}
        {dept && (
          <button type="button" className="action-btn" onClick={() => go(`/dept/${dept.id}`)}>
            {t('departmentDetails')}
          </button>
        )}
      </div>
    </div>
  )
}
