import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { askClaude, buildParams, MODEL, systemBlock, type MessagesClient } from './chat'
import { handle } from './index'
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

const post = (body: unknown, env: Env = {}, origin: string | null = ORIGIN, client?: MessagesClient) =>
  handle(
    new Request('https://worker.test/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    }),
    env,
    client,
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
    expect(body.reply).toContain('Sample')
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

  it('returns 429 when the per-minute limit trips', async () => {
    const { client } = fakeClient('{}')
    const env: Env = { ANTHROPIC_API_KEY: 'test', MINUTE_LIMIT: { limit: async () => ({ success: false }) } }
    expect((await post(ask('hi'), env, ORIGIN, client)).status).toBe(429)
  })

  it('returns 429 after 60 questions in a day when KV is bound', async () => {
    const store = new Map<string, string>()
    const env: Env = {
      ANTHROPIC_API_KEY: 'test',
      DAILY: { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) },
    }
    const { client } = fakeClient(JSON.stringify({ reply: 'ok', actions: [] }))
    for (let i = 0; i < 60; i++) expect((await post(ask('hi'), env, ORIGIN, client)).status).toBe(200)
    expect((await post(ask('hi'), env, ORIGIN, client)).status).toBe(429)
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
