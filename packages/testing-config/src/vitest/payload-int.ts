import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config';

function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1';
}

export type PayloadIntConfigOptions = UserConfig & {
  rootDir?: string
  globalSetup?: string
}

/**
 * Vitest config for Payload CMS integration tests.
 * Self-contained entry (no cross-file imports) for monorepo vitest config loading.
 */
export function createPayloadIntConfig(
  options: PayloadIntConfigOptions = {},
): ReturnType<typeof defineConfig> {
  const {
    rootDir: _rootDir,
    globalSetup,
    test: testOptions,
    ...rest
  } = options;
  const ci = isCI();

  const baseVitestConfig: UserConfig = {
    test: {
      globals: true,
      server: {
        deps: {
          inline: ['@repo/testing-config', 'payload-auth'],
        },
      },
    },
  };

  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(testOptions?.setupFiles || []),
  ];

  return defineConfig(
    mergeConfig(baseVitestConfig, {
      plugins: [tsconfigPaths(), react(), ...(rest.plugins || [])],
      test: {
        environment: 'node',
        include: ['tests/int/**/*.int.spec.ts'],
        hookTimeout: 300_000,
        globalSetup,
        pool: 'forks',
        maxWorkers: ci ? 1 : 2,
        fileParallelism: !ci,
        teardownTimeout: 60_000,
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        poolOptions: {
          forks: {
            singleFork: false,
            isolate: true,
          },
        },
        server: {
          deps: {
            inline: ['payload-auth'],
          },
        },
        ...testOptions,
      },
      ssr: {
        noExternal: ['payload-auth'],
      },
      define: {
        global: 'globalThis',
      },
      ...rest,
    }),
  );
}
