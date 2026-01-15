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
}

/**
 * Shared Playwright config used across apps.
 * Apps provide paths/commands; we provide sensible CI-focused defaults.
 */
export function createPlaywrightConfig(opts: SharedPlaywrightOptions): PlaywrightTestConfig {
  const baseURL = opts.baseURL ?? 'http://localhost:3000'

  return defineConfig({
    testDir: opts.testDir,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // E2E tests share a single webServer + DB; run serially in CI to avoid flaky "first user" races.
    workers: process.env.CI ? 1 : undefined,
    //reporter: process.env.CI ? 'dot' : 'html',
    timeout: process.env.CI ? 180000 : 100000,
    expect: {
      timeout: process.env.CI ? 10000 : 5000,
    },
    globalSetup: opts.globalSetup,
    globalTeardown: opts.globalTeardown,
    use: {
      baseURL,
      actionTimeout: process.env.CI ? 30000 : 10000,
      navigationTimeout: process.env.CI ? 120000 : 20000,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: opts.webServerCommand,
      url: opts.webServerUrl ?? `${baseURL}/api/health`,
      timeout: opts.webServerTimeoutMs ?? 180000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Inherit DATABASE_URI from parent process (set by globalSetup via testcontainers).
        // This is critical for the webServer to use the same database as the tests.
        ...(process.env.DATABASE_URI ? { DATABASE_URI: process.env.DATABASE_URI } : {}),
        // Run Next.js in dev mode (required by many app-router behaviors and Payload admin).
        // We still force Payload's "CI/test" behaviors via CI=true + explicit ENABLE_TEST_* flags.
        NODE_ENV: 'development',
        CI: 'true',
        NODE_OPTIONS: '--no-deprecation',
        ...(opts.extraWebServerEnv ?? {}),
      },
    },
  })
}




