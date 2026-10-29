import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../i18n'
import { go, parseHash } from '../router'
import { useAppStore } from '../state/store'
import { ChevronIcon, CloseIcon, ExternalIcon } from '../ui/Icons'
import { assistantEnabled, MAX_CHARS, type AssistantAction } from './api'
import { useChatStore, type ChatItem } from './chatStore'
import { EASE_BACK, EASE_IN, EASE_OUT, LINE_MS, play, reduced, revealStep, revealTotal, setFlip, shouldCloseDrag, sheetFrame, smoothScroll, takeFlip } from './sheetMotion'

const BubbleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5" />
    <path d="M6 11l6-6 6 6" />
  </svg>
)

/** The small round Ask mark: action fill, ink bubble. */
function Mark({ size }: { size: 'sm' | 'md' }) {
  return (
    <span className={size === 'md' ? 'ask-mark' : 'ask-mark ask-mark-sm'} aria-hidden="true">
      <BubbleIcon size={size === 'md' ? 18 : 11} />
    </span>
  )
}

/** Distance (px) from the bottom of the screen to the top of the bar or peek card. */
function useBottomOffset(selected: boolean, peekH: number): number {
  const [bar, setBar] = useState(80)
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.bottom-bar')
    if (!el) return
    const measure = () => setBar(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selected])
  return selected ? peekH : bar
}

/** The intro pop plays once per page load. */
let introDone = false

export function AskButton() {
  const t = useT()
  const selected = useAppStore((s) => s.selectedRoomId !== null)
  const full = useAppStore((s) => s.selectedRoomId !== null && s.snap === 'full')
  const searchOpen = useAppStore((s) => s.searchOpen)
  const peekH = useAppStore((s) => s.peekH)
  const mounted = useChatStore((s) => s.sheetMounted)
  const openFrom = useChatStore((s) => s.openFrom)
  const offset = useBottomOffset(selected, peekH)
  const ref = useRef<HTMLButtonElement>(null)
  const wasMounted = useRef(false)
  const hidden = full || searchOpen

  useLayoutEffect(() => {
    const el = ref.current
    if (wasMounted.current && !mounted && el) {
      // The sheet has shrunk back into the button: it pops back.
      el.getAnimations().forEach((a) => a.cancel())
      play(el, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: EASE_BACK })
      el.focus({ preventScroll: true })
    }
    wasMounted.current = mounted
  }, [mounted])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || introDone) return
    introDone = true
    // 600 ms after the button first shows: scale 0.6 to 1 and fade in.
    play(el, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 350, delay: 600, easing: EASE_BACK, fill: 'backwards' })
  }, [hidden])

  if (!assistantEnabled() || hidden) return null

  const press = () => {
    const el = ref.current
    const r = el?.getBoundingClientRect()
    const btn = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    if (!el || reduced()) return openFrom(btn)
    const a = play(el, [{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }], { duration: 150, easing: EASE_OUT, fill: 'forwards' })
    if (!a) return openFrom(btn)
    void a.finished.then(() => openFrom(btn), () => openFrom(btn))
  }

  return (
    <button
      ref={ref}
      type="button"
      className={mounted ? 'ask-btn is-away' : 'ask-btn'}
      style={{ bottom: offset + 16 }}
      aria-hidden={mounted || undefined}
      tabIndex={mounted ? -1 : undefined}
      onClick={press}
    >
      <BubbleIcon />
      <span>{t('askButton')}</span>
    </button>
  )
}

/** After the camera glide the chosen room's number tag pulses once. */
async function pulseTag() {
  if (reduced()) return
  const { transition } = await import('../scene/motion')
  // The scene starts its transition on the next frame; the glide then takes `duration` seconds.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise((r) => setTimeout(r, transition.duration * 1000 + 60))
  const tags = [...document.querySelectorAll<HTMLElement>('.room-tag')].filter((el) => Number(el.style.opacity || 1) > 0.5)
  const tag = tags[tags.length - 1]
  if (!tag) return
  tag.classList.add('tag-pulse')
  window.setTimeout(() => tag.classList.remove('tag-pulse'), 700)
}

