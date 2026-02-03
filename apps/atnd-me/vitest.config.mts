import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
  resolve: {
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
  ssr: {
    noExternal: ['payload-auth'],
  },
})
