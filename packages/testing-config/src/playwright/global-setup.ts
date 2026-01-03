import { createDbString } from '../utils/db.js'

/**
 * Global setup for Playwright tests
 * Creates a test database container if DATABASE_URI is not already set.
 */
export async function globalSetup(_config: unknown) {
  console.log('Running global setup...')

  if (!process.env.FORCE_EXISTING_DB) {
    console.log('Existing database not forced, creating test database container...')
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


