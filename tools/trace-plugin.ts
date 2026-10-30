import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { BuildingData } from '../src/data/types.ts'
import { BACKUPS_KEPT, replaceFloor, type FloorSlice } from '../src/trace/saveFloor.ts'

const stamp = (d: Date) => d.toISOString().replace(/[:.]/g, '-')

/**
 * Replace one floor in the data file. A timestamped copy of the old file goes to `backupsDir`
 * first (the newest BACKUPS_KEPT are kept). Returns the backup's path.
 */
export function saveFloorToFile(file: string, backupsDir: string, slice: FloorSlice, now = new Date()): string {
  const current = JSON.parse(readFileSync(file, 'utf8')) as BuildingData
  const next = replaceFloor(current, slice) // throws before anything is written
  mkdirSync(backupsDir, { recursive: true })
  const backup = join(backupsDir, `building-${stamp(now)}.json`)
  writeFileSync(backup, readFileSync(file))
  const old = readdirSync(backupsDir).filter((f) => /^building-.*\.json$/.test(f)).sort()
  for (const f of old.slice(0, Math.max(0, old.length - BACKUPS_KEPT))) rmSync(join(backupsDir, f))
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n')
  renameSync(tmp, file)
  return backup
}

/** Dev-only: `vite serve` gets /__trace/data and /__trace/save; `vite build` gets nothing. */
export function tracePlugin(): Plugin {
  return {
    name: 'siit-trace',
    apply: 'serve',
    configureServer(server) {
      const file = resolve(server.config.root, 'src/data/building.json')
      const backups = resolve(server.config.root, '.trace-backups')
      server.middlewares.use('/__trace/data', (req, res) => {
        if (req.method !== 'GET' || !existsSync(file)) { res.statusCode = 405; res.end(); return }
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(readFileSync(file))
      })
      server.middlewares.use('/__trace/save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        // Only the dev page itself may write, never another site open in the same browser.
        const host = req.headers.host ?? ''
        const origin = req.headers.origin
        if (origin && new URL(origin).host !== host) { res.statusCode = 403; res.end('Wrong origin'); return }
        let body = ''
        req.on('data', (c) => { body += c; if (body.length > 20e6) req.destroy() })
        req.on('end', () => {
          res.setHeader('content-type', 'application/json')
          try {
            const slice = JSON.parse(body) as FloorSlice
            const backup = saveFloorToFile(file, backups, slice)
            res.end(JSON.stringify({ ok: true, backup: basename(backup) }))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
          }
        })
      })
    },
  }
}
