import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site at https://<user>.github.io/siit-map/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/siit-map/' : '/',
  plugins: [react()],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: { port: 5173, strictPort: true },
  test: { environment: 'node' },
}))
