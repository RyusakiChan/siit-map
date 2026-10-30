import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { tracePlugin } from './tools/trace-plugin.ts'

/**
 * Paints the building outline from the very first HTML (no script needed) and removes it once the app's own
 * placeholder has taken over. The outline comes straight from building.json, so it can never drift from the map.
 */
function bootOutline(): Plugin {
  return {
    name: 'boot-outline',
    transformIndexHtml(html) {
      const data = JSON.parse(readFileSync(new URL('./src/data/building.json', import.meta.url), 'utf8')) as { building: { outline: [number, number][] } }
      const o = data.building.outline
      const xs = o.map((p) => p[0])
      const zs = o.map((p) => p[1])
      const pad = 2
      const x = Math.min(...xs) - pad
      const z = Math.min(...zs) - pad
      const w = Math.max(...xs) - Math.min(...xs) + 2 * pad
      const h = Math.max(...zs) - Math.min(...zs) + 2 * pad
      const pts = o.map(([px, pz]) => `${px},${pz}`).join(' ')
      const css = `html{background:linear-gradient(180deg,#f7eff6,#ece5ef) no-repeat}#boot{position:fixed;inset:0;padding:158px 62px 104px 16px;font:14px system-ui,sans-serif;color:#594c5b}#boot svg{display:block;width:100%;height:100%}#boot p{position:absolute;left:0;right:0;bottom:112px;margin:0;text-align:center}`
      const boot = `<div id="boot" aria-hidden="true"><svg viewBox="${x} ${z} ${w} ${h}" preserveAspectRatio="xMidYMid meet"><polygon points="${pts}" fill="#fbf8fb" stroke="#bfb2c2" stroke-width="0.6" stroke-linejoin="round"/></svg><p id="boot-text">Loading the map…</p></div>` +
        `<script>try{if(localStorage.getItem('siit-map.lang')==='th')document.getElementById('boot-text').textContent='กำลังโหลดแผนที่…'}catch(e){}</script>`
      return html.replace('</head>', `  <style>${css}</style>
  </head>`).replace('<div id="root"></div>', `${boot}
    <div id="root"></div>`)
    },
  }
}

/** Adds modulepreload links for the 3D scene chunk and what it needs, so they download beside the main script. */
function preloadScene(): Plugin {
  return {
    name: 'preload-scene',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        const scene = Object.values(bundle).find((c) => c.type === 'chunk' && c.name === 'BuildingScene')
        if (!scene || scene.type !== 'chunk') return html
        const base = ctx.server ? '/' : '/siit-map/'
        const files = [scene.fileName, ...scene.imports.filter((f) => bundle[f]?.type === 'chunk' && !bundle[f].isEntry)]
        const links = files.map((f) => `    <link rel="modulepreload" crossorigin href="${base}${f}" />
`).join('')
        return html.replace('</head>', `${links}  </head>`)
      },
    },
  }
}

// GitHub Pages serves the site at https://<user>.github.io/siit-map/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/siit-map/' : '/',
  plugins: [react(), tracePlugin(), bootOutline(), preloadScene()],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: { port: 5173, strictPort: true },
  // Skip copies of the tests in Claude Code worktrees
  test: { environment: 'node', exclude: ['**/node_modules/**', '.claude/**'] },
}))
