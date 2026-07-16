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
    // vmForks: CSS transform (react-image-crop) like vmThreads, but avoids tinypool
    // "Failed to terminate worker" flakes that exit 1 after all tests passed.
    pool: 'vmForks',
    // CI runners (~7GB) OOM when multiple Payload int suites fork in parallel against one DB.
    // Serialize in CI; keep a small local cap so laptop runs don't thrash either.
    maxWorkers: isCI ? 1 : 2,
    fileParallelism: !isCI,
    teardownTimeout: 60_000,
    poolOptions: {
      vmForks: {
        singleFork: isCI,
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
