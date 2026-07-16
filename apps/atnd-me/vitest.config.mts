import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    teardownTimeout: 30_000,
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
