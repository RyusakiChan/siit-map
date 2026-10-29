import { MathUtils } from 'three'

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

export const reducedMotion = (): boolean => query?.matches ?? false

/** Frame-rate independent ease-out toward `target`; jumps when motion is reduced. */
export function ease(current: number, target: number, lambda: number, dt: number): number {
  if (reducedMotion()) return target
  const next = MathUtils.damp(current, target, lambda, dt)
  return Math.abs(next - target) < 0.002 ? target : next
}
