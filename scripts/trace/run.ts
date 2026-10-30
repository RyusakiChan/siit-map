// Runs a floor builder (scripts/trace/floor<N>.ts), checks the result with validate() and, with --write,
// saves it through the trace tool's save code (departments first, then the floor; each keeps a backup).
// Bundled and run by scripts/trace/run.mjs.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replaceDepartments, replaceFloor, type FloorSlice } from '../../src/trace/saveFloor'
import { validate } from '../../src/data/validate'
import { saveDepartmentsToFile, saveFloorToFile } from '../../tools/trace-plugin'
import type { BuildingData, Department } from '../../src/data/types'

export interface FloorJob {
  floor: number
  departments: Department[]
  slice: FloorSlice
  report: string[]
}

export function runJob(job: FloorJob, write: boolean): void {
  const root = process.cwd()
  const file = resolve(root, 'src/data/building.json')
  const backups = resolve(root, '.trace-backups')
  const current = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
  const have = new Set(current.departments.map((d) => d.id))
  const wanted = [...current.departments, ...job.departments.filter((d) => !have.has(d.id))]
  const next = replaceFloor(replaceDepartments(current, wanted), job.slice)
  const problems = validate(next)
  const errors = problems.filter((p) => p.severity === 'error')
  console.log(job.report.join('\n'))
  console.log(`\nvalidate: ${errors.length} error(s), ${problems.length - errors.length} warning(s)`)
  for (const p of problems) console.log(` ${p.severity.toUpperCase()} ${p.code}: ${p.message}`)
  if (errors.length) { console.log('NOT WRITTEN (errors)'); process.exitCode = 1; return }
  if (!write) { console.log('dry run: nothing written (use --write)'); return }
  if (wanted.length !== current.departments.length) console.log('departments backup:', saveDepartmentsToFile(file, backups, wanted))
  console.log('floor backup:', saveFloorToFile(file, backups, job.slice))
  const saved = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
  console.log('re-validate saved file:', validate(saved).filter((p) => p.severity === 'error').length, 'errors')
}
