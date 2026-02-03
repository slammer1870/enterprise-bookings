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
    pool: 'vmThreads', // so deps.transformCss can handle .css from deps like react-image-crop
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
