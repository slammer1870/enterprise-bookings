// Any setup scripts you might need go here
// This file is executed before Vitest runs any tests.
// It is used both locally and in CI.

// Set NODE_ENV to test early to ensure push is disabled
if (!process.env.NODE_ENV) {
  ;(process.env as any).NODE_ENV = 'test'
}

// Load .env files first so we can respect any existing DATABASE_URI
import 'dotenv/config'

// Ensure NODE_ENV is test (dotenv might override it)
;(process.env as any).NODE_ENV = 'test'

// Set PAYLOAD_SECRET early for test environment if not already set
if (!process.env.PAYLOAD_SECRET) {
  process.env.PAYLOAD_SECRET = 'test-secret-key-for-ci-builds-only'
}
