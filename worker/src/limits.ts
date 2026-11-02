/** All rate and cap numbers of the Ask Worker live here. */
export const LIMITS_CONFIG = {
  /** Questions a day for one ordinary client (IPv4 address or IPv6 /64). */
  clientDaily: 100,
  /** Questions a day for the shared campus Wi-Fi address(es). */
  campusDaily: 1000,
  /** Questions a day across everyone. */
  globalDaily: 2000,
  /** Days of counter rows kept (today and yesterday). */
  keepDays: 2,
} as const

/** The shared key used for every campus address. */
export const CAMPUS_KEY = 'campus'
export const GLOBAL_KEY = 'global'

/** Parse the CAMPUS_IPS variable: comma-separated, trimmed, lower-cased. */
export function parseCampusIps(value: string | undefined): string[] {
  return (value ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

/** Expand an IPv6 address into eight hextets, or null if it is not valid IPv6. */
function expandV6(ip: string): string[] | null {
  let s = ip.toLowerCase()
  const zone = s.indexOf('%')
  if (zone >= 0) s = s.slice(0, zone)
  // An embedded IPv4 tail (::ffff:1.2.3.4) counts as two hextets.
  const tail = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number) as [number, number, number, number]
    if ([a, b, c, d].some((n) => n > 255)) return null
    s = s.slice(0, tail.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let groups: string[]
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length
    if (fill < 1) return null
    groups = [...head, ...Array<string>(fill).fill('0'), ...rest]
  } else {
    groups = head
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => g.replace(/^0+(?=.)/, ''))
}

/**
 * The key a client is counted under. Campus addresses share "campus"; IPv4 is the
 * full address; IPv6 is its /64 prefix (first four hextets, e.g. "2001:db8:1:2::/64").
 */
export function clientKey(ip: string, campusIps: readonly string[]): string {
  const clean = ip.trim().toLowerCase()
  if (campusIps.includes(clean)) return CAMPUS_KEY
  if (clean.includes(':')) {
    const g = expandV6(clean)
    if (g) return `${g.slice(0, 4).join(':')}::/64`
  }
  return clean || 'unknown'
}

/** The daily cap of a client key. */
export const capFor = (key: string): number => (key === CAMPUS_KEY ? LIMITS_CONFIG.campusDaily : LIMITS_CONFIG.clientDaily)
