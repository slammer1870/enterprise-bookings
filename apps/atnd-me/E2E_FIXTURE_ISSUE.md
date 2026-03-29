# E2E Test Fixture Timeout Issue

## Problem

The `testData` fixture in `tests/e2e/helpers/fixtures.ts` times out after 5 minutes during `setupE2ETestData()`.

## Root Cause

The test uses Payload's Local API from within Playwright test workers:

```typescript
// In data-helpers.ts
async function getPayloadInstance(): Promise<Payload> {
  if (!payloadInstance) {
    const payloadConfig = await config
    payloadInstance = await getPayload({ config: payloadConfig })
  }
  return payloadInstance
}
```

This creates **multiple Payload instances** competing for the same SQLite database:
1. **Playwright webServer** creates a Payload instance (for the Next.js server)
2. **Each Playwright test worker** creates its own Payload instance (via `getPayloadInstance()`)

**SQLite has limited concurrency** and file locking prevents multiple instances from accessing the database simultaneously, causing the test workers to hang indefinitely.

## Evidence

- Tests timeout after exactly 300 seconds (the fixture timeout)
- No "Creating default data for tenant" messages (env var `PW_E2E_SKIP_DEFAULT_TENANT_DATA` is working)
- Build completes successfully but fixture setup never finishes
- TypeScript compilation passes (`pnpm check-types` works fine)

## Solutions

### Option 1: Use HTTP API Instead of Local API (Recommended)

Create test data via HTTP API calls to the running webServer instead of using Payload's Local API:

```typescript
// Instead of:
const tenant = await payload.create({ collection: 'tenants', data: {...} })

// Do:
const response = await request.post('/api/tenants', { data: {...} })
const tenant = await response.json()
```

### Option 2: Pre-seed Database in webServer Command

Seed the database once before starting the webServer, not in test fixtures:

```typescript
// In playwright.config.ts
webServer: {
  command: 'pnpm run payload migrate:fresh && pnpm run seed:e2e && pnpm start:e2e',
  // ...
}
```

### Option 3: Use Single Payload Instance

Share a single Payload instance across all test workers (complex, not recommended with SQLite).

## Temporary Workaround

For now, tests that need complex setup should:
1. Use simpler fixtures or no fixtures
2. Create data via HTTP API in test setup
3. Or accept longer test times with pre-seeded data

## Files Affected

- `tests/e2e/helpers/fixtures.ts` - Fixture definition with 300s timeout
- `tests/e2e/helpers/data-helpers.ts` - Uses Local API (causes SQLite contention)
- `playwright.config.ts` - Sets `PW_E2E_SKIP_DEFAULT_TENANT_DATA=true`
- `package.json` - Updated `test:e2e:ci` with env var

## Related Changes

- Added `PW_E2E_SKIP_DEFAULT_TENANT_DATA` to skip expensive tenant data creation
- Increased fixture timeout from 180s to 300s (didn't solve the core issue)
- Fixed `start:e2e` to use standalone server (`node .next/standalone/apps/atnd-me/server.js`)
