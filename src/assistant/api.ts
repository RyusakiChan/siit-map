import { config } from '../config'
import type { Lang } from '../i18n/strings'

export type AssistantAction =
  | { type: 'show_room'; roomId: string }
  | { type: 'show_dept'; deptId: string }
  | { type: 'show_route'; fromId: string | null; toId: string }
  | { type: 'source'; url: string }

export interface AssistantReply {
  reply: string
  actions: AssistantAction[]
}

export interface WireMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Characters allowed in one question (the Worker enforces the same limit). */
export const MAX_CHARS = 300
export const MAX_TURNS = 10

/** True when the Worker address is set; otherwise the assistant stays hidden. */
export const assistantEnabled = (): boolean => config.assistantUrl !== ''

/** Only https links are shown as "Source". */
const safeUrl = (url: unknown): url is string => typeof url === 'string' && url.startsWith('https://')

/** Keeps the actions the UI knows how to run; the Worker has already checked the ids. */
export function readReply(body: unknown): AssistantReply | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as { reply?: unknown; actions?: unknown }
  if (typeof b.reply !== 'string' || b.reply === '') return null
  const actions: AssistantAction[] = []
  if (Array.isArray(b.actions)) {
    for (const a of b.actions as Record<string, unknown>[]) {
      if (a?.type === 'show_room' && typeof a.roomId === 'string') actions.push({ type: 'show_room', roomId: a.roomId })
      else if (a?.type === 'show_dept' && typeof a.deptId === 'string') actions.push({ type: 'show_dept', deptId: a.deptId })
      else if (a?.type === 'show_route' && typeof a.toId === 'string') actions.push({ type: 'show_route', fromId: typeof a.fromId === 'string' ? a.fromId : null, toId: a.toId })
      else if (a?.type === 'source' && safeUrl(a.url)) actions.push({ type: 'source', url: a.url })
    }
  }
  return { reply: b.reply, actions }
}

/** A hung Worker should end in the "resting" line, not a spinner. */
const TIMEOUT_MS = 25_000

export async function askWorker(messages: WireMessage[], lang: Lang, hereQrId: string | null): Promise<AssistantReply> {
  const res = await fetch(`${config.assistantUrl.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-MAX_TURNS), lang, ...(hereQrId ? { here: { qrId: hereQrId } } : {}) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`assistant ${res.status}`)
  const reply = readReply(await res.json())
  if (!reply) throw new Error('assistant: bad reply')
  return reply
}
