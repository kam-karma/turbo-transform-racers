import { defineConfig } from 'vitest/config'

// `npm run ghosts`: drives every Kupa Pilotu around each track and writes public/ghosts/*.json.
export default defineConfig({ test: { environment: 'node', include: ['tools/make-ghosts.gen.ts'], testTimeout: 600000 } })
