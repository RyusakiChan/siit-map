import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tracePlugin } from './tools/trace-plugin.ts'

// GitHub Pages serves the site at https://<user>.github.io/siit-map/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/siit-map/' : '/',
  plugins: [react(), tracePlugin()],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: { port: 5173, strictPort: true },
  // Skip copies of the tests in Claude Code worktrees
  test: { environment: 'node', exclude: ['**/node_modules/**', '.claude/**'] },
}))
