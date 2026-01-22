import { createDbString } from '../utils/db.js'

/**
 * Global setup for Playwright tests
 * Creates a test database container if DATABASE_URI is not already set.
 * Note: Do not kill port 3000 here—Playwright starts the webServer before setup runs.
 */
export async function globalSetup(_config: unknown) {
  console.log('Running global setup...')

  // Prefer an explicit DATABASE_URI (e.g. from app `.env`) to avoid requiring Docker
  // for local runs / CI environments where Testcontainers isn't available.
  if (process.env.DATABASE_URI) {
    console.log(
      'Using existing DATABASE_URI:',
      process.env.DATABASE_URI?.replace(/:[^:@]+@/, ':****@') ?? 'not set',
    )
  } else if (!process.env.FORCE_EXISTING_DB) {
    console.log('DATABASE_URI not set; creating test database container...')
    const dbString = await createDbString()
    process.env.DATABASE_URI = dbString
    console.log('Test database container created successfully')
  } else {
    console.log(
      'Using forced existing DATABASE_URI:',
      process.env.DATABASE_URI?.replace(/:[^:@]+@/, ':****@') ?? 'not set',
    )
  }

  console.log('Global setup complete')
}

export default globalSetup


