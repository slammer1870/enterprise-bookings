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
    // Reduce workers in CI to avoid resource contention with slow Next.js dev server
    workers: process.env.CI ? Math.min(2, Math.ceil(os.cpus().length * 0.25)) : undefined,
    reporter: process.env.CI ? 'dot' : 'html',
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
        NODE_ENV: 'test',
        CI: process.env.CI || 'false',
        NODE_OPTIONS: '--no-deprecation',
        ...(opts.extraWebServerEnv ?? {}),
      },
    },
  })
}




