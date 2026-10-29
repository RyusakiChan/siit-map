/** Curves and timings for the Ask assistant (see "Ask motion" in the UI spec). */
export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const EASE_BACK = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
export const EASE_IN = 'cubic-bezier(0.7, 0, 0.84, 0)'

/** Dragging the handle down closes the sheet past this distance (px)... */
export const DRAG_CLOSE_PX = 120
/** ...or when the finger leaves faster than this (px per ms). */
export const FLICK_PX_PER_MS = 0.6

export function shouldCloseDrag(dy: number, ms: number): boolean {
  if (dy <= 0) return false
  if (dy > DRAG_CLOSE_PX) return true
  return ms > 0 && dy / ms > FLICK_PX_PER_MS && dy > 24
}

/** A line rises 6 px and fades over this long. */
export const LINE_MS = 300
/** The whole answer reveal takes at most this long. */
export const REVEAL_MAX_MS = 500
export const LINE_STEP_MS = 50

/** Gap between lines: 50 ms, squeezed so the last line still finishes inside the cap. */
export function revealStep(lines: number): number {
  if (lines <= 1) return 0
  return Math.min(LINE_STEP_MS, (REVEAL_MAX_MS - LINE_MS) / (lines - 1))
}

/** Total reveal time for `lines` lines. */
export function revealTotal(lines: number): number {
  if (lines <= 0) return 0
  return LINE_MS + revealStep(lines) * (lines - 1)
}

export const reduced = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Plays a Web Animation. With reduced motion every move becomes a 150 ms fade (the global CSS rule
 * stops CSS animations, but not these), so the fade survives.
 */
export function play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (typeof el.animate !== 'function') return null
  if (reduced()) {
    const first = frames[0]?.opacity ?? 1
    const last = frames[frames.length - 1]?.opacity ?? 1
    return el.animate([{ opacity: first }, { opacity: last }], { duration: 150, easing: 'linear', fill: opts.fill })
  }
  return el.animate(frames, opts)
}

/** Scrolls an element to `top` with an expo-out ease (instant with reduced motion). */
export function smoothScroll(el: HTMLElement, top: number, ms = 400): void {
  const from = el.scrollTop
  if (reduced() || Math.abs(top - from) < 2) {
    el.scrollTop = top
    return
  }
  const t0 = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    const k = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
    el.scrollTop = from + (top - from) * k
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

let flipFrom: DOMRect | null = null
/** Remembers the tapped starter chip's box; the first user bubble moves out of it. */
export function setFlip(rect: DOMRect | null): void {
  flipFrom = rect
}
export function takeFlip(): DOMRect | null {
  const r = flipFrom
  flipFrom = null
  return r
}

/** Gap above the sheet normally, and while the on-screen keyboard is up (the sheet uses the space). */
export const SHEET_INSET = 56
export const SHEET_INSET_KB = 8
export const SHEET_BOTTOM = 8
/** The visual viewport is at least this much shorter than the layout viewport: the keyboard is open. */
export const KEYBOARD_MIN = 120

/**
 * The sheet is pinned to the visual viewport: Chrome pans it to show a focused input, so the top
 * follows `offsetTop` and the height follows the viewport's height (no separate keyboard lift).
 */
export function sheetFrame(layoutHeight: number, vvHeight: number, vvOffsetTop: number): { top: number; height: number; keyboard: boolean } {
  const keyboard = layoutHeight - vvHeight > KEYBOARD_MIN
  const inset = keyboard ? SHEET_INSET_KB : SHEET_INSET
  return { top: vvOffsetTop + inset, height: Math.max(160, vvHeight - inset - SHEET_BOTTOM), keyboard }
}
