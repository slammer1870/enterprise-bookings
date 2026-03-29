/* eslint-disable turbo/no-undeclared-env-vars */
import { createDbString } from '../utils/db.js'

/**
 * Global setup for Playwright tests
 * - If DATABASE_URI is already set (e.g. CI): use it; do not create a new container.
 * - If FORCE_EXISTING_DB is set: use existing DATABASE_URI (log and exit).
 * - Otherwise: create a test database container and set DATABASE_URI.
 */
export async function globalSetup(_config: unknown) {
  console.log('Running global setup...')

  if (process.env.DATABASE_URI) {
    console.log(
      'Using existing DATABASE_URI:',
      process.env.DATABASE_URI.replace(/:[^:@]+@/, ':****@'),
    )
  } else if (process.env.FORCE_EXISTING_DB) {
    console.log('FORCE_EXISTING_DB set but DATABASE_URI not set; skipping container creation.')
  } else {
    console.log('DATABASE_URI not set, creating test database container...')
    const dbString = await createDbString()
    process.env.DATABASE_URI = dbString
    console.log('Test database container created successfully')
  }

  console.log('Global setup complete')
}

export default globalSetup


