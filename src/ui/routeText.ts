import { roomById, roomName } from '../data/lookup'
import type { T } from '../i18n'
import type { Lang } from '../i18n/strings'
import type { Side, Step } from '../nav'

/** 1st, 2nd, 3rd, 4th … (English only; Thai text says "door number n"). */
export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

const placeName = (id: string, lang: Lang): string => {
  const room = roomById.get(id)
  return room ? roomName(room, lang) : id
}

const sideWord = (side: Side, t: T): string => (side === 'left' ? t('sideLeft') : t('sideRight'))

/** One short line for a step, in the app language. */
export function stepText(step: Step, t: T, lang: Lang): string {
  switch (step.type) {
    case 'leave': {
      const room = placeName(step.roomId, lang)
      return step.side === 'ahead' ? t('stepLeaveAhead', { room }) : t('stepLeaveTurn', { room, side: sideWord(step.side, t) })
    }
    case 'walk': {
      const m = Math.max(5, Math.round(step.meters / 5) * 5)
      return step.pastId ? t('stepWalkPast', { m, place: placeName(step.pastId, lang) }) : t('stepWalk', { m })
    }
    case 'turn':
      return step.nearId
        ? t('stepTurnNear', { side: sideWord(step.side, t), place: placeName(step.nearId, lang) })
        : t('stepTurn', { side: sideWord(step.side, t) })
    case 'arrive': {
      const room = placeName(step.roomId, lang)
      return step.side === 'ahead' ? t('stepArriveAhead', { room }) : t('stepArrive', { room, nth: ordinal(step.nth), n: step.nth, side: sideWord(step.side, t) })
    }
    case 'ride':
      if (step.kind === 'elevator') return t('stepLift', { n: step.toFloor })
      return t(step.toFloor > step.fromFloor ? 'stepStairsUp' : 'stepStairsDown', { n: step.toFloor })
  }
}

/** A small glyph for the step's icon. */
export function stepGlyph(step: Step): string {
  switch (step.type) {
    case 'leave':
      return step.side === 'left' ? '↰' : step.side === 'right' ? '↱' : '↑'
    case 'walk':
      return '↑'
    case 'turn':
      return step.side === 'left' ? '↰' : '↱'
    case 'arrive':
      return '⚑'
    case 'ride':
      return step.toFloor > step.fromFloor ? '⇧' : '⇩'
  }
}
