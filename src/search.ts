import type { BuildingData, Department, Room, RoomType } from './data/types'

/** Lower-case and drop spaces and dashes, so "2 03", "2-03" and "203" all match. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-–_.]+/g, '')
}

// Words people type for each room type (English, then draft Thai).
const typeWords: Record<RoomType, string[]> = {
  restroom: ['restroom', 'restrooms', 'toilet', 'wc', 'ห้องน้ำ'],
  elevator: ['lift', 'lifts', 'elevator', 'ลิฟต์'],
  stairs: ['stairs', 'stair', 'บันได'],
  foodservice: ['food', 'drink', 'cafe', 'café', 'canteen', 'อาหาร', 'คาเฟ่'],
  library: ['library', 'study', 'ห้องสมุด'],
  laboratory: ['lab', 'laboratory', 'ห้องปฏิบัติการ'],
  classroom: ['classroom', 'class', 'lecture', 'ห้องเรียน'],
  office: ['office', 'สำนักงาน'],
  conferenceroom: ['meeting', 'conference', 'ห้องประชุม'],
  lobby: ['lobby', 'entrance', 'reception', 'ล็อบบี้'],
  other: [],
}

function score(query: string, fields: { text: string | undefined; weight: number }[]): number {
  let best = 0
  for (const { text, weight } of fields) {
    if (!text) continue
    const t = norm(text)
    if (!t) continue
    const s = t === query ? 100 : t.startsWith(query) ? 80 : t.includes(query) ? 60 : 0
    if (s) best = Math.max(best, (s * weight) / 100)
  }
  return best
}

export interface SearchResults {
  rooms: Room[]
  departments: Department[]
}

/** Searches room names, numbers, aliases, department and type words. */
export function search(query: string, data: BuildingData): SearchResults {
  const q = norm(query)
  if (!q) return { rooms: [], departments: [] }
  const deptById = new Map(data.departments.map((d) => [d.id, d]))

  const rooms = data.rooms
    .map((room) => {
      const dept = room.departmentId ? deptById.get(room.departmentId) : undefined
      const s = score(q, [
        { text: room.number ?? undefined, weight: 100 },
        { text: room.name, weight: 95 },
        { text: room.nameTh, weight: 95 },
        ...(room.aliases ?? []).map((text) => ({ text, weight: 90 })),
        ...(room.aliasesTh ?? []).map((text) => ({ text, weight: 90 })),
        ...typeWords[room.type].map((text) => ({ text, weight: 70 })),
        { text: dept?.name, weight: 50 },
        { text: dept?.nameTh, weight: 50 },
        ...(dept?.aliases ?? []).map((text) => ({ text, weight: 50 })),
      ])
      return { room, s }
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.room.floor - b.room.floor || (a.room.number ?? '~').localeCompare(b.room.number ?? '~'))
    .map((r) => r.room)

  const departments = data.departments
    .map((d) => ({
      d,
      s: score(q, [
        { text: d.name, weight: 100 },
        { text: d.nameTh, weight: 100 },
        ...(d.aliases ?? []).map((text) => ({ text, weight: 90 })),
        ...(d.aliasesTh ?? []).map((text) => ({ text, weight: 90 })),
        // "lab" also finds departments that have labs.
        ...data.rooms.filter((r) => r.departmentId === d.id).flatMap((r) => typeWords[r.type]).map((text) => ({ text, weight: 30 })),
      ]),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.d)

  return { rooms, departments }
}

export function roomsOfTypes(types: string[], data: BuildingData): Room[] {
  return data.rooms
    .filter((r) => types.includes(r.type))
    .sort((a, b) => a.floor - b.floor || (a.number ?? '~').localeCompare(b.number ?? '~'))
}
