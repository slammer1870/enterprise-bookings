import { createNodeConfig } from '@repo/testing-config/src/vitest/node';

export default createNodeConfig({
  test: {
    hookTimeout: 1_000_000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
