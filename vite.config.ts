import { defineConfig } from 'vitest/config'

// Poki serves a game from a sub-path, so every asset URL must be relative.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
