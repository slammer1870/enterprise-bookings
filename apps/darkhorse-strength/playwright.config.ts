import 'dotenv/config'

import { defineConfig, devices } from '@playwright/test'

// Ensure all Playwright workers inherit this env flag.
// Payload's drizzle adapter will attempt schema push in-process unless this is set,
// which can collide with the already-migrated test DB (e.g. enum type already exists).
process.env.PW_E2E_PROFILE ??= 'true'

// Use production build for e2e tests (faster, more stable, cacheable by Turbo)
const useProductionBuild = process.env.E2E_USE_PROD !== 'false'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Production build can handle more workers; dev mode needs 1
  workers: useProductionBuild ? (process.env.CI ? 1 : 2) : 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:3000',
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
        // Production mode: `next start` (requires build first)
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm start',
        url: 'http://localhost:3000/api/health',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'production',
          NODE_OPTIONS: '--no-deprecation',
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers
          ENABLE_TEST_WEBHOOKS: 'true',
        },
      }
    : {
        // Dev mode fallback: `next dev` (no build required, slower)
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev',
        url: 'http://localhost:3000/api/health',
        timeout: 180000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'development',
          CI: 'true',
          NODE_OPTIONS: '--no-deprecation',
          ENABLE_TEST_WEBHOOKS: 'true',
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers
        },
      },
})





