import { execSync } from 'child_process'
// Vitest `setupFiles` run after `globalSetup`, but our global setup needs env vars
// (like DATABASE_URI) to decide whether to start a container.
import 'dotenv/config'
import { createDbString } from '@repo/testing-config/src/utils/db'

/**
 * Global setup for Vitest integration tests
 * - If DATABASE_URI is not set: creates a test Postgres container, sets DATABASE_URI, then runs
 *   `payload migrate:fresh` so the schema exists before tests.
 * - If DATABASE_URI is set with FORCE_EXISTING_DB (CI): assumes the workflow restored a migrated
 *   dump; if core tables are missing, runs migrate:fresh as a self-heal.
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
  // pre-set by a workflow, the workflow runs migrate:fresh before test:int, so we skip here —
  // unless the restored DB is empty (missing core tables), in which case self-heal.
  let shouldRunMigrations =
    Boolean(process.env.DATABASE_URI) &&
    (weCreatedDb || process.env.FORCE_EXISTING_DB !== 'true')

  if (!shouldRunMigrations && process.env.DATABASE_URI && process.env.FORCE_EXISTING_DB === 'true') {
    const schemaOk = await probeCoreTablesExist(process.env.DATABASE_URI)
    if (!schemaOk) {
      console.warn(
        '[Vitest Global Setup] FORCE_EXISTING_DB set but core tables missing — running migrate:fresh',
      )
      shouldRunMigrations = true
    } else if (process.env.CI && !weCreatedDb) {
      console.log(
        '[Vitest Global Setup] CI with existing DATABASE_URI: migrations handled by workflow',
      )
    }
  }

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
  }

  console.log('[Vitest Global Setup] Complete')
}

/** True when public.tenants and public.users both exist (restored CI dump is usable). */
async function probeCoreTablesExist(databaseUri: string): Promise<boolean> {
  try {
    // Dynamic import keeps global-setup light when migrations always run locally.
    const pg = await import('pg')
    const Client = pg.Client ?? pg.default?.Client
    if (!Client) return false
    const client = new Client({ connectionString: databaseUri })
    await client.connect()
    try {
      const result = await client.query<{ tenants: string | null; users: string | null }>(
        `SELECT to_regclass('public.tenants')::text AS tenants,
                to_regclass('public.users')::text AS users`,
      )
      const row = result.rows[0]
      return Boolean(row?.tenants && row?.users)
    } finally {
      await client.end().catch(() => undefined)
    }
  } catch (err) {
    console.warn('[Vitest Global Setup] Schema probe failed:', err)
    return false
  }
}

export default globalSetup
