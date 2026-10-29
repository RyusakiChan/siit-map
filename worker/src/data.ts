import { buildingData } from '../../src/data'
import { faqEntries } from '../../src/data/faq'

export const data = buildingData
export const faq = faqEntries

export const roomIds = new Set(data.rooms.map((r) => r.id))
export const deptIds = new Set(data.departments.map((d) => d.id))
export const qrFloors = new Map(data.qrPoints.map((q) => [q.id, q.floor]))

/** Links the assistant may return: the official site and the FAQ's own links. */
export const sourceUrls = new Set<string>(['https://www.siit.tu.ac.th/', ...faq.map((e) => e.url)])
