import { execSync } from 'child_process'
// Vitest `setupFiles` run after `globalSetup`, but our global setup needs env vars
// (like DATABASE_URI) to decide whether to start a container.
import 'dotenv/config'
import { createDbString } from '@repo/testing-config/src/utils/db'

/**
 * Global setup for Vitest integration tests
 * - If DATABASE_URI is not set: creates a test Postgres container, sets DATABASE_URI, then runs
 *   `payload migrate:fresh` so the schema exists before tests.
 * - If DATABASE_URI is set (e.g. CI workflow or FORCE_EXISTING_DB): assumes the DB is already
 *   migrated (workflow runs migrate:fresh before test:int).
 */
export async function globalSetup() {
  console.log('[Vitest Global Setup] Starting...')

  // Integration tests run in offline/sandboxed environments.
  // Disable cloud storage (R2/S3) for Media uploads so tests don't attempt
  // network calls (which can fail with `fetch failed` from the AWS SDK).
  if (process.env.NODE_ENV === 'test') {
    for (const k of [
      'R2_WORKER_URL',
      'R2_WORKER_SECRET',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_URL',
      'R2_ACCESS_KEY_ID',
      'R2_ACCOUNT_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_USE_DEFAULT_CLIENT',
    ]) {
      delete process.env[k]
    }
  }

  if (!process.env.PAYLOAD_SECRET) {
    process.env.PAYLOAD_SECRET = 'test-secret-key-for-ci-builds-only'
  }

  let weCreatedDb = false
  if (!process.env.DATABASE_URI && !process.env.FORCE_EXISTING_DB) {
    console.log('[Vitest Global Setup] DATABASE_URI not set, creating test database container...')
    try {
      const dbString = await createDbString()
      ;(process.env as any).DATABASE_URI = dbString
      weCreatedDb = true
      console.log('[Vitest Global Setup] Test database container created successfully')
    } catch (error) {
      console.error('[Vitest Global Setup] Failed to create test container:', error)
      throw error
    }
  } else {
    console.log(
      '[Vitest Global Setup] Using existing DATABASE_URI:',
      process.env.DATABASE_URI?.replace(/:[^:@]+@/, ':****@') ?? 'not set',
    )
  }

  // If we created the container, we must run migrations (CI or not). When DATABASE_URI is
  // pre-set by a workflow, the workflow runs migrate:fresh before test:int, so we skip here.
  const shouldRunMigrations =
    Boolean(process.env.DATABASE_URI) &&
    (weCreatedDb || process.env.FORCE_EXISTING_DB !== 'true')

  if (shouldRunMigrations) {
    console.log('[Vitest Global Setup] Running payload migrate:fresh on new test DB...')
    const payloadAuthLoaderImport = '--import ./scripts/register-payload-auth-loader.mjs'
    const currentNodeOptions = process.env.NODE_OPTIONS ?? ''
    const nodeOpts = [
      currentNodeOptions,
      '--no-deprecation',
      currentNodeOptions.includes(payloadAuthLoaderImport) ? '' : payloadAuthLoaderImport,
    ]
      .filter(Boolean)
      .join(' ')
    try {
      execSync('pnpm exec payload migrate:fresh --force-accept-warning', {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: nodeOpts },
        stdio: 'inherit',
      })
      console.log('[Vitest Global Setup] Migrations completed')
    } catch (error) {
      console.error('[Vitest Global Setup] migrate:fresh failed:', error)
      throw error
    }
  } else if (process.env.CI && !weCreatedDb) {
    console.log('[Vitest Global Setup] CI with existing DATABASE_URI: migrations handled by workflow')
  }

  console.log('[Vitest Global Setup] Complete')
}

export default globalSetup
