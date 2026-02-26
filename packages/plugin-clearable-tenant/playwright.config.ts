import { defineConfig, devices } from '@playwright/test'

// Use 127.0.0.1 so readiness check and test API calls use IPv4 (avoids ::1 connection refused on macOS)
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
if (!process.env.BASE_URL) process.env.BASE_URL = baseURL

// Cursor sets CI=1 in many local sessions; make server startup explicit.
const shouldStartServer = process.env.PW_START_SERVER === '1'

/**
 * E2E tests for the clearable tenant selector plugin.
 * Uses the plugin dev app (seed: admin@test.com / password, 2 tenants).
 *
 * Local: Start the dev server first, then run tests:
 *   pnpm dev          (in this package, leave running)
 *   pnpm test:e2e     (in another terminal)
 *
 * CI: set PW_START_SERVER=1 to start the dev server automatically.
 */
export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(shouldStartServer && {
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  }),
})
