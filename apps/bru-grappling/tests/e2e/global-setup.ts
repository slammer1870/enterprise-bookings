import { type FullConfig } from '@playwright/test'

import { createDbString } from '@repo/testing-config/src/utils/db'

/**
 * Global setup for Playwright tests
 * Creates a test database container if DATABASE_URI is not already set
 */
async function globalSetup(config: FullConfig) {
  console.log('Running global setup...')

  // If DATABASE_URI is not set, create a test database container
  if (!process.env.FORCE_EXISTING_DB) {
    console.log('Existing database not forced, creating test database container...')
    try {
      const dbString = await createDbString()
      process.env.DATABASE_URI = dbString
      console.log('Test database container created successfully')
    } catch (error) {
      console.error('Failed to create test database container:', error)
      throw error
    }
  } else {
    console.log(
      'Using forced existing DATABASE_URI:',
      process.env.DATABASE_URI?.replace(/:[^:@]+@/, ':****@') ?? 'not set',
    )
  }

  // Note: Database migrations are handled by the webServer command
  // which runs: pnpm run payload migrate:fresh --force-accept-warning
  console.log('Global setup complete')
}

export default globalSetup
