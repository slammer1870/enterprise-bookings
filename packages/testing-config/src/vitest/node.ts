import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';
// @ts-expect-error - TypeScript resolves .js to .ts in this monorepo
import { baseVitestConfig } from './base.js';

/**
 * Vitest configuration for Node.js environment tests
 * Use this for backend/API packages like auth, bookings, payments, memberships
 */
export function createNodeConfig(
  config: UserConfig = {},
): ReturnType<typeof defineConfig> {
  // Merge setupFiles arrays if they exist
  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(config.test?.setupFiles || []),
  ];

  return defineConfig(
    mergeConfig(baseVitestConfig, {
      test: {
        environment: 'node',
        hookTimeout: 100000,
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        ...config.test,
      },
      ...config,
    }),
  );
}

/**
 * Pre-configured Node.js environment config
 */
export const nodeVitestConfig = createNodeConfig();

