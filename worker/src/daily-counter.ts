import { DurableObject } from 'cloudflare:workers'
import { DailyCounterLogic } from './counter'

/** SQLite-backed Durable Object: one instance ("daily") counts every question. */
export class DailyCounter extends DurableObject {
  private readonly logic: DailyCounterLogic

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    this.logic = new DailyCounterLogic(ctx.storage.sql as never)
  }

  /** Check and count today's question for this client key and the global key. */
  check(clientKey: string): { allowed: boolean } {
    return this.logic.check(clientKey)
  }
}
