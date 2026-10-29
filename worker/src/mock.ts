import { data, faq } from './data'
import type { ChatRequest, ChatResponse } from './types'

const THAI = /[฀-๿]/
const SIIT = 'https://www.siit.tu.ac.th/'

const words = (s: string) => s.toLowerCase().match(/[a-z0-9-]{3,}/g) ?? []

/** Canned answers for local work and tests: no API call, no key. */
export function mockChat(req: ChatRequest): ChatResponse {
  const text = req.messages[req.messages.length - 1]?.content ?? ''
  const thai = THAI.test(text)
  const lower = text.toLowerCase()

  // "How do I get to 3-06?"
  const num = lower.match(/\b([1-5]-\d{2})\b/)?.[1]
  const target = num ? data.rooms.find((r) => r.number === num) : undefined
  if (target) {
    return {
      reply: thai ? `ห้อง ${target.number} อยู่ชั้น ${target.floor} (ข้อมูลตัวอย่าง)` : `${target.name} is on floor ${target.floor}. This is mock mode with sample data.`,
      actions: [
        { type: 'show_room', roomId: target.id },
        { type: 'show_route', fromId: null, toId: target.id },
      ],
    }
  }

  if (/restroom|toilet|ห้องน้ำ/.test(lower)) {
    const floor = req.here?.floor ?? 1
    const rooms = data.rooms.filter((r) => r.type === 'restroom')
    const near = rooms.find((r) => r.floor === floor) ?? rooms[0]
    if (near) {
      return {
        reply: thai ? `ห้องน้ำที่ใกล้ที่สุดอยู่ชั้น ${near.floor} (ข้อมูลตัวอย่าง)` : `The nearest restrooms are on floor ${near.floor}. Mock answer.`,
        actions: [{ type: 'show_room', roomId: near.id }],
      }
    }
  }

  // Best FAQ match by shared words with the task and answer.
  const q = new Set([...words(text), ...(lower.includes('tuition') || lower.includes('pay') ? ['fees'] : [])])
  let best: { score: number; entry: (typeof faq)[number] | undefined } = { score: 0, entry: undefined }
  for (const e of faq) {
    const score = words(`${e.task} ${e.answer}`).filter((w) => q.has(w)).length
    const thaiHit = thai && e.taskTh && e.taskTh.split(/\s+/).some((w) => w.length > 2 && text.includes(w)) ? 3 : 0
    if (score + thaiHit > best.score) best = { score: score + thaiHit, entry: e }
  }
  const entry = best.entry
  if (entry) {
    const actions: ChatResponse['actions'] = []
    if (entry.roomId) actions.push({ type: 'show_room', roomId: entry.roomId })
    else if (entry.deptId) actions.push({ type: 'show_dept', deptId: entry.deptId })
    actions.push({ type: 'source', url: entry.url })
    return { reply: thai ? `${entry.taskTh ?? entry.task}: ดูตำแหน่งบนแผนที่ (คำตอบตัวอย่าง)` : entry.answer, actions }
  }

  return {
    reply: thai ? `ฉันไม่มีข้อมูลนี้ ลองดูที่ ${SIIT}` : `I don't have that information. Please check ${SIIT}.`,
    actions: [{ type: 'source', url: SIIT }],
  }
}
