import { createNodeConfig } from '@repo/testing-config/src/vitest/node';
import { resolve } from 'node:path';

export default createNodeConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
});
