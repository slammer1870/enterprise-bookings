import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';
import { baseVitestConfig } from './base.js';

/**
 * Vitest configuration for React/JSdom environment tests
 * Use this for frontend/app packages that need React testing
 */
export function createReactConfig(
  config: UserConfig = {},
): ReturnType<typeof defineConfig> {
  // Merge setupFiles arrays if they exist
  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(config.test?.setupFiles || []),
  ];

  return defineConfig(
    mergeConfig(baseVitestConfig, {
      plugins: [tsconfigPaths(), react(), ...(config.plugins || [])],
      test: {
        environment: 'jsdom',
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        ...config.test,
      },
      ...config,
    }),
  );
}

/**
 * Pre-configured React/JSdom environment config
 */
export const reactVitestConfig = createReactConfig();

