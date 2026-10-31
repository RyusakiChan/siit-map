import { roomById, roomName } from '../data/lookup'
import type { T } from '../i18n'
import type { Lang } from '../i18n/strings'
import type { Step } from '../nav'

const placeName = (id: string, lang: Lang): string => {
  const room = roomById.get(id)
  return room ? roomName(room, lang) : id
}

/** One short line for a step, in the app language. */
export function stepText(step: Step, t: T, lang: Lang): string {
  switch (step.type) {
    case 'goFloor':
      return t(step.liftOnly ? 'stepGoFloorLift' : 'stepGoFloor', { n: step.toFloor })
    case 'find':
      return t('stepFind', { n: step.floor, room: placeName(step.roomId, lang) })
    case 'follow':
      return t('stepFollow', { room: placeName(step.roomId, lang), m: Math.max(5, Math.round(step.meters / 5) * 5) })
  }
}

/** A small glyph for the step's icon. */
export function stepGlyph(step: Step): string {
  switch (step.type) {
    case 'goFloor':
      return step.toFloor > step.floor ? '⇧' : '⇩'
    case 'find':
      return '⚑'
    case 'follow':
      return '↑'
  }
}
