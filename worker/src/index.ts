import Anthropic from '@anthropic-ai/sdk'
import { askClaude, type MessagesClient } from './chat'
import { CAMPUS_KEY, clientKey, parseCampusIps } from './limits'
import { mockChat } from './mock'
import type { Env } from './types'
import { parseRequest } from './validate'

const PAGES_ORIGIN = 'https://ryusakichan.github.io'
/** The largest request body read, in bytes. Ten turns of Thai text stay well under it. */
const MAX_BODY = 65536
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

/**
 * Limits: a minute window first, then the daily counter, so a minute-limited request does not
 * count against the day. Campus addresses share one key and a bigger minute limit. Any broken
 * piece fails open: a failing binding never turns into a 5xx or 429.
 */
async function limited(env: Env, ip: string): Promise<boolean> {
  const key = clientKey(ip, parseCampusIps(env.CAMPUS_IPS))
  const minute = key === CAMPUS_KEY ? env.CAMPUS_MINUTE : env.MINUTE_LIMIT
  if (minute) {
    try {
      if (!(await minute.limit({ key })).success) return true
    } catch {
      console.error('minute limit unavailable')
    }
  }
  if (env.COUNTER) {
    try {
      const { allowed } = await env.COUNTER.get(env.COUNTER.idFromName('daily') as never).check(key)
      if (!allowed) return true
    } catch {
      console.error('daily counter unavailable')
    }
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

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too_large' }, 413, origin)
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return json({ error: 'too_large' }, 413, origin)
    body = JSON.parse(text)
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
