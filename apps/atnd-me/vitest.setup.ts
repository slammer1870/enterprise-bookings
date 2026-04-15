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

// Disable cloud storage (R2/S3) for Media uploads during integration tests.
// Without this, Payload imports `s3Storage` based on R2_* env vars and the Media
// collection attempts network uploads.
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

// Set PAYLOAD_SECRET early for test environment if not already set
if (!process.env.PAYLOAD_SECRET) {
  process.env.PAYLOAD_SECRET = 'test-secret-key-for-ci-builds-only'
}
