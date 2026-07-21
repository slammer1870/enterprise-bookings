import os from 'node:os'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig, mergeConfig, type UserConfig } from 'vitest/config'

function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1'
}

/** Avoid Tinypool RangeError when cpus() is 0 (some sandboxes) or min > max. */
function resolveWorkerCount(ci: boolean): number {
  const cpuCount = Math.max(1, os.cpus()?.length || 1)
  if (ci) return 1
  return Math.min(2, cpuCount)
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
  } = options
  const ci = isCI()
  const workers = resolveWorkerCount(ci)

  const baseVitestConfig: UserConfig = {
    test: {
      globals: true,
      server: {
        deps: {
          inline: ['@repo/testing-config', 'payload-auth'],
        },
      },
    },
  }

  const mergedSetupFiles = [
    ...(baseVitestConfig.test?.setupFiles || []),
    ...(testOptions?.setupFiles || []),
  ]

  return defineConfig(
    mergeConfig(baseVitestConfig, {
      plugins: [tsconfigPaths(), react(), ...(rest.plugins || [])],
      test: {
        // Caller test options first…
        ...testOptions,
        environment: 'node',
        include: testOptions?.include ?? ['tests/int/**/*.int.spec.ts'],
        hookTimeout: testOptions?.hookTimeout ?? 300_000,
        globalSetup: globalSetup ?? testOptions?.globalSetup,
        teardownTimeout: testOptions?.teardownTimeout ?? 60_000,
        setupFiles: mergedSetupFiles.length > 0 ? mergedSetupFiles : undefined,
        // …then pin pool settings so local + CI never hit minThreads > maxThreads.
        pool: 'forks',
        minWorkers: 1,
        maxWorkers: workers,
        fileParallelism: workers > 1,
        poolOptions: {
          forks: {
            singleFork: workers === 1,
            isolate: true,
            minForks: 1,
            maxForks: workers,
          },
        },
        server: {
          deps: {
            inline: ['payload-auth'],
            ...((testOptions?.server as { deps?: Record<string, unknown> } | undefined)?.deps ||
              {}),
          },
        },
      },
      ssr: {
        noExternal: ['payload-auth'],
      },
      define: {
        global: 'globalThis',
      },
      ...rest,
    }),
  )
}
