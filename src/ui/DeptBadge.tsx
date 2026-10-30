import type { Department } from '../data/types'
import { deptColor, tokens } from '../theme/colors'

/** Letter badge outlined in the department color; color is never the only cue. */
export function DeptBadge({ dept, size = 18 }: { dept: Department; size?: number }) {
  const color = deptColor(dept)?.badge ?? tokens.muted
  return (
    <span className="dept-badge" style={{ width: size, height: size, borderColor: color, fontSize: size * 0.6 }} aria-hidden="true">
      {dept.letter}
    </span>
  )
}
