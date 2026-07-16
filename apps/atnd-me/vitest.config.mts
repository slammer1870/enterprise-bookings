import path from 'path'
import { fileURLToPath } from 'url'
import { createPayloadIntConfig } from '@repo/testing-config/src/vitest/payload-int'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default createPayloadIntConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/payload.config': path.resolve(__dirname, 'src/payload.config.ts'),
    },
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./tests/int/global-setup.ts'],
  },
})
