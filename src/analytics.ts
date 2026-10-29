import { config } from './config'

interface GoatCounter {
  count: (vars: { path: string }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter & { no_onload?: boolean }
  }
}

const isLocal = () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) || window.location.hostname.endsWith('.localhost')

/** GoatCounter is only active with a site code, outside dev and localhost. */
const enabled = () => Boolean(config.goatcounterCode) && !import.meta.env.DEV && !isLocal()

let loaded = false
const queue: string[] = []

function load() {
  if (loaded || !enabled()) return
  loaded = true
  // Count by hand (first view and every hash change): no automatic page view, no cookies.
  window.goatcounter = { no_onload: true } as unknown as Window['goatcounter']
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://gc.zgo.at/count.js'
  script.dataset.goatcounter = `https://${config.goatcounterCode}.goatcounter.com/count`
  script.onload = () => queue.splice(0).forEach((path) => window.goatcounter?.count({ path }))
  document.head.appendChild(script)
}

/** Counts a view as a path such as `/room/<id>` or `/at/<id>`. */
export function countView(path: string): void {
  if (!enabled()) return
  load()
  const gc = window.goatcounter
  if (gc && typeof gc.count === 'function') gc.count({ path })
  else queue.push(path)
}
