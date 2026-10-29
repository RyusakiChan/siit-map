import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'map' }
  | { name: 'room'; id: string }
  | { name: 'dept'; id: string }
  | { name: 'at'; id: string }
  | { name: 'about' }

/** Hash routes (GitHub Pages): #/  #/room/<id>  #/dept/<id>  #/at/<id>  #/about */
export function parseHash(hash: string): Route {
  const [kind, ...rest] = hash.replace(/^#\/?/, '').split('/')
  const id = decodeURIComponent(rest.join('/'))
  if (kind === 'room' && id) return { name: 'room', id }
  if (kind === 'dept' && id) return { name: 'dept', id }
  if (kind === 'at' && id) return { name: 'at', id }
  if (kind === 'about') return { name: 'about' }
  return { name: 'map' }
}

/** The path counted by analytics, for example `/room/sample-lab-2-03`. */
export function routePath(route: Route): string {
  return route.name === 'map' ? '/' : route.name === 'about' ? '/about' : `/${route.name}/${route.id}`
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const snapshot = () => window.location.hash

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, snapshot, () => ''))
}

export function go(path: string, replace = false): void {
  const hash = `#${path}`
  if (replace) {
    window.history.replaceState(null, '', hash)
    // replaceState fires no hashchange.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = hash
  }
}

/** Back one step in our own history, else to the map. */
export function back(): void {
  if (window.history.length > 1) window.history.back()
  else go('/', true)
}

export function roomUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}#/room/${encodeURIComponent(id)}`
}
