import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 100000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
