import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load .env from this package so test workers and webServer use the same DB (DATABASE_URI)
// when run from monorepo root (e.g. turbo) or from apps/atnd-me.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

import { defineConfig, devices } from '@playwright/test'

// Ensure all Playwright workers inherit these env flags.
// Payload's drizzle adapter will attempt schema push in-process unless this is set,
// which can collide with the already-migrated test DB (e.g. enum type already exists).
process.env.PW_E2E_PROFILE ??= 'true'
// Skip expensive default tenant data creation (class options, pages, lessons, etc.)
// during test setup to avoid timeouts.
process.env.PW_E2E_SKIP_DEFAULT_TENANT_DATA ??= 'true'

// Use production build for e2e tests (faster, more stable, cacheable by Turbo)
const useProductionBuild = process.env.E2E_USE_PROD !== 'false'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Production build can handle more workers, but cap at 2 for multi-tenant apps
  // (each worker creates 3 tenants × multiple Payload instances = high DB load)
  workers: useProductionBuild ? 2 : 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm start:e2e',
        url: 'http://localhost:3000/admin',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'production',
          NODE_OPTIONS: '--no-deprecation',
          ENABLE_TEST_WEBHOOKS: 'true', // Mock Stripe/create-payment-intent in e2e (avoid "No such destination" for placeholder accounts)
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers (see payload.config.ts)
          PW_E2E_SKIP_DEFAULT_TENANT_DATA: 'true', // Skip expensive default data creation in tests
          // Same DB as test workers so tenant/lesson data created in fixtures is visible to the app
          ...(process.env.DATABASE_URI && { DATABASE_URI: process.env.DATABASE_URI }),
          ...(process.env.PAYLOAD_SECRET && { PAYLOAD_SECRET: process.env.PAYLOAD_SECRET }),
        },
      }
    : {
        // Dev mode fallback: `next dev` (no build required, slower)
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev',
        url: 'http://localhost:3000/admin',
        timeout: 180000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'development',
          CI: 'true',
          NODE_OPTIONS: '--no-deprecation',
          ENABLE_TEST_MAGIC_LINKS: 'true',
          ENABLE_TEST_WEBHOOKS: 'true',
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers (see payload.config.ts)
          PW_E2E_SKIP_DEFAULT_TENANT_DATA: 'true', // Skip expensive default data creation in tests
          ...(process.env.DATABASE_URI && { DATABASE_URI: process.env.DATABASE_URI }),
          ...(process.env.PAYLOAD_SECRET && { PAYLOAD_SECRET: process.env.PAYLOAD_SECRET }),
        },
      },
})
