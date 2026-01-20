import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    server: {
      deps: {
        inline: ['payload-auth'],
      },
    },
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'browser', 'default'],
  },
  ssr: {
    noExternal: ['payload-auth'],
  },
});
