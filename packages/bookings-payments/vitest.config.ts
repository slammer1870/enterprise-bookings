import '@repo/testing-config/src/vitest/base';
import { createForksNodeConfig } from '@repo/testing-config/src/vitest/node';

export default createForksNodeConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 180_000,
  },
});
