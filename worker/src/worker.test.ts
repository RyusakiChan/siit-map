import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { askClaude, buildParams, MODEL, systemBlock, type MessagesClient } from './chat'
import { DailyCounterLogic } from './counter'
import { fakeSql } from './fake-sql'
import { handle, isMock } from './index'
import { buildQwenBody, cleanQwenText, QWEN_MAX_TOKENS } from './qwen'
import { clientKey, parseCampusIps } from './limits'
import { mockChat } from './mock'
import { buildingContext } from './prompt'
import { data } from './data'
import type { Env } from './types'
import { parseRequest, sanitizeActions } from './validate'

const ORIGIN = 'https://ryusakichan.github.io'

function fakeClient(text: string, stop_reason = 'end_turn') {
  const create = vi.fn<MessagesClient['messages']['create']>(async () => ({ stop_reason, content: [{ type: 'text', text }] }) as unknown as Anthropic.Message)
  return { client: { messages: { create } } as MessagesClient, create }
}

/** An in-memory stand-in for the COUNTER namespace: the real counter logic over a fake SQL. */
function fakeCounterNs(): NonNullable<Env['COUNTER']> {
  const logic = new DailyCounterLogic(fakeSql())
  return { idFromName: (n) => n, get: () => ({ check: async (k: string) => logic.check(k) }) }
}

const post = (body: unknown, env: Env = {}, origin: string | null = ORIGIN, client?: MessagesClient, ip?: string, qwenFetch?: typeof fetch) =>
  handle(
    new Request('https://worker.test/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(ip ? { 'cf-connecting-ip': ip } : {}) },
      body: JSON.stringify(body),
    }),
    env,
    client,
    qwenFetch,
  )

const ask = (content: string) => ({ lang: 'en', messages: [{ role: 'user', content }] })

