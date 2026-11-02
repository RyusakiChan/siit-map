import type { Lang } from '../../src/i18n/strings'

/** Bindings and variables of the Worker (see worker/wrangler.toml). */
export interface Env {
  /** Secret: `wrangler secret put ANTHROPIC_API_KEY`. Without it the Worker answers in mock mode. */
  ANTHROPIC_API_KEY?: string
  /** "1" forces mock mode even when a key is set. */
  MOCK?: string
  /** "1" also allows http://localhost origins. Used by `npm run worker:dev` only. */
  ALLOW_LOCALHOST?: string
  /** Comma-separated extra origins (optional). */
  ALLOWED_ORIGINS?: string
  /** Comma-separated shared campus Wi-Fi addresses. */
  CAMPUS_IPS?: string
  /** Cloudflare rate-limiting binding: per client per minute. */
  MINUTE_LIMIT?: RateLimiter
  /** Rate-limiting binding for the shared campus address. */
  CAMPUS_MINUTE?: RateLimiter
  /** Durable Object namespace of the daily counter (one instance, "daily"). */
  COUNTER?: {
    idFromName(name: string): unknown
    get(id: never): { check(clientKey: string): Promise<{ allowed: boolean }> }
  }
}

export type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> }

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  lang: Lang
  here?: { qrId: string; floor: number }
}

export type Action =
  | { type: 'show_room'; roomId: string }
  | { type: 'show_dept'; deptId: string }
  | { type: 'show_route'; fromId: string | null; toId: string }
  | { type: 'source'; url: string }

export interface ChatResponse {
  reply: string
  actions: Action[]
}

export const LIMITS = {
  messageChars: 300,
  assistantChars: 1500,
  turns: 10,
  maxTokens: 600,
  replyChars: 1200,
  /** Buttons under one answer: two map actions plus one source link. */
  mapActions: 2,
} as const
