import Anthropic from '@anthropic-ai/sdk'
import { askClaude, type MessagesClient } from './chat'
import { mockChat } from './mock'
import type { Env } from './types'
import { parseRequest } from './validate'

const PAGES_ORIGIN = 'https://ryusakichan.github.io'
const DAILY_LIMIT = 60
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function allowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null
  const extra = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (origin === PAGES_ORIGIN || extra.includes(origin)) return origin
  if (env.ALLOW_LOCALHOST === '1' && LOCAL.test(origin)) return origin
  return null
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' }
  if (origin) headers['access-control-allow-origin'] = origin
  return new Response(JSON.stringify(body), { status, headers })
}

export const isMock = (env: Env): boolean => env.MOCK === '1' || !env.ANTHROPIC_API_KEY

/** Per-IP limits: a minute window from the rate-limiting binding, a day count from KV when bound. */
async function limited(env: Env, ip: string): Promise<boolean> {
  if (env.MINUTE_LIMIT && !(await env.MINUTE_LIMIT.limit({ key: ip })).success) return true
  if (env.DAILY) {
    const key = `d:${ip}:${new Date().toISOString().slice(0, 10)}`
    const n = Number((await env.DAILY.get(key)) ?? 0)
    if (n >= DAILY_LIMIT) return true
    await env.DAILY.put(key, String(n + 1), { expirationTtl: 172800 })
  }
  return false
}

export async function handle(request: Request, env: Env, client?: MessagesClient): Promise<Response> {
  const url = new URL(request.url)
  const origin = allowedOrigin(request.headers.get('origin'), env)

  if (request.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 403 })
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin',
      },
    })
  }
  if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, mock: isMock(env) }, 200, origin)
  if (request.method !== 'POST' || url.pathname !== '/chat') return json({ error: 'not_found' }, 404, origin)
  if (!origin) return json({ error: 'forbidden' }, 403, null)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_body' }, 400, origin)
  }
  const parsed = parseRequest(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)

  // Mock answers cost nothing, so they skip the rate limit.
  if (isMock(env) && !client) return json(mockChat(parsed.value), 200, origin)

  if (await limited(env, request.headers.get('cf-connecting-ip') ?? 'unknown')) return json({ error: 'rate_limited' }, 429, origin)

  try {
    const c = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 })
    return json(await askClaude(parsed.value, c), 200, origin)
  } catch (err) {
    // Log the error class only, never the message text.
    console.error('upstream error', err instanceof Anthropic.APIError ? err.status : 'unknown')
    const rateLimited = err instanceof Anthropic.RateLimitError
    return json({ error: rateLimited ? 'rate_limited' : 'upstream' }, rateLimited ? 429 : 502, origin)
  }
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
}
