import Anthropic from '@anthropic-ai/sdk'
import { data, faq } from './data'
import { systemText } from './prompt'
import { LIMITS, type ChatRequest, type ChatResponse } from './types'
import { sanitizeActions } from './validate'

export const MODEL = 'claude-haiku-5-5'

/** The slice of the SDK the Worker uses, so tests can pass a fake. */
export interface MessagesClient {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> }
}

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] }

/** Structured output: every property is required; unused ones are null. */
export const outputSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['show_room', 'show_dept', 'show_route', 'source'] },
          roomId: nullableString,
          deptId: nullableString,
          fromId: nullableString,
          toId: nullableString,
          url: nullableString,
        },
        required: ['type', 'roomId', 'deptId', 'fromId', 'toId', 'url'],
        additionalProperties: false,
      },
    },
  },
  required: ['reply', 'actions'],
  additionalProperties: false,
}

let system: string | undefined
export const systemBlock = (): string => (system ??= systemText(data, faq))

/** A stairs-landing board sits half a floor above the floor it is filed under. */
const landingNote = (qrId: string, floor: number): string => (data.qrPoints.find((q) => q.id === qrId)?.landing ? ` (on the stairs landing between floors ${floor} and ${floor + 1})` : '')

/** The `[UI language … Current place …]` note that follows the last user message (both providers). */
export const contextNote = (req: ChatRequest): string =>
  `[${[`UI language: ${req.lang}.`, req.here ? `Current place: QR point ${req.here.qrId} on floor ${req.here.floor}${landingNote(req.here.qrId, req.here.floor)}.` : 'Current place: unknown.'].join(' ')}]`

export function buildParams(req: ChatRequest): Anthropic.MessageCreateParamsNonStreaming {
  const note = contextNote(req)
  const last = req.messages.length - 1
  const messages: Anthropic.MessageParam[] = req.messages.map((m, i) =>
    // The note sits after the question, outside the cached system block.
    i === last ? { role: 'user', content: [{ type: 'text', text: m.content }, { type: 'text', text: note }] } : { role: m.role, content: m.content },
  )
  return {
    model: MODEL,
    max_tokens: LIMITS.maxTokens,
    system: [{ type: 'text', text: systemBlock(), cache_control: { type: 'ephemeral' } }],
    // Thinking tokens would eat the 600-token cap and cut the JSON; answers here are lookups.
    thinking: { type: 'disabled' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: outputSchema } },
    messages,
  }
}

export const SORRY: Record<'en' | 'th', string> = {
  en: "Sorry, I couldn't answer that. Try asking in a different way, or check https://www.siit.tu.ac.th/.",
  th: 'ขออภัย ตอบเรื่องนี้ไม่ได้ ลองถามใหม่อีกครั้ง หรือดูที่ https://www.siit.tu.ac.th/',
}

/** Checks the model's JSON text and returns a safe answer (the apology when it is unusable). Shared by both providers. */
export function checkedAnswer(text: string, lang: ChatRequest['lang']): ChatResponse {
  const sorry = { reply: SORRY[lang], actions: [] }
  let parsed: { reply?: unknown; actions?: unknown } | null
  try {
    parsed = JSON.parse(text) as { reply?: unknown; actions?: unknown } | null
  } catch {
    return sorry
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.reply !== 'string' || parsed.reply.trim() === '') return sorry
  return { reply: parsed.reply.slice(0, LIMITS.replyChars), actions: sanitizeActions(parsed.actions) }
}

/** Calls Haiku and returns a checked answer. Throws the SDK's errors for the caller to map. */
export async function askClaude(req: ChatRequest, client: MessagesClient): Promise<ChatResponse> {
  const res = await client.messages.create(buildParams(req))
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return { reply: SORRY[req.lang], actions: [] }
  const block = res.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') return { reply: SORRY[req.lang], actions: [] }
  return checkedAnswer(block.text, req.lang)
}
