import { createDbString } from '@repo/testing-config/src/utils/db'
import { getPayload } from 'payload'

/**
 * Global setup for Vitest integration tests
 * Creates a test database container if DATABASE_URI is not already set,
 * then initializes Payload once to push the schema.
 * This ensures schema is created before any test files run.
 */
export async function globalSetup() {
  console.log('[Vitest Global Setup] Starting...')

  // Ensure PAYLOAD_SECRET is set before any config loading
  if (!process.env.PAYLOAD_SECRET) {
    process.env.PAYLOAD_SECRET = 'test-secret-key-for-ci-builds-only'
  }

  // If DATABASE_URI is not set and we're not forcing an existing DB,
  // create a test container (for local development)
  if (!process.env.DATABASE_URI && !process.env.FORCE_EXISTING_DB) {
    console.log('[Vitest Global Setup] DATABASE_URI not set, creating test database container...')
    try {
      const dbString = await createDbString()
      process.env.DATABASE_URI = dbString
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

  // In CI, migrations are run by the workflow before tests
  // For local test containers, temporarily enable push to create schema once
  if (!process.env.CI && process.env.DATABASE_URI) {
    console.log('[Vitest Global Setup] Initializing Payload to push schema (first time only)...')
    try {
      // Temporarily enable push for schema creation
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development' // Enable push
      
      // Import config dynamically after setting env vars
      const { default: config } = await import('../../src/payload.config.js')
      const payloadConfig = await config
      const payload = await getPayload({ config: payloadConfig })
      
      // Wait for schema push to complete (Payload pushes asynchronously)
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Verify schema was created
      try {
        await payload.db.drizzle.execute('SELECT 1 FROM users LIMIT 1')
        console.log('[Vitest Global Setup] Schema verified - users table exists')
      } catch (verifyError) {
        console.warn('[Vitest Global Setup] Schema verification failed:', verifyError)
      }
      
      // Restore NODE_ENV before destroying
      process.env.NODE_ENV = originalNodeEnv || 'test'
      
      // Destroy the instance - tests will create their own with push disabled
      await payload.db.destroy()
      console.log('[Vitest Global Setup] Schema pushed successfully')
    } catch (error) {
      console.error('[Vitest Global Setup] Failed to initialize Payload:', error)
      // Restore NODE_ENV on error
      if (process.env.NODE_ENV === 'development') {
        process.env.NODE_ENV = 'test'
      }
      // Continue anyway - tests might handle it
    }
  } else if (process.env.CI) {
    console.log('[Vitest Global Setup] CI mode: migrations handled by workflow')
  }

  console.log('[Vitest Global Setup] Complete')
}

export default globalSetup
