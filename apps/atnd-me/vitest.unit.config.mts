import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

/** Unit tests only – no DB, no globalSetup. Run with: pnpm test:unit */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
})
