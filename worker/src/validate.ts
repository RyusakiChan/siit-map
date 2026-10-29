import { deptIds, qrFloors, roomIds, sourceUrls } from './data'
import { LIMITS, type Action, type ChatMessage, type ChatRequest } from './types'

export type Parsed = { ok: true; value: ChatRequest } | { ok: false; error: string }

/** Checks the request body. User turns are capped; only the last turns are kept. */
export function parseRequest(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'bad_body' }
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.messages) || b.messages.length === 0) return { ok: false, error: 'no_messages' }
  const lang = b.lang === 'th' ? 'th' : 'en'
  const messages: ChatMessage[] = []
  for (const m of b.messages.slice(-LIMITS.turns)) {
    if (typeof m !== 'object' || m === null) return { ok: false, error: 'bad_message' }
    const { role, content } = m as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || content.trim() === '') return { ok: false, error: 'bad_message' }
    const cap = role === 'user' ? LIMITS.messageChars : LIMITS.assistantChars
    if (content.length > cap) return { ok: false, error: 'too_long' }
    messages.push({ role, content })
  }
  // The conversation must start and end with the user.
  while (messages[0]?.role === 'assistant') messages.shift()
  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') return { ok: false, error: 'bad_order' }
  const value: ChatRequest = { messages, lang }
  const here = b.here
  if (typeof here === 'object' && here !== null) {
    const qrId = (here as Record<string, unknown>).qrId
    if (typeof qrId === 'string' && qrFloors.has(qrId)) value.here = { qrId, floor: qrFloors.get(qrId) as number }
  }
  return { ok: true, value }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** Keeps only actions whose ids exist in the building data. */
export function sanitizeActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return []
  const map: Action[] = []
  let source: Action | null = null
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const a = item as Record<string, unknown>
    if (a.type === 'show_room') {
      const roomId = str(a.roomId)
      if (roomId && roomIds.has(roomId)) map.push({ type: 'show_room', roomId })
    } else if (a.type === 'show_dept') {
      const deptId = str(a.deptId)
      if (deptId && deptIds.has(deptId)) map.push({ type: 'show_dept', deptId })
    } else if (a.type === 'show_route') {
      const toId = str(a.toId)
      const fromId = str(a.fromId)
      if (toId && roomIds.has(toId) && (fromId === null || roomIds.has(fromId))) map.push({ type: 'show_route', fromId, toId })
    } else if (a.type === 'source') {
      const url = str(a.url)
      if (url && sourceUrls.has(url) && !source) source = { type: 'source', url }
    }
  }
  const out = map.slice(0, LIMITS.mapActions)
  return source ? [...out, source] : out
}
