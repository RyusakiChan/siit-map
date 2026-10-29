import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { go } from '../router'
import { useAppStore } from '../state/store'
import { ChevronIcon, CloseIcon, ExternalIcon } from '../ui/Icons'
import { assistantEnabled, MAX_CHARS, type AssistantAction } from './api'
import { useChatStore } from './chatStore'

const BubbleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
)

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

export function AskButton() {
  const t = useT()
  const selected = useAppStore((s) => s.selectedRoomId !== null)
  const full = useAppStore((s) => s.selectedRoomId !== null && s.snap === 'full')
  const searchOpen = useAppStore((s) => s.searchOpen)
  const peekH = useAppStore((s) => s.peekH)
  const open = useChatStore((s) => s.open)
  const setOpen = useChatStore((s) => s.setOpen)
  const offset = useBottomOffset(selected, peekH)
  if (!assistantEnabled() || full || searchOpen || open) return null
  return (
    <button type="button" className="ask-btn" style={{ bottom: offset + 16 }} onClick={() => setOpen(true)}>
      <BubbleIcon />
      <span>{t('askButton')}</span>
    </button>
  )
}

function runAction(a: AssistantAction) {
  const s = useAppStore.getState()
  if (a.type === 'show_room') s.selectRoom(a.roomId, { focus: true, cross: true })
  else if (a.type === 'show_dept') go(`/dept/${a.deptId}`)
  else if (a.type === 'show_route') s.requestRoute(a.fromId, a.toId)
  useChatStore.getState().setOpen(false)
}

function Actions({ actions }: { actions: AssistantAction[] }) {
  const t = useT()
  if (actions.length === 0) return null
  return (
    <div className="ask-actions">
      {actions.map((a, i) =>
        a.type === 'source' ? (
          <a key={i} className="ask-source" href={a.url} target="_blank" rel="noreferrer">
            {t('askSource')} <ExternalIcon />
          </a>
        ) : (
          <button key={i} type="button" className="ask-action" onClick={() => runAction(a)}>
            {t(a.type === 'show_room' ? 'askShowOnMap' : a.type === 'show_dept' ? 'askShowDept' : 'askShowRoute')}
            <ChevronIcon />
          </button>
        ),
      )}
    </div>
  )
}

export function AssistantSheet() {
  const t = useT()
  const open = useChatStore((s) => s.open)
  const items = useChatStore((s) => s.items)
  const busy = useChatStore((s) => s.busy)
  const failed = useChatStore((s) => s.failed)
  const setOpen = useChatStore((s) => s.setOpen)
  const send = useChatStore((s) => s.send)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  useEffect(() => {
    list.current?.scrollTo?.({ top: list.current.scrollHeight })
  }, [items.length, busy, failed])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    void send(text)
    setText('')
  }
  const starters = [t('askStarter1'), t('askStarter2'), t('askStarter3')]

  return (
    <div className="ask-sheet" role="dialog" aria-label={t('askTitle')}>
      <div className="ask-head">
        <div className="ask-head-text">
          <h2 className="screen-title">{t('askTitle')}</h2>
          <p className="ask-note">{t('askDisclaimer')}</p>
        </div>
        <button type="button" className="square-btn bordered" aria-label={t('close')} onClick={() => setOpen(false)}>
          <CloseIcon />
        </button>
      </div>

      <div className="ask-list" ref={list} role="log" aria-live="polite" aria-label={t('askMessages')}>
        {items.length === 0 && (
          <div className="ask-starters">
            {starters.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'ask-msg ask-user' : 'ask-msg ask-bot'}>
            <p>{m.text}</p>
            {m.role === 'assistant' && <Actions actions={m.actions} />}
          </div>
        ))}
        {busy && <p className="ask-msg ask-bot ask-wait">{t('askThinking')}</p>}
        {failed && (
          <div className="ask-msg ask-bot ask-error" role="alert">
            <p>{t('askResting')}</p>
            <div className="ask-actions">
              <button
                type="button"
                className="ask-action"
                onClick={() => {
                  setOpen(false)
                  useAppStore.getState().openSearch()
                }}
              >
                {t('askOpenSearch')}
                <ChevronIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      <form className="ask-form" onSubmit={submit}>
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
        <button type="submit" className="ask-send" disabled={busy || !text.trim()}>
          {t('askSend')}
        </button>
      </form>
      <p className="ask-privacy">{t('askPrivacy')}</p>
    </div>
  )
}
