import os from 'node:os'

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

export type SharedPlaywrightOptions = {
  testDir: string
  baseURL?: string
  globalSetup?: string
  globalTeardown?: string
  webServerCommand: string
  webServerUrl?: string
  webServerTimeoutMs?: number
  extraWebServerEnv?: Record<string, string>
  /** Override worker count (default CI=1). Use >1 for faster runs when tests use worker-scoped data. */
  workers?: number
  /** Override per-test timeout in ms (default CI=180000). Lower to fail fast and shorten total run. */
  timeout?: number
  /** Override retries (default CI=2). */
  retries?: number
  /** 
   * Use production build for e2e tests (default: true in CI, false locally).
   * Production build is faster, more stable, and cacheable by Turbo.
   * Set to false for debugging or when testing dev-only features.
   */
  useProductionBuild?: boolean
  /**
   * Command to start production server (default: 'pnpm start').
   * Used when useProductionBuild is true. Should include any test-specific env vars.
   */
  productionServerCommand?: string
}

/**
 * Shared Playwright config used across apps.
 * Apps provide paths/commands; we provide sensible CI-focused defaults.
 * 
 * **Production Build Strategy (Recommended):**
 * - Set `useProductionBuild: true` (default in CI)
 * - Tests run against `next start` after `turbo build`
 * - 3-4x faster, more stable, Turbo-cacheable
 * - Can use 2-4 workers (vs 1 in dev mode)
 * 
 * **Dev Mode (Debugging Only):**
 * - Set `useProductionBuild: false` or `E2E_USE_PROD=false`
 * - Tests run against `next dev`
 * - Slower, but useful for debugging
 */
export function createPlaywrightConfig(opts: SharedPlaywrightOptions): PlaywrightTestConfig {
  const baseURL = opts.baseURL ?? 'http://localhost:3000'
  
  // Production build strategy: default to true in CI, false locally (unless explicitly set)
  const useProductionBuild = opts.useProductionBuild ?? (process.env.E2E_USE_PROD !== 'false' && !!process.env.CI)
  
  // Production mode can handle more workers; dev mode needs 1 (multi-tenant apps may need even less)
  const defaultWorkers = useProductionBuild ? (process.env.CI ? 3 : 4) : 1
  const workers = opts.workers !== undefined ? opts.workers : defaultWorkers

  return defineConfig({
    testDir: opts.testDir,
    forbidOnly: !!process.env.CI,
    retries: opts.retries ?? (process.env.CI ? 1 : 0),
    workers,
    timeout: opts.timeout ?? (process.env.CI ? 60000 : 60000),
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
    expect: {
      timeout: process.env.CI ? 10000 : 5000,
    },
    globalSetup: opts.globalSetup,
    globalTeardown: opts.globalTeardown,
    use: {
      baseURL,
      actionTimeout: 30000,
      navigationTimeout: 60000,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: useProductionBuild
      ? {
          // Production mode: next start (requires build first via turbo)
          command: opts.productionServerCommand ?? 'pnpm start',
          url: opts.webServerUrl ?? `${baseURL}/api/health`,
          timeout: opts.webServerTimeoutMs ?? 120000,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...(process.env.DATABASE_URI ? { DATABASE_URI: process.env.DATABASE_URI } : {}),
            NODE_ENV: 'production',
            NODE_OPTIONS: '--no-deprecation',
            ...(opts.extraWebServerEnv ?? {}),
          },
        }
      : {
          // Dev mode: next dev (no build required, slower)
          command: opts.webServerCommand,
          url: opts.webServerUrl ?? `${baseURL}/api/health`,
          timeout: opts.webServerTimeoutMs ?? 180000,
          reuseExistingServer: !process.env.CI,
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            ...(process.env.DATABASE_URI ? { DATABASE_URI: process.env.DATABASE_URI } : {}),
            NODE_ENV: 'development',
            CI: 'true',
            NODE_OPTIONS: '--no-deprecation',
            ...(opts.extraWebServerEnv ?? {}),
          },
        },
  })
}




