import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 10000000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
