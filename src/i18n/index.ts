import { useAppStore } from '../state/store'
import { strings, type Lang, type StringKey } from './strings'

export type { Lang, StringKey }
export type T = (key: StringKey, vars?: Record<string, string | number>) => string

export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text = strings[lang][key]
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v))
  return text
}

export function useT(): T {
  const lang = useAppStore((s) => s.lang)
  return (key, vars) => translate(lang, key, vars)
}

/** Thai text if the app is in Thai and the data has it, else English. */
export function pick(lang: Lang, en: string, th?: string): string {
  return lang === 'th' && th ? th : en
}
