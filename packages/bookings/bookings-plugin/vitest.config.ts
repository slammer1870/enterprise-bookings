import '@repo/testing-config/src/vitest/base';
import { createNodeConfig } from '@repo/testing-config/src/vitest/node';

export default createNodeConfig({
  test: {
    hookTimeout: 10_000_000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
