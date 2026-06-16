import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load .env from this package so test workers and webServer use the same DB (DATABASE_URI)
// when run from monorepo root (e.g. turbo) or from apps/atnd-me.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env') })

// payload-auth uses directory imports that Node ESM rejects; this import hook registers a resolver.
const payloadAuthRegister = path.resolve(__dirname, 'scripts/register-payload-auth-loader.mjs')
const nodeOptionsWithLoader = `--no-deprecation --import ${payloadAuthRegister}`

import { defineConfig, devices } from '@playwright/test'

// Ensure all Playwright workers inherit these env flags.
// Payload's drizzle adapter will attempt schema push in-process unless this is set,
// which can collide with the already-migrated test DB (e.g. enum type already exists).
process.env.PW_E2E_PROFILE ??= 'true'
// Skip expensive default tenant data creation (class options, pages, timeslots, etc.)
// during test setup to avoid timeouts.
process.env.PW_E2E_SKIP_DEFAULT_TENANT_DATA ??= 'true'
// Ensure Playwright workers use the same Stripe test-mode shortcuts as the web server.
process.env.ENABLE_TEST_WEBHOOKS ??= 'true'
process.env.ENABLE_TEST_MAGIC_LINKS ??= 'true'

// Use production build for e2e tests (faster, more stable, cacheable by Turbo)
const useProductionBuild = process.env.E2E_USE_PROD !== 'false'

const truthyEnv = (v: string | undefined) =>
  ['1', 'true', 'yes'].includes((v ?? '').toLowerCase())

/** When set (e.g. CI after `payload migrate:fresh`), webServer only starts the app — no second migrate in the same shell. */
const skipWebserverMigrate = truthyEnv(process.env.PW_E2E_SKIP_WEBSERVER_MIGRATE)

/**
 * Local dev: PW_E2E_FAST=1 tightens timeouts so failures surface sooner.
 * Combine with PW_E2E_BAIL=1 (or `pnpm test:e2e:fast`) to stop after the first failure.
 * CI is unchanged unless these env vars are set explicitly.
 */
const fastE2E = truthyEnv(process.env.PW_E2E_FAST)
const bailE2E = truthyEnv(process.env.PW_E2E_BAIL)

function resolveWorkers(): number {
  const fromEnv = process.env.PW_E2E_WORKERS
  if (fromEnv !== undefined && fromEnv !== '') {
    const n = parseInt(fromEnv, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  // Default to a single worker for stability/memory usage.
  // Full-suite e2e is heavy (admin flows + Payload), and parallel workers can OOM during
  // production `next build` + Playwright execution.
  return 1
}

const prodWebCommand = skipWebserverMigrate
  ? 'pnpm start:e2e'
  : 'pnpm run payload migrate:fresh --force-accept-warning && pnpm start:e2e'

const devWebCommand = skipWebserverMigrate
  ? 'pnpm dev:e2e'
  : 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev:e2e'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: fastE2E ? 0 : process.env.CI ? 1 : 0,
  maxFailures: bailE2E ? 1 : undefined,
  // Override with PW_E2E_WORKERS=1 if multi-worker runs flake on shared DB state.
  workers: resolveWorkers(),
  timeout: fastE2E ? 35_000 : 60_000,
  // Console-first output (no HTML report).
  reporter: [['list']],
  expect: {
    timeout: fastE2E ? 8_000 : 15_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: fastE2E ? 10_000 : 30_000,
    navigationTimeout: fastE2E ? 20_000 : 60_000,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useProductionBuild
    ? {
        // Production mode: reuse the existing build, then launch it.
        command: prodWebCommand,
        url: 'http://localhost:3000/admin',
        // Building the standalone app can exceed 2 minutes on cold or uncached runs.
        timeout: 600000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'production',
          NODE_OPTIONS: nodeOptionsWithLoader,
          ENABLE_TEST_WEBHOOKS: 'true', // Mock Stripe/create-payment-intent in e2e (avoid "No such destination" for placeholder accounts)
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers (see payload.config.ts)
          PW_E2E_SKIP_DEFAULT_TENANT_DATA: 'true', // Skip expensive default data creation in tests
          // Same DB as test workers so tenant/lesson data created in fixtures is visible to the app
          ...(process.env.DATABASE_URI && { DATABASE_URI: process.env.DATABASE_URI }),
          ...(process.env.PAYLOAD_SECRET && { PAYLOAD_SECRET: process.env.PAYLOAD_SECRET }),
        },
      }
    : {
        // Dev mode fallback: `next dev` with payload-auth loader (no build required, slower)
        command: devWebCommand,
        url: 'http://localhost:3000/admin',
        // Admin route compilation can be slow on fresh builds / CI
        timeout: 600000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'development',
          CI: 'true',
          NODE_OPTIONS: nodeOptionsWithLoader,
          ENABLE_TEST_MAGIC_LINKS: 'true',
          ENABLE_TEST_WEBHOOKS: 'true',
          PW_E2E_PROFILE: 'true', // Disables schema push in test workers (see payload.config.ts)
          PW_E2E_SKIP_DEFAULT_TENANT_DATA: 'true', // Skip expensive default data creation in tests
          ...(process.env.DATABASE_URI && { DATABASE_URI: process.env.DATABASE_URI }),
          ...(process.env.PAYLOAD_SECRET && { PAYLOAD_SECRET: process.env.PAYLOAD_SECRET }),
        },
      },
})