/** Runs once the sheet has shrunk back into the Ask button. */
function applyAction(a: AssistantAction) {
  const s = useAppStore.getState()
  if (a.type === 'show_room') {
    const path = `/room/${encodeURIComponent(a.roomId)}`
    const here = parseHash(window.location.hash)
    if (here.name === 'room' && here.id === a.roomId) {
      s.selectRoom(a.roomId, { focus: true, cross: true }) // the hash already says so: no route change to wait for
    } else {
      useChatStore.setState({ peekArrival: true }) // RouteEffects keeps the peek card, once
      go(path)
    }
    void pulseTag()
  } else if (a.type === 'show_dept') {
    go(`/dept/${encodeURIComponent(a.deptId)}`)
  } else if (a.type === 'show_route') {
    s.requestRoute(a.fromId, a.toId)
    void pulseTag()
  }
}

function runAction(a: AssistantAction, pill: HTMLElement) {
  const finish = () => {
    useChatStore.setState({ afterClose: () => applyAction(a) })
    useChatStore.getState().setOpen(false)
  }
  const anim = reduced() ? null : play(pill, [{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }], { duration: 120, easing: EASE_OUT, fill: 'forwards' })
  if (anim) void anim.finished.then(finish, finish)
  else finish()
}

/** Messages that have already played their entrance (the list remounts when the sheet reopens). */
const entered = new Set<number>()

function Actions({ actions, delay }: { actions: AssistantAction[]; delay: number | null }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (delay === null || !box.current) return
    ;[...box.current.children].forEach((el, i) => {
      play(el, [{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 350, delay: delay + i * 80, easing: EASE_BACK, fill: 'backwards' })
    })
  }, [delay])
  if (actions.length === 0) return null
  return (
    <div className="ask-actions" ref={box}>
      {actions.map((a, i) =>
        a.type === 'source' ? (
          <a key={i} className="ask-source" href={a.url} target="_blank" rel="noreferrer">
            {t('askSource')} <ExternalIcon />
          </a>
        ) : (
          <button
            key={i}
            type="button"
            className={a.type === 'show_route' ? 'ask-action ask-action-quiet' : 'ask-action'}
            onClick={(e) => runAction(a, e.currentTarget)}
          >
            {t(a.type === 'show_room' ? 'askShowOnMap' : a.type === 'show_dept' ? 'askShowDept' : 'askShowRoute')}
            <ChevronIcon />
          </button>
        ),
      )}
    </div>
  )
}

/** Splits text into words (Thai has no spaces, so the browser's word segmenter is used) with punctuation kept on its word. */
function tokenise(text: string, lang: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = []
  const push = (s: string, wordLike: boolean) => {
    if (/^\s+$/.test(s)) return out.push({ text: s, word: false })
    const prev = out[out.length - 1]
    if (!wordLike && prev?.word) prev.text += s
    else out.push({ text: s, word: true })
  }
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    for (const seg of new Intl.Segmenter(lang, { granularity: 'word' }).segment(text)) push(seg.segment, seg.isWordLike ?? false)
  } else {
    for (const part of text.split(/(\s+)/)) if (part) push(part, true)
  }
  return out
}

/** The answer text: each wrapped line rises 6 px and fades, 50 ms apart, 500 ms at most in all. */
function RevealText({ text, lang, onTotal }: { text: string; lang: string; onTotal: (ms: number) => void }) {
  const tokens = useMemo(() => tokenise(text, lang), [text, lang])
  const box = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const words = [...(box.current?.querySelectorAll<HTMLElement>('.ask-w') ?? [])]
    if (words.length === 0) return onTotal(0)
    let line = 0
    let top = words[0]?.offsetTop ?? 0
    const lineOf = words.map((w) => {
      if (w.offsetTop > top + 3) {
        line++
        top = w.offsetTop
      }
      return line
    })
    const lines = line + 1
    const step = revealStep(lines)
    words.forEach((w, i) => {
      play(w, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], {
        duration: LINE_MS,
        delay: reduced() ? 0 : (lineOf[i] ?? 0) * step,
        easing: EASE_OUT,
        fill: 'backwards',
      })
    })
    onTotal(reduced() ? 150 : revealTotal(lines))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once for this text
  }, [])
  return (
    <p ref={box}>
      {tokens.map((tok, i) => (tok.word ? <span key={i} className="ask-w">{tok.text}</span> : tok.text))}
    </p>
  )
}

