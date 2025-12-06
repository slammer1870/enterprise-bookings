import type { FullConfig } from '@playwright/test'
import { createDbString } from '@repo/testing-config/src/utils/db'

async function globalSetup(config: FullConfig) {
  console.log('Setting up test database...')
  
  // For e2e tests, always use a fresh TestContainer database to ensure clean state
  // This prevents issues with existing data from previous test runs or local development
  // Users can override this by setting FORCE_EXISTING_DB=true if they want to use their local DB
  if (process.env.FORCE_EXISTING_DB === 'true') {
    if (process.env.DATABASE_URI) {
      console.log('Using DATABASE_URI from environment (FORCE_EXISTING_DB=true):', process.env.DATABASE_URI.replace(/:[^:@]+@/, ':****@'))
    } else {
      throw new Error('FORCE_EXISTING_DB=true but DATABASE_URI is not set')
    }
  } else {
    // Always create a fresh TestContainer database for e2e tests
    console.log('Creating fresh TestContainer PostgreSQL database for e2e tests...')
    const dbString = await createDbString()
    process.env.DATABASE_URI = dbString
    console.log('✅ TestContainer database created:', dbString.replace(/:[^:@]+@/, ':****@'))
    console.log('💡 To use your local database instead, set FORCE_EXISTING_DB=true')
  }

  console.log('Database setup complete')
}

export default globalSetup

