import { roomById, roomName } from '../data/lookup'
import type { T } from '../i18n'
import type { Lang } from '../i18n/strings'
import type { Step } from '../nav'
import { liveTurn } from '../nav/orient'

const placeName = (id: string, lang: Lang): string => {
  const room = roomById.get(id)
  return room ? roomName(room, lang) : id
}

/** One short line for a step, in the app language. */
export function stepText(step: Step, t: T, lang: Lang, heading: number | null = null): string {
  switch (step.type) {
    case 'goFloor':
      return t(step.liftOnly ? 'stepGoFloorLift' : 'stepGoFloor', { n: step.toFloor })
    case 'find':
      return t('stepFind', { n: step.floor, room: placeName(step.roomId, lang) })
    case 'orient': {
      const place = step.place.kind === 'lifts' ? t('placeLifts') : step.place.kind === 'stairs' ? t('placeStairs') : placeName(step.place.roomId ?? '', lang)
      const turn = liveTurn(step, heading) ?? step.turn
      if (turn === 'beside') return t('stepOrientBeside', { place })
      // With a live heading the person is no longer assumed to face the poster.
      const live = heading !== null
      if (turn === 'around') return t(live ? 'stepLiveAround' : 'stepOrientAround', { place })
      if (turn === 'ahead') return t(live ? 'stepLiveAhead' : 'stepOrientAhead', { place })
      return t(live ? 'stepLiveTurn' : 'stepOrientTurn', { side: t(turn === 'left' ? 'sideLeft' : 'sideRight'), place })
    }
    case 'follow':
      return t('stepFollow', { room: placeName(step.roomId, lang), m: Math.max(5, Math.round(step.meters / 5) * 5) })
  }
}

/** A small glyph for the step's icon. */
export function stepGlyph(step: Step, heading: number | null = null): string {
  switch (step.type) {
    case 'goFloor':
      return step.toFloor > step.floor ? '⇧' : '⇩'
    case 'find':
      return '⚑'
    case 'follow':
      return '↑'
    case 'orient': {
      const turn = liveTurn(step, heading)
      return turn === 'left' ? '↰' : turn === 'right' ? '↱' : turn === 'around' ? '↶' : '↑'
    }
  }
}
