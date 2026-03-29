import { execSync } from 'child_process'
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
  if (weCreatedDb && process.env.DATABASE_URI) {
    console.log('[Vitest Global Setup] Running payload migrate:fresh on new test DB...')
    try {
      execSync('pnpm exec payload migrate:fresh --force-accept-warning', {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
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
