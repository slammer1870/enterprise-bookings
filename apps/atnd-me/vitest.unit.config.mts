import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Unit tests only – no DB, no globalSetup. Run with: pnpm test:unit */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 15_000,
    // Isolate files so vi.mock in one suite cannot replace modules for another.
    pool: 'forks',
    isolate: true,
    server: {
      deps: {
        inline: ['payload-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
  ssr: {
    noExternal: ['payload-auth'],
  },
})
