import type { SqlLike } from './counter'

/**
 * A tiny in-memory stand-in for Durable Object SQL storage, for tests. It understands exactly
 * the statements DailyCounterLogic issues. (The Workers runtime is not available to Vitest here.)
 */
export function fakeSql(): SqlLike {
  const rows = new Map<string, { day: string; k: string; n: number }>()
  const id = (day: unknown, k: unknown) => `${String(day)}|${String(k)}`
  return {
    exec(query, ...b) {
      const q = query.replace(/\s+/g, ' ').trim()
      let out: Record<string, unknown>[] = []
      if (q.startsWith('CREATE TABLE')) {
        // nothing to do
      } else if (q.startsWith('DELETE FROM daily WHERE day <')) {
        for (const [key, r] of rows) if (r.day < String(b[0])) rows.delete(key)
      } else if (q.startsWith('SELECT n FROM daily WHERE day = ? AND k = ?')) {
        const r = rows.get(id(b[0], b[1]))
        out = r ? [{ n: r.n }] : []
      } else if (q.startsWith('SELECT day FROM daily')) {
        out = [...rows.values()].map((r) => ({ day: r.day }))
      } else if (q.startsWith('INSERT INTO daily')) {
        const key = id(b[0], b[1])
        const r = rows.get(key)
        if (r) r.n += 1
        else rows.set(key, { day: String(b[0]), k: String(b[1]), n: 1 })
      } else {
        throw new Error(`fakeSql: unsupported statement ${q}`)
      }
      return { toArray: () => out }
    },
  }
}
