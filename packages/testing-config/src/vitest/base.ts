import type { UserConfig } from 'vitest/config';

/**
 * Base vitest configuration shared across all packages
 */
export const baseVitestConfig: UserConfig = {
  test: {
    globals: true,
    setupFiles: [
      // @ts-expect-error - vitest resolves workspace package imports
      '@repo/testing-config/src/vitest/setup-file-polyfill.ts',
    ],
  },
};

