import '@repo/testing-config/src/vitest/base';
import { createReactConfig } from '@repo/testing-config/src/vitest/react';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default createReactConfig({
  // @ts-expect-error - Version mismatch between vite/vitest types in monorepo causes plugin type incompatibility
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.tsx', '__tests__/**/*.test.ts'],
  },
});
