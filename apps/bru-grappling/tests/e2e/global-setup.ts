import type { FullConfig } from '@playwright/test'
import { createDbString } from '@repo/testing-config/src/utils/db'

async function globalSetup(config: FullConfig) {
  console.log('Setting up test database...')
  
  // Create TestContainer database if DATABASE_URI is not already set
  if (!process.env.DATABASE_URI) {
    console.log('Creating fresh TestContainer PostgreSQL database...')
    const dbString = await createDbString()
    process.env.DATABASE_URI = dbString
    console.log('✅ TestContainer database created:', dbString.replace(/:[^:@]+@/, ':****@'))
  } else {
    console.log('Using DATABASE_URI from environment:', process.env.DATABASE_URI.replace(/:[^:@]+@/, ':****@'))
  }

  console.log('Database setup complete')
}

export default globalSetup

