import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';
import { baseVitestConfig } from './base.js';

/**
 * Vitest configuration for Node.js environment with React plugins
 * Use this for packages that need React support but run in Node.js environment
 */
export function createNodeWithReactConfig(
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
        environment: 'node',
        hookTimeout: 100000,
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        ...config.test,
      },
      define: {
        global: 'globalThis',
      },
      resolve: {
        alias: {
          crypto: 'crypto',
        },
      },
      ...config,
    }),
  );
}

/**
 * Pre-configured Node.js with React plugins config
 */
export const nodeWithReactVitestConfig = createNodeWithReactConfig();

