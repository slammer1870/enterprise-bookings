import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const e2eProfile = process.env.PW_E2E_PROFILE || (process.env.CI ? 'ci' : 'local')
const isCI = e2eProfile === 'ci'
const isLocal = e2eProfile === 'local'

export default defineConfig({
  testDir: './tests/e2e',
  // Default per-test timeout (ms). Local dev server can be slower on first compile.
  timeout: isCI ? 30000 : 60000,
  // Local runs are intended to be a fast smoke suite.
  ...(isLocal
    ? {
        testIgnore: [
          '**/booking-flow.e2e.spec.ts',
          '**/booking-functionality.e2e.spec.ts',
          '**/cancel-booking.e2e.spec.ts',
          '**/integration-edge-cases.e2e.spec.ts',
          '**/super-admin-access.e2e.spec.ts',
          '**/tenant-admin-access.e2e.spec.ts',
          '**/tenant-isolation.e2e.spec.ts',
          '**/tenant-onboarding.e2e.spec.ts',
          '**/tenant-scoped-page-slugs.e2e.spec.ts',
          '**/user-access-control.e2e.spec.ts',
          '**/cross-tenant-booking.e2e.spec.ts',
        ],
      }
    : {}),
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Enable parallel workers locally for faster test runs. Test data is worker-scoped. */
  workers: isCI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: isCI ? 'html' : 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: isCI ? 'on-first-retry' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: isCI
      ? 'pnpm exec payload migrate:fresh --force-accept-warning && pnpm dev:e2e'
      : 'pnpm dev:e2e',
    reuseExistingServer: !isCI,
    url: 'http://localhost:3000',
    timeout: isCI ? 120000 : 60000,
    env: {
      DATABASE_URI: process.env.DATABASE_URI || '',
      PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || '',
      NODE_ENV: 'development',
      ...(isCI ? { CI: 'true' } : {}),
      PW_E2E_PROFILE: e2eProfile,
      NODE_OPTIONS:
        '--no-deprecation --experimental-loader ./scripts/payload-auth-loader.mjs',
    },
  },
})
