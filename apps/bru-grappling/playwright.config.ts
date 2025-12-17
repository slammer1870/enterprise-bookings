import { defineConfig, devices } from '@playwright/test'
import os from 'os'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests in parallel - use 50% of CPU cores, but max 4 workers */
  workers: process.env.CI ? Math.min(4, Math.ceil(os.cpus().length * 0.5)) : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'dot' : 'html',
  // Allow more breathing room on CI where the Next dev server recompiles slowly
  timeout: process.env.CI ? 180000 : 100000,
  /* Global timeout for expect assertions - reduced from 10s */
  expect: {
    timeout: 5000, // 5 seconds for assertions
  },
  /* Global setup to create TestContainer database */
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Relax timeouts on CI where page transitions are slower */
    actionTimeout: process.env.CI ? 20000 : 10000,
    navigationTimeout: process.env.CI ? 60000 : 20000,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Use faster load strategy */
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev',
    url: 'http://localhost:3000/api/health', // Use simple health check endpoint
    timeout: 180000, // 3 minutes for server startup (migrations may take time)
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
      CI: process.env.CI || 'false',
      NODE_OPTIONS: '--no-deprecation',
      ENABLE_TEST_MAGIC_LINKS: 'true',
      // DATABASE_URI will be set by globalSetup before webServer starts
      // Playwright will automatically pass it to the webServer process
    },
  },
})