function Who() {
  const t = useT()
  return (
    <span className="ask-who">
      <Mark size="sm" />
      {t('askLabel')}
    </span>
  )
}

function UserBubble({ m }: { m: ChatItem }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || entered.has(m.id)) return
    entered.add(m.id)
    const from = takeFlip()
    if (from && !reduced()) {
      // The tapped chip becomes the bubble: it moves from the chip's place to its own.
      const to = el.getBoundingClientRect()
      play(el, [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, opacity: 0.6 }, { transform: 'translate(0, 0)', opacity: 1 }], { duration: 350, easing: EASE_OUT })
    } else {
      el.style.transformOrigin = '100% 100%'
      play(el, [{ opacity: 0, transform: 'translateY(16px) scale(0.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 300, easing: EASE_OUT })
    }
  }, [m.id])
  return (
    <div ref={ref} className="ask-msg ask-user">
      <p>{m.text}</p>
    </div>
  )
}

function BotMessage({ m }: { m: ChatItem }) {
  const lang = useAppStore((s) => s.lang)
  const [fresh] = useState(() => !entered.has(m.id))
  const [textMs, setTextMs] = useState<number | null>(fresh ? null : 0)
  useEffect(() => {
    entered.add(m.id)
  }, [m.id])
  return (
    <div className="ask-msg ask-bot">
      <Who />
      {fresh ? <RevealText text={m.text} lang={lang} onTotal={setTextMs} /> : <p>{m.text}</p>}
      <Actions actions={m.actions} delay={fresh ? textMs : null} />
    </div>
  )
}

