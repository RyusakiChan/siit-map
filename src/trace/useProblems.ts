import { useMemo } from 'react'
import { problemsForFloor, validate, type Problem } from '../data/validate.ts'
import { useTrace } from './store.ts'

/** The live check: runs the shared validator on every change of the draft. */
export function useAllProblems(): Problem[] {
  const draft = useTrace((s) => s.draft)
  return useMemo(() => (draft ? validate(draft) : []), [draft])
}

/** Problems on the open floor, plus building-wide ones. */
export function useProblems(): Problem[] {
  const all = useAllProblems()
  const floor = useTrace((s) => s.floor)
  return useMemo(() => problemsForFloor(all, floor), [all, floor])
}
