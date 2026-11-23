import { defineConfig } from 'vitest/config'

/**
 * VITE_DEMO=1 builds the public demo (GitHub Pages): no Poki SDK script, and rewarded videos
 * are granted by the stand-in so every feature can be tried. The Poki build is unchanged.
 */
const demo = process.env.VITE_DEMO === '1'

// Poki serves a game from a sub-path, so every asset URL must be relative.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  plugins: [
    {
      name: 'demo-without-poki-sdk',
      transformIndexHtml: (html) => (demo ? html.replace(/\s*<!-- Poki SDK[\s\S]*?poki-sdk\.js"><\/script>/, '') : html),
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
