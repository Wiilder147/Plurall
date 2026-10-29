import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mismo alias que jsconfig.json ("@/*" → raíz de apps/web) para poder
// probar los route handlers reales importando sus dependencias.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
  },
})
