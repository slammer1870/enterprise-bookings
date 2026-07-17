import { createPayloadIntConfig } from '@repo/testing-config/src/vitest/payload-int';

export default createPayloadIntConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});