describe('parseRequest', () => {
  it('accepts a plain question', () => {
    const r = parseRequest(ask('hello'))
    expect(r.ok).toBe(true)
  })

  it('rejects empty, over-long and mis-ordered conversations', () => {
    expect(parseRequest({ lang: 'en', messages: [] }).ok).toBe(false)
    expect(parseRequest(ask('x'.repeat(301))).ok).toBe(false)
    expect(parseRequest({ lang: 'en', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }).ok).toBe(false)
    expect(parseRequest({ lang: 'en', messages: [{ role: 'system', content: 'a' }] }).ok).toBe(false)
  })

  it('keeps only the last 10 turns and starts on a user turn', () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` }))
    const r = parseRequest({ lang: 'th', messages })
    expect(r.ok && r.value.messages.length).toBeLessThanOrEqual(10)
    expect(r.ok && r.value.messages[0]?.role).toBe('user')
    expect(r.ok && r.value.lang).toBe('th')
  })

  it('drops an unknown QR point', () => {
    const r = parseRequest({ ...ask('hi'), here: { qrId: 'nope', floor: 2 } })
    expect(r.ok && r.value.here).toBeUndefined()
    const known = parseRequest({ ...ask('hi'), here: { qrId: data.qrPoints[0]?.id, floor: 99 } })
    expect(known.ok && known.value.here?.floor).toBe(data.qrPoints[0]?.floor)
  })
})

describe('sanitizeActions', () => {
  const room = data.rooms[0]?.id as string
  const dept = data.departments[0]?.id as string

  it('keeps valid ids and drops unknown ones', () => {
    const out = sanitizeActions([
      { type: 'show_room', roomId: room },
      { type: 'show_room', roomId: 'made-up' },
      { type: 'show_dept', deptId: dept },
      { type: 'show_route', fromId: null, toId: room },
      { type: 'show_route', fromId: 'made-up', toId: room },
    ])
    expect(out).toEqual([
      { type: 'show_room', roomId: room },
      { type: 'show_dept', deptId: dept },
    ])
  })

  it('allows two map actions plus one source from the allowed list', () => {
    const out = sanitizeActions([
      { type: 'show_room', roomId: room },
      { type: 'show_route', fromId: null, toId: room },
      { type: 'show_dept', deptId: dept },
      { type: 'source', url: 'https://evil.example/' },
      { type: 'source', url: 'https://www.siit.tu.ac.th/' },
    ])
    expect(out.map((a) => a.type)).toEqual(['show_room', 'show_route', 'source'])
  })

  it('returns nothing for junk', () => {
    expect(sanitizeActions('x')).toEqual([])
    expect(sanitizeActions([null, 3, {}])).toEqual([])
  })
})

describe('askClaude with a mocked SDK', () => {
  const room = data.rooms[0]?.id as string

  it('sends the cached system block, structured output and low effort to Haiku', async () => {
    const { client, create } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    await askClaude({ lang: 'en', messages: [{ role: 'user', content: 'hi' }] }, client)
    const params = create.mock.calls[0]?.[0] as Anthropic.MessageCreateParamsNonStreaming
    expect(params.model).toBe(MODEL)
    expect(params.model).toBe('claude-haiku-5-5')
    expect(params.max_tokens).toBe(600)
    expect(params.output_config?.effort).toBe('low')
    expect(params.output_config?.format?.type).toBe('json_schema')
    const sys = params.system as Anthropic.TextBlockParam[]
    expect(sys[0]?.cache_control).toEqual({ type: 'ephemeral' })
    expect(sys[0]?.text).toBe(systemBlock())
  })

  it('keeps the system block identical between requests so it caches', () => {
    const a = buildParams({ lang: 'en', messages: [{ role: 'user', content: 'one' }] })
    const b = buildParams({ lang: 'th', messages: [{ role: 'user', content: 'two' }], here: { qrId: 'sample-f1-lobby', floor: 1 } })
    expect(JSON.stringify(a.system)).toBe(JSON.stringify(b.system))
  })

  it('puts the current place after the question, not in the system block', () => {
    const p = buildParams({ lang: 'en', messages: [{ role: 'user', content: 'nearest restroom' }], here: { qrId: 'sample-f2-lift', floor: 2 } })
    expect(JSON.stringify(p.messages)).toContain('floor 2')
    expect(JSON.stringify(p.system)).not.toContain('sample-f2-lift floor')
  })

  it('removes ids that do not exist from the model output', async () => {
    const { client } = fakeClient(
      JSON.stringify({
        reply: 'Try the lobby.',
        actions: [
          { type: 'show_room', roomId: room, deptId: null, fromId: null, toId: null, url: null },
          { type: 'show_room', roomId: 'invented', deptId: null, fromId: null, toId: null, url: null },
        ],
      }),
    )
    const out = await askClaude({ lang: 'en', messages: [{ role: 'user', content: 'hi' }] }, client)
    expect(out.reply).toBe('Try the lobby.')
    expect(out.actions).toEqual([{ type: 'show_room', roomId: room }])
  })

  it('falls back to an apology on a refusal, cut-off or broken JSON', async () => {
    for (const [text, stop] of [['{}', 'refusal'], ['{"reply":"x', 'max_tokens'], ['not json', 'end_turn']] as const) {
      const { client } = fakeClient(text, stop)
      const out = await askClaude({ lang: 'en', messages: [{ role: 'user', content: 'hi' }] }, client)
      expect(out.actions).toEqual([])
      expect(out.reply).toContain('siit.tu.ac.th')
    }
  })
})

describe('prompt data', () => {
  it('lists every room id and department id', () => {
    const text = buildingContext(data)
    for (const r of data.rooms) expect(text).toContain(r.id)
    for (const d of data.departments) expect(text).toContain(d.id)
  })

  it('names every department of a shared room', () => {
    const shared = data.rooms.find((r) => r.departmentIds?.length)
    expect(shared).toBeDefined()
    const row = buildingContext(data).split('\n').find((l) => l.startsWith(`${shared!.id}|`))!
    expect(row).toContain(shared!.departmentIds!.join('+'))
  })
})

describe('handler', () => {
  it('answers in mock mode without a key', async () => {
    const res = await post(ask('Where do I pay tuition fees?'))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    const body = (await res.json()) as { reply: string; actions: { type: string }[] }
    expect(body.reply).toContain('1-211')
    expect(body.actions.some((a) => a.type === 'show_room')).toBe(true)
  })

  it('answers a Thai question in Thai', async () => {
    const res = await post({ lang: 'th', messages: [{ role: 'user', content: 'ห้องน้ำอยู่ที่ไหน' }] })
    const body = (await res.json()) as { reply: string }
    expect(body.reply).toMatch(/[฀-๿]/)
  })

  it('refuses unknown origins and missing origins', async () => {
    expect((await post(ask('hi'), {}, 'https://evil.example')).status).toBe(403)
    expect((await post(ask('hi'), {}, null)).status).toBe(403)
  })

  it('allows localhost only when the dev flag is set', async () => {
    expect((await post(ask('hi'), {}, 'http://localhost:5173')).status).toBe(403)
    const ok = await post(ask('hi'), { ALLOW_LOCALHOST: '1' }, 'http://localhost:5173')
    expect(ok.status).toBe(200)
  })

  it('answers the CORS preflight only for allowed origins', async () => {
    const pre = (origin: string) => handle(new Request('https://worker.test/chat', { method: 'OPTIONS', headers: { origin } }), {})
    expect((await pre(ORIGIN)).status).toBe(204)
    expect((await pre('https://evil.example')).status).toBe(403)
  })

  it('rejects bad bodies with 400', async () => {
    expect((await post({ lang: 'en', messages: [] })).status).toBe(400)
    expect((await post(ask('x'.repeat(301)))).status).toBe(400)
  })

  it('refuses bodies over 64 KB with 413 before parsing them', async () => {
    const huge = { lang: 'en', messages: [{ role: 'user', content: 'hi' }], pad: 'x'.repeat(70000) }
    expect((await post(huge)).status).toBe(413)
  })

  it('returns 429 when the per-minute limit trips', async () => {
    const { client } = fakeClient('{}')
    const env: Env = { ANTHROPIC_API_KEY: 'test', MINUTE_LIMIT: { limit: async () => ({ success: false }) } }
    expect((await post(ask('hi'), env, ORIGIN, client)).status).toBe(429)
  })

  it('returns 429 after 100 questions in a day from one client', async () => {
    const env: Env = { ANTHROPIC_API_KEY: 'test', COUNTER: fakeCounterNs() }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    for (let i = 0; i < 100; i++) expect((await post(ask('hi'), env, ORIGIN, client, '203.0.113.5')).status).toBe(200)
    expect((await post(ask('hi'), env, ORIGIN, client, '203.0.113.5')).status).toBe(429)
    // Another client is unaffected.
    expect((await post(ask('hi'), env, ORIGIN, client, '203.0.113.6')).status).toBe(200)
  })

  it('gives the campus address 1,000 a day and one shared key', async () => {
    const env: Env = { ANTHROPIC_API_KEY: 'test', CAMPUS_IPS: ' 183.88.238.226 , 10.0.0.1', COUNTER: fakeCounterNs() }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    for (let i = 0; i < 1000; i++) expect((await post(ask('hi'), env, ORIGIN, client, i % 2 ? '183.88.238.226' : '10.0.0.1')).status).toBe(200)
    expect((await post(ask('hi'), env, ORIGIN, client, '183.88.238.226')).status).toBe(429)
  })

  it('uses the campus minute limiter for campus and the normal one for others', async () => {
    const campus = vi.fn(async (opts: { key: string }) => ({ success: opts.key.length > 0 }))
    const normal = vi.fn(async (opts: { key: string }) => ({ success: opts.key.length > 0 }))
    const env: Env = { ANTHROPIC_API_KEY: 'test', CAMPUS_IPS: '183.88.238.226', MINUTE_LIMIT: { limit: normal }, CAMPUS_MINUTE: { limit: campus } }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    await post(ask('hi'), env, ORIGIN, client, '183.88.238.226')
    await post(ask('hi'), env, ORIGIN, client, '2001:db8:1:2:aaaa::9')
    expect(campus).toHaveBeenCalledWith({ key: 'campus' })
    expect(normal).toHaveBeenCalledWith({ key: '2001:db8:1:2::/64' })
    expect(campus).toHaveBeenCalledTimes(1)
    expect(normal).toHaveBeenCalledTimes(1)
  })

  it('trips the global cap at 2,000 across many clients', async () => {
    const env: Env = { ANTHROPIC_API_KEY: 'test', COUNTER: fakeCounterNs() }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    for (let i = 0; i < 2000; i++) expect((await post(ask('hi'), env, ORIGIN, client, `198.51.${Math.floor(i / 50)}.${i % 50}`)).status).toBe(200)
    expect((await post(ask('hi'), env, ORIGIN, client, '192.0.2.99')).status).toBe(429)
  })

  it('does not count a minute-limited request against the day', async () => {
    const check = vi.fn((k: string) => ({ allowed: k.length > 0 }))
    const env: Env = {
      ANTHROPIC_API_KEY: 'test',
      MINUTE_LIMIT: { limit: async () => ({ success: false }) },
      COUNTER: { idFromName: () => 'x', get: () => ({ check: async (k: string) => check(k) }) },
    }
    const { client } = fakeClient('{}')
    expect((await post(ask('hi'), env, ORIGIN, client)).status).toBe(429)
    expect(check).not.toHaveBeenCalled()
  })

  it('fails open when the daily counter throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const env: Env = {
      ANTHROPIC_API_KEY: 'test',
      COUNTER: {
        idFromName: () => 'x',
        get: () => ({
          check: async () => {
            throw new Error('do down 203.0.113.5 secret question')
          },
        }),
      },
    }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    expect((await post(ask('secret question'), env, ORIGIN, client, '203.0.113.5')).status).toBe(200)
    expect(spy).toHaveBeenCalled()
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/203\.0\.113|secret/)
    spy.mockRestore()
  })

  it('fails open when a rate-limit binding throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = {
      limit: async (): Promise<{ success: boolean }> => {
        throw new Error('binding down')
      },
    }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    const env: Env = { ANTHROPIC_API_KEY: 'test', CAMPUS_IPS: '183.88.238.226', MINUTE_LIMIT: boom, CAMPUS_MINUTE: boom }
    expect((await post(ask('hi'), env, ORIGIN, client, '203.0.113.5')).status).toBe(200)
    expect((await post(ask('hi'), env, ORIGIN, client, '183.88.238.226')).status).toBe(200)
    spy.mockRestore()
  })

  it('skips every limit in mock mode', async () => {
    const env: Env = {
      COUNTER: { idFromName: () => 'x', get: () => ({ check: async () => ({ allowed: false }) }) },
      MINUTE_LIMIT: { limit: async () => ({ success: false }) },
    }
    expect((await post(ask('hi'), env)).status).toBe(200)
  })

  it('maps SDK failures to 502 without echoing the text', async () => {
    const create = vi.fn(async () => {
      throw new Error('boom: secret question text')
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post(ask('secret question text'), { ANTHROPIC_API_KEY: 'test' }, ORIGIN, { messages: { create } } as unknown as MessagesClient)
    expect(res.status).toBe(502)
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret')
    expect(await res.text()).not.toContain('secret')
    spy.mockRestore()
  })
})

/** A fake gateway: records each call and answers with the given status and body. */
function fakeGateway(content: unknown, opts: { status?: number; finish?: string; raw?: string } = {}) {
  const fn = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => {
    if (opts.raw !== undefined) return new Response(opts.raw, { status: opts.status ?? 200 })
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: opts.finish ?? 'stop' }] }), { status: opts.status ?? 200 })
  })
  return { fetchFn: fn as unknown as typeof fetch, fn }
}

describe('Qwen provider', () => {
  const qenv: Env = { PROVIDER: 'qwen', QWEN_API_KEY: 'qk-test' }
  const room = data.rooms[0]?.id as string
  const good = JSON.stringify({ reply: 'Try the lobby.', actions: [{ type: 'show_room', roomId: room, deptId: null, fromId: null, toId: null, url: null }] })
  const qpost = (fetchFn: typeof fetch, env: Env = qenv, body: unknown = ask('hi')) => post(body, env, ORIGIN, undefined, undefined, fetchFn)

  it('sends an OpenAI-style request with the key, user agent and JSON mode', async () => {
    const { fetchFn, fn } = fakeGateway(good)
    const body = { lang: 'th', messages: [{ role: 'user', content: 'ห้องน้ำ' }], here: { qrId: 'sample-f2-lift', floor: 2 } }
    await qpost(fetchFn, qenv, body)
    const [url, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gateway.9arm.co/v1/chat/completions')
    expect(init.method).toBe('POST')
    const h = init.headers as Record<string, string>
    expect(h.authorization).toBe('Bearer qk-test')
    expect(h['content-type']).toBe('application/json')
    expect(h['user-agent']).toBe('siit-map-ask')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const sent = JSON.parse(init.body as string)
    expect(sent.model).toBe('qwen3.8-27b-fp8')
    expect(sent.max_tokens).toBe(QWEN_MAX_TOKENS)
    expect(sent.max_tokens).toBeLessThanOrEqual(1000)
    expect(sent.temperature).toBe(0.2)
    expect(sent.response_format).toEqual({ type: 'json_object' })
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(sent.messages[0].role).toBe('system')
    expect(sent.messages[0].content).toContain(systemBlock())
    expect(sent.messages[0].content).toContain('single line')
    expect(sent.messages[0].content).toContain('{"type":"show_room","roomId":')
    expect(sent.messages[1].role).toBe('user')
    expect(sent.messages[1].content).toContain('ห้องน้ำ')
    expect(sent.messages[1].content).toContain('UI language: th.')
    expect(sent.messages[1].content).toContain('floor 2')
    expect(sent.messages).toHaveLength(2)
  })

  it('trims the key (a secret piped from PowerShell can end in CR/LF) and treats a blank key as missing', async () => {
    const { fetchFn, fn } = fakeGateway(good)
    await qpost(fetchFn, { ...qenv, QWEN_API_KEY: '  qk-test\r\n' })
    const init = fn.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer qk-test')
    expect(isMock({ PROVIDER: 'qwen', QWEN_API_KEY: ' \r\n' })).toBe(true)
    expect(isMock({ PROVIDER: 'qwen', QWEN_API_KEY: 'qk-test\r\n' })).toBe(false)
  })

  it('honours QWEN_BASE_URL and QWEN_MODEL and trims a trailing slash', async () => {
    const { fetchFn, fn } = fakeGateway(good)
    await qpost(fetchFn, { ...qenv, QWEN_BASE_URL: 'https://example.test/v1/', QWEN_MODEL: 'other-model' })
    const [url, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.test/v1/chat/completions')
    expect(JSON.parse(init.body as string).model).toBe('other-model')
  })

  it('returns a checked answer from a good JSON reply', async () => {
    const { fetchFn } = fakeGateway(good)
    const res = await qpost(fetchFn)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reply: 'Try the lobby.', actions: [{ type: 'show_room', roomId: room }] })
  })

  it('drops invented ids and cuts a long reply', async () => {
    const long = JSON.stringify({ reply: 'x'.repeat(5000), actions: [{ type: 'show_room', roomId: 'invented', deptId: null, fromId: null, toId: null, url: null }] })
    const { fetchFn } = fakeGateway(long)
    const out = (await (await qpost(fetchFn)).json()) as { reply: string; actions: unknown[] }
    expect(out.reply).toHaveLength(1200)
    expect(out.actions).toEqual([])
  })

  it('accepts fenced and think-wrapped JSON', async () => {
    for (const content of ['```json\n' + good + '\n```', '```\n' + good + '\n```', '<think>\nlet me see\n</think>\n\n' + good, '<think></think>```json\n' + good + '```', '  ' + good + '\n']) {
      const { fetchFn } = fakeGateway(content)
      const out = (await (await qpost(fetchFn)).json()) as { reply: string }
      expect(out.reply).toBe('Try the lobby.')
    }
    expect(cleanQwenText('<think>a</think>{"a":1}')).toBe('{"a":1}')
  })

  it('gives the apology when the answer was cut off, is not JSON, or is empty', async () => {
    const cases: ReturnType<typeof fakeGateway>[] = [
      fakeGateway('{"reply":"cut', { finish: 'length' }),
      fakeGateway(good, { finish: 'length' }),
      fakeGateway('not json at all'),
      fakeGateway('<think>never closed ' + good),
      fakeGateway(JSON.stringify({ reply: '  ', actions: [] })),
      fakeGateway('null'),
      fakeGateway(null),
      fakeGateway('', { raw: '{"choices":[]}' }),
      fakeGateway('', { raw: 'not json' }),
    ]
    for (const { fetchFn } of cases) {
      const res = await qpost(fetchFn)
      expect(res.status).toBe(200)
      const out = (await res.json()) as { reply: string; actions: unknown[] }
      expect(out.reply).toContain('siit.tu.ac.th')
      expect(out.actions).toEqual([])
    }
  })

  it('answers the Thai apology in Thai', async () => {
    const { fetchFn } = fakeGateway('nope')
    const out = (await (await qpost(fetchFn, qenv, { lang: 'th', messages: [{ role: 'user', content: 'x' }] })).json()) as { reply: string }
    expect(out.reply).toContain('ขออภัย')
  })

  it('maps HTTP 429 to the rate-limited response', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { fetchFn } = fakeGateway('', { status: 429, raw: 'secret question text' })
    const res = await qpost(fetchFn)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
    expect(spy).toHaveBeenCalledWith('upstream error', 429)
    spy.mockRestore()
  })

  it('maps 403, 500, network failure and timeout to the upstream error without leaking text or key', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing: typeof fetch[] = [
      fakeGateway('', { status: 500, raw: 'secret question text qk-test' }).fetchFn,
      fakeGateway('', { status: 403, raw: 'forbidden' }).fetchFn,
      (async () => {
        throw new TypeError('network down: secret question text qk-test')
      }) as unknown as typeof fetch,
      (async () => {
        throw new DOMException('The operation timed out: secret question text', 'TimeoutError')
      }) as unknown as typeof fetch,
    ]
    for (const fetchFn of failing) {
      const res = await qpost(fetchFn, qenv, ask('secret question text'))
      expect(res.status).toBe(502)
      const text = await res.text()
      expect(text).toBe(JSON.stringify({ error: 'upstream' }))
    }
    const logged = JSON.stringify(spy.mock.calls)
    expect(logged).not.toContain('secret')
    expect(logged).not.toContain('qk-test')
    expect(logged).toContain('500')
    spy.mockRestore()
  })

  it('still applies the per-minute limit before calling the gateway', async () => {
    const { fetchFn, fn } = fakeGateway(good)
    const res = await post(ask('hi'), { ...qenv, MINUTE_LIMIT: { limit: async () => ({ success: false }) } }, ORIGIN, undefined, undefined, fetchFn)
    expect(res.status).toBe(429)
    expect(fn).not.toHaveBeenCalled()
  })

  it('does not call the gateway in mock mode', async () => {
    const { fetchFn, fn } = fakeGateway(good)
    expect((await qpost(fetchFn, { PROVIDER: 'qwen' })).status).toBe(200)
    expect((await qpost(fetchFn, { ...qenv, MOCK: '1' })).status).toBe(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('builds the same note and conversation for several turns', () => {
    const b = buildQwenBody({ lang: 'en', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] }, {}) as { messages: { role: string; content: string }[] }
    expect(b.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(b.messages[1]?.content).toBe('a')
    expect(b.messages[3]?.content).toContain('Current place: unknown.')
  })
})

describe('provider switch', () => {
  it('isMock follows the key of the selected provider', () => {
    expect(isMock({})).toBe(true)
    expect(isMock({ ANTHROPIC_API_KEY: 'a' })).toBe(false)
    expect(isMock({ QWEN_API_KEY: 'q' })).toBe(true)
    expect(isMock({ PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'a' })).toBe(false)
    expect(isMock({ PROVIDER: 'anthropic', QWEN_API_KEY: 'q' })).toBe(true)
    expect(isMock({ PROVIDER: 'qwen', QWEN_API_KEY: 'q' })).toBe(false)
    expect(isMock({ PROVIDER: 'qwen', ANTHROPIC_API_KEY: 'a' })).toBe(true)
    expect(isMock({ PROVIDER: 'qwen', QWEN_API_KEY: 'q', MOCK: '1' })).toBe(true)
    expect(isMock({ PROVIDER: 'anything-else', ANTHROPIC_API_KEY: 'a' })).toBe(false)
  })

  it('reports mock status on the health route per provider', async () => {
    const get = async (env: Env) => (await (await handle(new Request('https://worker.test/'), env)).json()) as { mock: boolean }
    expect((await get({ PROVIDER: 'qwen', QWEN_API_KEY: 'q' })).mock).toBe(false)
    expect((await get({ PROVIDER: 'qwen', ANTHROPIC_API_KEY: 'a' })).mock).toBe(true)
  })

  it('PROVIDER=anthropic (and unset) still uses the Anthropic client, not fetch', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch
    for (const env of [{ ANTHROPIC_API_KEY: 'a' }, { PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'a', QWEN_API_KEY: 'q' }] as Env[]) {
      const { client, create } = fakeClient(JSON.stringify({ reply: 'from claude', actions: [] }))
      const res = await post(ask('hi'), env, ORIGIN, client, undefined, fetchFn)
      expect(((await res.json()) as { reply: string }).reply).toBe('from claude')
      expect(create).toHaveBeenCalledTimes(1)
    }
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('mockChat', () => {
  it('routes a room number question to a map action and a route', () => {
    const out = mockChat({ lang: 'en', messages: [{ role: 'user', content: 'How do I get to 1-301?' }] })
    expect(out.actions.map((a) => a.type)).toEqual(['show_room', 'show_route'])
  })

  it('does not know unrelated things', () => {
    const out = mockChat({ lang: 'en', messages: [{ role: 'user', content: 'zzzz qqqq' }] })
    expect(out.reply).toContain("don't have")
  })
})

describe('clientKey', () => {
  const campus = parseCampusIps(' 183.88.238.226, ,10.0.0.1 ')

  it('parses the campus list', () => {
    expect(campus).toEqual(['183.88.238.226', '10.0.0.1'])
    expect(parseCampusIps(undefined)).toEqual([])
  })

  it('maps campus addresses to one key and keeps other IPv4 whole', () => {
    expect(clientKey('183.88.238.226', campus)).toBe('campus')
    expect(clientKey('10.0.0.1', campus)).toBe('campus')
    expect(clientKey('203.0.113.5', campus)).toBe('203.0.113.5')
  })

  it('groups IPv6 by its /64 prefix, including :: forms', () => {
    expect(clientKey('2001:db8:1:2:3:4:5:6', [])).toBe('2001:db8:1:2::/64')
    expect(clientKey('2001:0DB8:0001:0002::1', [])).toBe('2001:db8:1:2::/64')
    expect(clientKey('2001:db8:1:2::', [])).toBe('2001:db8:1:2::/64')
    expect(clientKey('2001:db8::1', [])).toBe('2001:db8:0:0::/64')
    expect(clientKey('::1', [])).toBe('0:0:0:0::/64')
    expect(clientKey('::', [])).toBe('0:0:0:0::/64')
    expect(clientKey('fe80::1%eth0', [])).toBe('fe80:0:0:0::/64')
    expect(clientKey('::ffff:192.0.2.1', [])).toBe('0:0:0:0::/64')
    expect(clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd', [])).toBe(clientKey('2001:db8:1:2::ffff', []))
    expect(clientKey('2001:db8:1:3::1', [])).not.toBe(clientKey('2001:db8:1:2::1', []))
  })

  it('keeps junk as is', () => {
    expect(clientKey('unknown', [])).toBe('unknown')
    expect(clientKey('1:2:3', [])).toBe('1:2:3')
  })
})

describe('DailyCounterLogic', () => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`)

  it('counts per day and resets on a new UTC day', () => {
    const c = new DailyCounterLogic(fakeSql())
    for (let i = 0; i < 100; i++) expect(c.check('1.1.1.1', day('2026-11-02')).allowed).toBe(true)
    expect(c.check('1.1.1.1', day('2026-11-02')).allowed).toBe(false)
    expect(c.check('1.1.1.1', day('2026-11-03')).allowed).toBe(true)
  })

  it('does not count refused requests', () => {
    const c = new DailyCounterLogic(fakeSql())
    for (let i = 0; i < 150; i++) c.check('1.1.1.1', day('2026-11-02'))
    // 100 were allowed; refused ones added nothing, so 1,900 more fit under the global cap.
    let ok = 0
    for (let i = 0; i < 2000; i++) if (c.check(`9.9.${Math.floor(i / 90)}.${i % 90}`, day('2026-11-02')).allowed) ok++
    expect(ok).toBe(1900)
  })

  it('gives campus 1,000 a day', () => {
    const c = new DailyCounterLogic(fakeSql())
    let campus = 0
    for (let i = 0; i < 1100; i++) if (c.check('campus', day('2026-11-02')).allowed) campus++
    expect(campus).toBe(1000)
  })

  it('deletes rows older than two days', () => {
    const sql = fakeSql()
    const c = new DailyCounterLogic(sql)
    c.check('a', day('2026-11-01'))
    c.check('a', day('2026-11-02'))
    c.check('a', day('2026-11-03'))
    const rows = sql.exec('SELECT day FROM daily').toArray().map((r) => r.day)
    expect(rows).not.toContain('2026-11-01')
    expect(rows).toContain('2026-11-02')
  })

  // The same logic against real SQLite (node:sqlite), to check the SQL text itself.
  it('runs on real SQLite', async () => {
    const mod = (await import(/* @vite-ignore */ 'node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare(q: string): { all(...a: unknown[]): unknown[]; run(...a: unknown[]): unknown } } }
    const db = new mod.DatabaseSync(':memory:')
    const sql = {
      exec(q: string, ...b: (string | number)[]) {
        const st = db.prepare(q)
        const rows = /^\s*(select)/i.test(q) ? (st.all(...b) as Record<string, unknown>[]) : (st.run(...b), [])
        return { toArray: () => rows }
      },
    }
    const c = new DailyCounterLogic(sql)
    for (let i = 0; i < 100; i++) expect(c.check('x', day('2026-11-02')).allowed).toBe(true)
    expect(c.check('x', day('2026-11-02')).allowed).toBe(false)
    expect(c.check('y', day('2026-11-02')).allowed).toBe(true)
  })
})
