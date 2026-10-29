import { MathUtils } from 'three'

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

export const reducedMotion = (): boolean => query?.matches ?? false

// The canvas renders on demand; unfinished eases ask for the next frame through this.
let requestFrame: () => void = () => {}
export function setFrameRequester(fn: () => void): void {
  requestFrame = fn
}

/** Frame-rate independent ease-out toward `target`; jumps when motion is reduced. */
export function ease(current: number, target: number, lambda: number, dt: number): number {
  if (reducedMotion()) return target
  const next = MathUtils.damp(current, target, lambda, Math.min(dt, 0.05))
  if (Math.abs(next - target) < 0.002) return target
  requestFrame()
  return next
}

/** Ease-out-expo on 0..1, normalised so it ends exactly at 1. */
export function easeOutExpo(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10))
}

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

/**
 * One shared progress value per transition (floor switch, selection change, camera glide).
 * Everything that moves reads `p` and maps it through the same curve; a new transition
 * bumps `epoch`, and each animated thing captures where it is at that moment as its start.
 */
export const transition = {
  p: 1,
  epoch: 0,
  duration: 0.45,
  viewChanged: false,
  selChanged: false,
  hold: false, // dev only: freeze at a chosen p so tests can capture exact frames
}

export function startTransition(duration: number, viewChanged: boolean, selChanged: boolean): void {
  transition.epoch++
  transition.duration = duration
  transition.viewChanged = viewChanged
  transition.selChanged = selChanged
  transition.p = reducedMotion() ? 1 : 0
  requestFrame()
}

export function stepTransition(dt: number): void {
  if (transition.hold || transition.p >= 1) return
  transition.p = reducedMotion() ? 1 : Math.min(1, transition.p + Math.min(dt, 0.05) / transition.duration)
  if (transition.p < 1) requestFrame()
}

/** Live floor and room state, written by the floor layers each frame for the things that follow them. */
export const floorState = new Map<number, { offset: number; g: number }>()
export const roomState = new Map<string, { top: number; g: number }>()

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __motion?: unknown }).__motion = { transition, poke: () => requestFrame() }
}