function Thinking() {
  const t = useT()
  return (
    <div className="ask-msg ask-bot">
      <Who />
      <span className="ask-dots" role="status" aria-label={t('askThinking')}>
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

function Failed() {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (ref.current) play(ref.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
  }, [])
  return (
    <div ref={ref} className="ask-msg ask-bot ask-error" role="alert">
      <Who />
      <p>{t('askResting')}</p>
      <div className="ask-actions">
        <button
          type="button"
          className="ask-action"
          onClick={() => {
            useChatStore.setState({ afterClose: () => useAppStore.getState().openSearch() })
            useChatStore.getState().setOpen(false)
          }}
        >
          {t('askOpenSearch')}
          <ChevronIcon />
        </button>
      </div>
    </div>
  )
}

/** Pins the sheet to the visual viewport (see `sheetFrame`); the newest message stays in view when it shrinks. */
function fitSheet(sh: HTMLElement, list: HTMLElement | null) {
  const vv = window.visualViewport
  if (!vv) return
  const f = sheetFrame(window.innerHeight, vv.height, vv.offsetTop)
  const top = `${f.top}px`
  const height = `${f.height}px`
  if (sh.style.top === top && sh.style.height === height) return
  const stick = list ? list.scrollHeight - list.scrollTop - list.clientHeight < 80 : false
  sh.style.top = top
  sh.style.height = height
  sh.style.bottom = 'auto'
  if (stick && list) list.scrollTop = list.scrollHeight
}

export function AssistantSheet() {
  const t = useT()
  const open = useChatStore((s) => s.open)
  const mounted = useChatStore((s) => s.sheetMounted)
  const items = useChatStore((s) => s.items)
  const busy = useChatStore((s) => s.busy)
  const failed = useChatStore((s) => s.failed)
  const setOpen = useChatStore((s) => s.setOpen)
  const finishClose = useChatStore((s) => s.finishClose)
  const send = useChatStore((s) => s.send)
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const sendIcon = useRef<HTMLSpanElement>(null)
  const closing = useRef(false)
  const dragY = useRef(0)
  const drag = useRef<{ y0: number; t0: number; lastY: number; lastT: number; y: number; t: number } | null>(null)

  /** Moves the sheet's transform-origin to the Ask button's centre. */
  const aimAtButton = (sh: HTMLElement, live: boolean) => {
    const btn = live ? document.querySelector('.ask-btn')?.getBoundingClientRect() : undefined
    const stored = useChatStore.getState().btnRect
    const x = btn ? btn.left + btn.width / 2 : (stored?.x ?? window.innerWidth - 44)
    const y = btn ? btn.top + btn.height / 2 : (stored?.y ?? window.innerHeight - 100)
    const box = getComputedStyle(sh)
    sh.style.transformOrigin = `${x - parseFloat(box.left)}px ${y - parseFloat(box.top)}px`
  }

  // Grow out of the Ask button.
  useLayoutEffect(() => {
    const sh = sheet.current
    if (!mounted || !sh) return
    closing.current = false
    fitSheet(sh, list.current)
    aimAtButton(sh, false)
    // The scale takes 420 ms but the sheet is solid after 120 ms: it never reads as see-through.
    play(sh, [{ transform: 'scale(0.4)' }, { transform: 'scale(1)' }], { duration: 420, easing: EASE_OUT })
    play(sh, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' })
    if (scrim.current) play(scrim.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' })
    // A phone would pop the keyboard over the starter chips: focus the sheet itself there.
    const touch = window.matchMedia?.('(pointer: coarse)').matches
    ;(touch ? sh : input.current)?.focus({ preventScroll: true })
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [mounted])

  // Shrink back into it, then let go of the screen.
  useEffect(() => {
    const sh = sheet.current
    if (!mounted || open || closing.current || !sh) return
    closing.current = true
    const y = dragY.current
    dragY.current = 0
    sh.style.transform = ''
    aimAtButton(sh, true)
    const a = play(sh, [{ transform: `translateY(${y}px) scale(1)` }, { transform: 'translateY(0) scale(0.4)' }], { duration: 260, easing: EASE_IN, fill: 'forwards' })
    // Solid until the last 100 ms of the shrink.
    play(sh, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, delay: 160, easing: 'linear', fill: 'both' })
    if (scrim.current) play(scrim.current, [{ opacity: Number(scrim.current.style.opacity || 1) }, { opacity: 0 }], { duration: 260, easing: 'linear', fill: 'forwards' })
    const done = () => {
      closing.current = false
      finishClose()
    }
    if (a) void a.finished.then(done, done)
    else done()
  }, [open, mounted, finishClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  // The sheet follows the visual viewport frame by frame, so the composer stays above the keyboard
  // however Chrome pans the page; the page itself never scrolls while the sheet is open.
  useEffect(() => {
    const sh = sheet.current
    if (!mounted || !sh) return
    document.documentElement.classList.add('ask-open')
    let raf = 0
    const tick = () => {
      fitSheet(sh, list.current)
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      document.documentElement.classList.remove('ask-open')
    }
  }, [mounted])

  // Keep the newest message in view.
  useEffect(() => {
    const el = list.current
    if (el) smoothScroll(el, el.scrollHeight - el.clientHeight)
  }, [items.length, busy, failed])

  // Empty state: greeting, hint and chips rise, 60 ms apart, starting 120 ms after the sheet opens.
  useLayoutEffect(() => {
    if (!mounted || items.length > 0 || !list.current) return
    list.current.querySelectorAll('[data-rise]').forEach((el, i) => {
      play(el, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 400, delay: 120 + i * 60, easing: EASE_OUT, fill: 'backwards' })
    })
  }, [mounted, items.length])

  // A tapped chip dips; the others fade out.
  useLayoutEffect(() => {
    if (chosen === null || !list.current) return
    list.current.querySelectorAll<HTMLElement>('.ask-chip').forEach((el, i) => {
      if (i === chosen) play(el, [{ transform: 'scale(1)' }, { transform: 'scale(0.97)' }], { duration: 150, easing: EASE_OUT, fill: 'forwards' })
      else play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'linear', fill: 'forwards' })
    })
  }, [chosen])

  if (!mounted) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    if (sendIcon.current) play(sendIcon.current, [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 200, easing: EASE_OUT })
    void send(text)
    setText('')
  }

  const starters = [t('askStarter1'), t('askStarter2'), t('askStarter3')]
  const pick = (i: number, el: HTMLElement) => {
    if (chosen !== null) return
    setFlip(el.getBoundingClientRect())
    setChosen(i)
    const go = () => {
      void send(starters[i] ?? '')
      setChosen(null)
    }
    if (reduced()) go()
    else window.setTimeout(go, 150)
  }

  const onDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { y0: e.clientY, t0: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, y: e.clientY, t: e.timeStamp }
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const sh = sheet.current
    if (!d || !sh) return
    if (e.timeStamp - d.t > 50) {
      d.lastY = d.y
      d.lastT = d.t
    }
    d.y = e.clientY
    d.t = e.timeStamp
    const dy = Math.max(0, e.clientY - d.y0)
    sh.style.transform = `translateY(${dy}px)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - dy / 400))
  }
  const onUp = (e: ReactPointerEvent) => {
    const d = drag.current
    const sh = sheet.current
    drag.current = null
    if (!d || !sh) return
    const dy = Math.max(0, e.clientY - d.y0)
    const close = e.type !== 'pointercancel' && (shouldCloseDrag(dy, e.timeStamp - d.t0) || shouldCloseDrag(e.clientY - d.lastY, e.timeStamp - d.lastT))
    if (close) {
      dragY.current = dy
      setOpen(false)
    } else {
      sh.style.transform = ''
      play(sh, [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 200, easing: EASE_OUT })
      if (scrim.current) {
        scrim.current.style.opacity = ''
        play(scrim.current, [{ opacity: Math.max(0, 1 - dy / 400) }, { opacity: 1 }], { duration: 200, easing: EASE_OUT })
      }
    }
  }

  return (
    <>
      <div ref={scrim} className="ask-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
      <div ref={sheet} className="ask-sheet" role="dialog" aria-labelledby="ask-title" tabIndex={-1}>
        <div className="ask-grab" aria-hidden="true" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span />
        </div>
        <div className="ask-head">
          <Mark size="md" />
          <div className="ask-head-text">
            <h2 className="ask-title" id="ask-title">{t('askTitle')}</h2>
            <p className="ask-note">{t('askDisclaimer')}</p>
          </div>
          <button type="button" className="ask-close" aria-label={t('close')} onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        </div>

        <div className="ask-list" ref={list} role="log" aria-live="polite" aria-label={t('askMessages')}>
          {items.length === 0 && (
            <div className="ask-empty">
              <p className="ask-greeting" data-rise>{t('askGreeting')}</p>
              <p className="ask-hint" data-rise>{t('askHint')}</p>
              {starters.map((s, i) => (
                <button key={s} type="button" className="ask-chip" data-rise onClick={(e) => pick(i, e.currentTarget)}>
                  {s}
                  <ChevronIcon />
                </button>
              ))}
            </div>
          )}
          {items.map((m) => (m.role === 'user' ? <UserBubble key={m.id} m={m} /> : <BotMessage key={m.id} m={m} />))}
          {busy && <Thinking />}
          {failed && <Failed />}
        </div>

        <form className="ask-form" onSubmit={submit}>
          <div className="ask-composer">
            <input
              ref={input}
              className="ask-input"
              value={text}
              maxLength={MAX_CHARS}
              placeholder={t('askPlaceholder')}
              aria-label={t('askInputLabel')}
              enterKeyHint="send"
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="ask-send" aria-label={t('askSend')} disabled={busy || !text.trim()}>
              <span ref={sendIcon} className="ask-send-icon">
                <ArrowUpIcon />
              </span>
            </button>
          </div>
          <p className="ask-privacy">{t('askPrivacy')}</p>
        </form>
      </div>
    </>
  )
}
