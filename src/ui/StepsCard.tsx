import { useLayoutEffect, useRef } from 'react'
import { roomById, roomName } from '../data/lookup'
import { useT } from '../i18n'
import { routeUrl } from '../router'
import { fromToken, useAppStore } from '../state/store'
import { CloseIcon, ShareIcon } from './Icons'
import { stepGlyph, stepText } from './routeText'

/** Replaces the peek card while a route is on show: the current step, Back and Next. */
export function StepsCard() {
  const t = useT()
  const lang = useAppStore((s) => s.lang)
  const route = useAppStore((s) => s.route)
  const avoidStairs = useAppStore((s) => s.avoidStairs)
  const setRouteStep = useAppStore((s) => s.setRouteStep)
  const endRoute = useAppStore((s) => s.endRoute)
  const setAvoidStairs = useAppStore((s) => s.setAvoidStairs)
  const openFromPicker = useAppStore((s) => s.openFromPicker)
  const showNotice = useAppStore((s) => s.showNotice)
  const setPeekH = useAppStore((s) => s.setPeekH)
  const card = useRef<HTMLDivElement>(null)

  // The map frames itself above the card, so the card reports its height.
  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const measure = () => setPeekH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setPeekH, route?.toId])

  if (!route) return null
  const { plan, step: index } = route
  const step = plan.steps[index]!
  const last = index === plan.steps.length - 1
  const firstFloor = plan.legs[0]!.floor
  const lastFloor = plan.legs[plan.legs.length - 1]!.floor
  const header =
    firstFloor === lastFloor
      ? t('routeHeaderOne', { a: firstFloor, m: plan.minutes })
      : t('routeHeaderMany', { a: firstFloor, b: lastFloor, m: plan.minutes })
  const fromRoom = route.from.kind === 'room' ? roomById.get(route.from.id) : undefined
  const place = fromRoom ? roomName(fromRoom, lang) : t('routeFromHere')

  const share = async () => {
    const url = routeUrl(fromToken(route.from), route.toId)
    try {
      if (navigator.share) {
        await navigator.share({ title: header, url })
        return
      }
      await navigator.clipboard.writeText(url)
      showNotice('linkCopied')
    } catch {
      /* the user cancelled the share sheet, or the clipboard is blocked */
    }
  }

  return (
    <div ref={card} className="route-card" role="dialog" aria-label={t('directions')}>
      <div className="route-head">
        <div className="route-title">
          <h2 className="route-header" data-testid="route-header">{header}</h2>
          <span className="route-from">
            {t('routeFrom', { place })} ·{' '}
            <button type="button" className="route-change" onClick={() => openFromPicker(route.toId)}>
              {t('routeChange')}
            </button>
          </span>
        </div>
        <button type="button" className="square-btn small" aria-label={t('routeShare')} onClick={share}>
          <ShareIcon />
        </button>
        <button type="button" className="square-btn small" aria-label={t('routeExit')} onClick={endRoute}>
          <CloseIcon />
        </button>
      </div>

      <div className="route-step" aria-live="polite">
        <span className="route-glyph" aria-hidden="true">{stepGlyph(step)}</span>
        <div className="route-step-text">
          <p className="route-line" data-testid="route-step">{stepText(step, t, lang)}</p>
          <span className="route-count">
            {t('routeStepOf', { i: index + 1, n: plan.steps.length })} · {t('floor', { n: step.floor })}
          </span>
        </div>
      </div>

      <button type="button" role="switch" aria-checked={avoidStairs} className="route-switch" onClick={() => setAvoidStairs(!avoidStairs)}>
        <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
        {t('routeAvoidStairs')}
      </button>

      <div className="route-nav">
        <button type="button" className="route-btn quiet" disabled={index === 0} onClick={() => setRouteStep(index - 1)}>
          {t('routeBack')}
        </button>
        <button type="button" className="route-btn" onClick={() => (last ? endRoute() : setRouteStep(index + 1))}>
          {last ? t('routeDone') : t('routeNext')}
        </button>
      </div>
    </div>
  )
}
