import raw from './faq.json'

/** One "who handles what" entry, written by the group in its own words. */
export interface FaqEntry {
  id: string
  task: string
  taskTh?: string
  answer: string
  deptId?: string
  roomId?: string
  /** Official SIIT page the answer points to. */
  url: string
}

export const faqEntries = raw as FaqEntry[]
