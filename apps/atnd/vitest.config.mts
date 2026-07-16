import '@repo/testing-config/src/vitest/base';
import { createNodeWithReactConfig } from '@repo/testing-config/src/vitest/node-with-react';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default createNodeWithReactConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    environment: 'jsdom',
  },
});
