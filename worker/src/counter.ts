import { capFor, GLOBAL_KEY, LIMITS_CONFIG } from './limits'

/** The small part of the Durable Object SQL storage this logic needs. */
export interface SqlLike {
  exec(query: string, ...bindings: (string | number)[]): { toArray(): Record<string, unknown>[] }
}

/** Daily counts for one client key and the whole Worker, in SQLite. Plain class so tests can use a fake SQL. */
export class DailyCounterLogic {
  constructor(private readonly sql: SqlLike) {
    sql.exec('CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, k))')
  }

  private count(day: string, k: string): number {
    const row = this.sql.exec('SELECT n FROM daily WHERE day = ? AND k = ?', day, k).toArray()[0]
    return Number(row?.n ?? 0)
  }

  /** Synchronous, so a Durable Object runs it without interleaving. Counts only when allowed. */
  check(clientKey: string, now: Date = new Date()): { allowed: boolean } {
    const day = now.toISOString().slice(0, 10)
    const oldest = new Date(now.getTime() - (LIMITS_CONFIG.keepDays - 1) * 86400000).toISOString().slice(0, 10)
    this.sql.exec('DELETE FROM daily WHERE day < ?', oldest)
    if (this.count(day, clientKey) >= capFor(clientKey) || this.count(day, GLOBAL_KEY) >= LIMITS_CONFIG.globalDaily) return { allowed: false }
    for (const k of [clientKey, GLOBAL_KEY]) {
      this.sql.exec('INSERT INTO daily (day, k, n) VALUES (?, ?, 1) ON CONFLICT (day, k) DO UPDATE SET n = n + 1', day, k)
    }
    return { allowed: true }
  }
}
