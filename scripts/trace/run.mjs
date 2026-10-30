// Usage: node scripts/trace/run.mjs floor3 [--write]
// Bundles scripts/trace/<name>.job.ts with esbuild (the repo's TypeScript uses extensionless imports) and runs it.
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const [name, ...flags] = process.argv.slice(2)
if (!name) throw new Error('usage: node scripts/trace/run.mjs <floor3|floor2|floor4> [--write]')
const out = resolve('node_modules/.cache/trace', `${name}.mjs`)
mkdirSync(resolve('node_modules/.cache/trace'), { recursive: true })
await build({
  entryPoints: [resolve('scripts/trace', `${name}.job.ts`)],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
  external: ['polygon-clipping'],
})
const mod = await import(pathToFileURL(out).href)
mod.main(flags.includes('--write'))
