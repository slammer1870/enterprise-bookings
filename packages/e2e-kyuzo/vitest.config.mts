import { createNodeWithReactConfig } from '@repo/testing-config/src/vitest/node-with-react';

export default createNodeWithReactConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
});
