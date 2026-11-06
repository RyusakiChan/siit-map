import { useAppStore } from '../state/store'

/** Readings with a worse accuracy than this (iOS `webkitCompassAccuracy`, degrees) are ignored. */
export const MAX_ACCURACY_DEG = 45
/** No usable reading for this long: the compass is "not available" (at start) or drops out (later). */
export const TIMEOUT_MS = 1500
/** The cone is redrawn at most this often (about 15 times a second). */
export const REDRAW_MS = 66
/** Time constant of the low-pass filter. */
export const SMOOTH_TAU_MS = 150

export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360

/** Shortest signed turn from a to b, in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  const d = normalizeDeg(b - a)
  return d > 180 ? d - 360 : d
}

/** Moves `prev` toward `next` along the shorter way round the circle by fraction k (0..1). 359 to 1 goes through 0. */
export function smoothAngle(prev: number, next: number, k: number): number {
  return normalizeDeg(prev + angleDelta(prev, next) * Math.min(1, Math.max(0, k)))
}

/** Low-pass fraction for a step of `dtMs` with time constant `tauMs`. */
export const smoothFactor = (dtMs: number, tauMs = SMOOTH_TAU_MS): number => 1 - Math.exp(-Math.max(0, dtMs) / tauMs)

/** Android: `alpha` counts counter-clockwise from north; `screenAngle` is how far the screen is turned from portrait. */
export function headingFromAlpha(alpha: number, screenAngle = 0): number {
  return normalizeDeg(360 - alpha + screenAngle)
}

/** iOS: `webkitCompassHeading` is already clockwise from north for the top of a portrait phone. */
export function headingFromWebkit(webkitHeading: number, screenAngle = 0): number {
  return normalizeDeg(webkitHeading + screenAngle)
}

export interface OrientationLike {
  alpha: number | null
  absolute: boolean
  webkitCompassHeading?: number | null
  webkitCompassAccuracy?: number | null
}

/** Heading in degrees clockwise from true north, or null when the event is not a trustworthy absolute reading. */
export function readHeading(e: OrientationLike, screenAngle = 0): number | null {
  const w = e.webkitCompassHeading
  if (typeof w === 'number' && Number.isFinite(w)) {
    const acc = e.webkitCompassAccuracy
    if (typeof acc === 'number' && (acc < 0 || acc > MAX_ACCURACY_DEG)) return null
    return headingFromWebkit(w, screenAngle)
  }
  if (!e.absolute || typeof e.alpha !== 'number' || !Number.isFinite(e.alpha)) return null
  return headingFromAlpha(e.alpha, screenAngle)
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }
const orientationApi = (): PermissionApi | null =>
  typeof window !== 'undefined' && 'DeviceOrientationEvent' in window ? (window.DeviceOrientationEvent as unknown as PermissionApi) : null

/** True on devices that have the orientation API (the button only shows there). */
export const compassSupported = (): boolean => orientationApi() !== null

const screenAngle = (): number => {
  const a = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined
  if (typeof a === 'number') return a
  const legacy = (window as unknown as { orientation?: number }).orientation
  return typeof legacy === 'number' ? normalizeDeg(legacy) : 0
}

let stopCurrent: (() => void) | null = null

/** Stops listening and clears the heading. */
export function stopCompass(state: 'off' | 'unavailable' = 'off'): void {
  stopCurrent?.()
  stopCurrent = null
  useAppStore.getState().setCompass(state, null)
}

/**
 * Starts the compass. Call it straight from a tap: on iOS `requestPermission()` only works inside the gesture.
 * Readings never leave the phone; they go into the store and nowhere else.
 */
export async function startCompass(): Promise<void> {
  const api = orientationApi()
  if (!api || stopCurrent) return
  const set = useAppStore.getState().setCompass
  set('starting', null)
  if (typeof api.requestPermission === 'function') {
    let result: string
    try {
      result = await api.requestPermission()
    } catch {
      result = 'denied'
    }
    if (result !== 'granted') {
      set('unavailable', null)
      return
    }
  }

  let smooth: number | null = null
  let lastEvent = 0
  let lastPush = 0
  let ever = false
  let pending: ReturnType<typeof setTimeout> | null = null
  const push = () => {
    pending = null
    lastPush = performance.now()
    if (smooth !== null) useAppStore.getState().setCompass('on', Math.round(smooth))
  }
  const onEvent = (ev: Event) => {
    const h = readHeading(ev as unknown as OrientationLike, screenAngle())
    if (h === null) return
    const now = performance.now()
    smooth = smooth === null || now - lastEvent > TIMEOUT_MS ? h : smoothAngle(smooth, h, smoothFactor(now - lastEvent))
    lastEvent = now
    if (!ever) {
      ever = true
      push()
    } else if (now - lastPush >= REDRAW_MS) push()
    else if (pending === null) pending = setTimeout(push, REDRAW_MS - (now - lastPush))
  }
  // Chrome sends both events (only the absolute one counts); iOS sends `deviceorientation` with the webkit heading.
  window.addEventListener('deviceorientationabsolute', onEvent)
  window.addEventListener('deviceorientation', onEvent)
  const watchdog = setInterval(() => {
    if (!ever) return // the start timeout below decides "not available"
    if (performance.now() - lastEvent > TIMEOUT_MS && useAppStore.getState().compassHeading !== null) {
      smooth = null
      useAppStore.getState().setCompass('on', null) // dropped out: the cone falls back to the poster direction
    }
  }, 500)
  const first = setTimeout(() => {
    if (!ever) stopCompass('unavailable')
  }, TIMEOUT_MS)
  // The compass belongs to a "You are here" spot: no spot, no compass.
  const unsub = useAppStore.subscribe((s) => {
    if (s.here === null) stopCompass()
  })
  stopCurrent = () => {
    window.removeEventListener('deviceorientationabsolute', onEvent)
    window.removeEventListener('deviceorientation', onEvent)
    clearInterval(watchdog)
    clearTimeout(first)
    if (pending !== null) clearTimeout(pending)
    unsub()
  }
}

export function toggleCompass(): void {
  const s = useAppStore.getState().compass
  if (s === 'on') stopCompass()
  else if (s !== 'starting') void startCompass()
}
