import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isCI = process.env.CI === 'true' || process.env.CI === '1'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/payload.config': path.resolve(__dirname, 'src/payload.config.ts'),
    },
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./tests/int/global-setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    hookTimeout: 300000, // 5 minutes for database setup
    // forks: process isolation so Payload module graphs are not retained across files
    // (vmForks/singleFork accumulated ~4GB and OOM'd after ~70 suites in CI).
    pool: 'forks',
    maxWorkers: isCI ? 1 : 2,
    fileParallelism: !isCI,
    teardownTimeout: 60_000,
    poolOptions: {
      forks: {
        // Recycle the worker between files in CI so heap cannot climb across the shard.
        singleFork: false,
        isolate: true,
      },
    },
    server: {
      deps: {
        inline: ['payload-auth'],
      },
    },
  },
  ssr: {
    noExternal: ['payload-auth'],
  },
})
