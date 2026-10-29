// Fails the build when anything from the dev-only trace editor ended up in dist/.
// Run by `npm run build` after `vite build`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Text that only the trace editor contains. */
export const MARKERS = ['__trace/save', '__trace/data', 'siit-trace', 'src/trace/']
const BAD_NAMES = /(^|[\/])trace[^\/]*\.html$/i

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

/** Paths (relative to `dist`) that should not be there, each with the reason. */
export function findShipped(dist) {
  if (!existsSync(dist)) return [{ file: dist, reason: 'folder does not exist' }]
  const found = []
  for (const file of walk(dist)) {
    const rel = relative(dist, file)
    if (BAD_NAMES.test(rel)) { found.push({ file: rel, reason: 'trace page file' }); continue }
    if (!/\.(js|mjs|css|html|json|map|webmanifest|txt)$/i.test(rel)) continue
    const text = readFileSync(file, 'utf8')
    const hit = MARKERS.find((m) => text.includes(m))
    if (hit) found.push({ file: rel, reason: `contains "${hit}"` })
  }
  return found
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? 'dist')
  const found = findShipped(dist)
  if (found.length) {
    console.error('The trace editor must not ship, but dist/ contains:')
    for (const f of found) console.error(`  ${f.file}: ${f.reason}`)
    process.exit(1)
  }
  console.log('check-not-shipped: dist/ has nothing from the trace editor.')
}
