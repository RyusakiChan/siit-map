import { checkedAnswer, contextNote, SORRY, systemBlock } from './chat'
import type { ChatRequest, ChatResponse, Env } from './types'

export const DEFAULT_QWEN_BASE_URL = 'https://gateway.9arm.co/v1'
export const DEFAULT_QWEN_MODEL = 'qwen3.8-27b-fp8'
/**
 * Qwen-only answer cap. Thai text costs more tokens than English and the JSON wrapper adds
 * about 150, so the shared 600 could cut a Thai answer mid-string (which becomes the apology).
 */
export const QWEN_MAX_TOKENS = 800
/** Under the app's 25 s wait, so a slow answer still gets the Worker's error reply. */
export const QWEN_TIMEOUT_MS = 22_000

/** A non-2xx answer from the gateway. Carries the status code only, never the body. */
export class QwenHttpError extends Error {
  constructor(readonly status: number) {
    super(`qwen http ${status}`)
  }
}

/** json_object mode does not enforce a schema, so the shape is spelled out in the system message. */
export const jsonShapeText = (): string =>
  [
    'OUTPUT FORMAT',
    'Reply with exactly one JSON object on a single line, with no spaces or line breaks between tokens: no markdown, no code fence, no text before or after it.',
    'Shape: {"reply":"<one or two short sentences>","actions":[...]}. Use "actions":[] when none apply.',
    'Each action has only the fields it needs:',
    '{"type":"show_room","roomId":"<room id from DATA>"}',
    '{"type":"show_dept","deptId":"<department id from DATA>"}',
    '{"type":"show_route","fromId":"<room id from DATA, or null>","toId":"<room id from DATA>"}',
    '{"type":"source","url":"<the FAQ entry\'s source url>"}',
  ].join('\n')

export function buildQwenBody(req: ChatRequest, env: Env): Record<string, unknown> {
  const last = req.messages.length - 1
  return {
    model: env.QWEN_MODEL || DEFAULT_QWEN_MODEL,
    max_tokens: QWEN_MAX_TOKENS,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    // Qwen 3 would otherwise spend the token cap on thinking.
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: 'system', content: `${systemBlock()}\n\n${jsonShapeText()}` },
      ...req.messages.map((m, i) => ({ role: m.role, content: i === last ? `${m.content}\n\n${contextNote(req)}` : m.content })),
    ],
  }
}

/** Removes a leading <think> block and a surrounding ```json fence, if the model added them. */
export function cleanQwenText(raw: string): string {
  let t = raw.trim().replace(/^<think>[\s\S]*?<\/think>\s*/, '')
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t)
  if (fence) t = fence[1] ?? t
  return t.trim()
}

/** Calls Qwen through the OpenAI-compatible gateway. Throws QwenHttpError or a network/timeout error for the caller to map. */
export async function askQwen(req: ChatRequest, env: Env, fetchFn: typeof fetch = fetch): Promise<ChatResponse> {
  const base = (env.QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL).replace(/\/+$/, '')
  const res = await fetchFn(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${(env.QWEN_API_KEY ?? '').trim()}`,
      'content-type': 'application/json',
      // The gateway answered 403 to a default client user agent.
      'user-agent': 'siit-map-ask',
    },
    body: JSON.stringify(buildQwenBody(req, env)),
    signal: AbortSignal.timeout(QWEN_TIMEOUT_MS),
  })
  if (!res.ok) throw new QwenHttpError(res.status)
  const sorry = { reply: SORRY[req.lang], actions: [] }
  let body: { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] }
  try {
    body = (await res.json()) as typeof body
  } catch {
    return sorry
  }
  const choice = body.choices?.[0]
  if (!choice || choice.finish_reason === 'length' || typeof choice.message?.content !== 'string') return sorry
  return checkedAnswer(cleanQwenText(choice.message.content), req.lang)
}
