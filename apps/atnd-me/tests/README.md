# atnd-me Tests

This directory contains integration and E2E tests for the `atnd-me` app.

## Test Structure

### Integration Tests (`int/`)

#### `trpc-bookings.int.spec.ts`
Integration tests for tRPC booking procedures:
- `timeslots.getByIdForBooking`: Fetches lesson for booking, handles errors
- `bookings.createBookings`: Creates single and multiple bookings, validates capacity

These tests:
- Use a real Payload instance with test database
- Create test users, timeslots, and class options
- Test authentication and authorization
- Clean up test data after each test

### E2E Tests (`e2e/`)

Streamlined suite (~23 tests) covering critical user flows. **Turborepo-optimized:**

- **Reduced test count:** 52 → 23 tests (removed redundant/trivial tests)
- **Production build:** Tests run against `next start` (cached by Turbo)
- **Parallel execution:** 3-4 workers (production build is stable under load)
- **Expected runtime:** ~8-12 min with Turbo cache (vs 1+ hour before optimization)

**Test files:**
- **app-smoke.e2e.spec.ts** (6 tests) – Homepage, checkout flows (pay-at-door, Stripe, class-pass), manage page, admin dashboard
- **multi-booking-manage.e2e.spec.ts** (6 tests) – Manage routing, increase/decrease quantity, capacity guard
- **booking-fee-disclosure.e2e.spec.ts** (1 test) – Fee breakdown display
- **stripe-connect-onboarding.e2e.spec.ts** (3 tests) – Connect CTA, OAuth redirect, connected state
- **admin-payment-methods-gated-by-connect.e2e.spec.ts** (2 tests) – Payment controls gated by Stripe Connect
- **admin-panel-access.e2e.spec.ts** (1 test) – Role-based admin access (super-admin, tenant-admin, regular user)
- **staff-admin-custom-domain.e2e.spec.ts** (3 tests) – Staff role reaches admin on tenant custom-domain host (`*.nip.io`) and subdomain; cross-tenant admin blocked
- **tenant-routing.e2e.spec.ts** (3 tests) – Root domain, subdomain routing, invalid subdomain handling
- **tenant-scoped-page-slugs.e2e.spec.ts** (1 test) – Identical slugs across tenants route correctly

**Removed/Moved:**
- Admin UI navigation tests → integration tests (faster via API)
- Admin tenant selector E2E → `@repo/plugin-clearable-tenant` package (`pnpm test:e2e` in that package; run against an app that uses the plugin)
- Duplicate subdomain tests → consolidated
- Cross-tenant booking spec → covered by app-smoke and multi-booking tests

**Performance Notes:**
- **Production mode (default):** Tests run against `next start` after `turbo build`, allowing 3-4 parallel workers
- **Dev mode fallback:** Set `E2E_USE_PROD=false` to test against dev server (slower, 1 worker, useful for debugging)
- **Turbo caching:** Build is cached; if code unchanged, tests start immediately (~30s startup vs 2-3min rebuild)
- **Why production is faster:**
  - No HMR/webpack overhead
  - Optimized bundle (minified, tree-shaken)
  - More stable under concurrent load
  - Faster server-side rendering

## Running Tests

### With Turborepo (Recommended - Fastest)

```bash
# Run e2e tests with Turbo (uses cached build, runs against production)
pnpm test:e2e:atnd-me
# equivalent: turbo run test:e2e --filter=atnd-me

# Run a single spec (Playwright matches the argument as a regex; avoid raw `.spec.ts` paths)
pnpm test:e2e:atnd-me -- staff-admin-custom-domain

# Run e2e tests in CI (optimized, atnd-me only)
pnpm test:e2e:ci:atnd-me

# Run all tests (integration + e2e)
turbo run test --filter=atnd-me
```

**Benefits:**
- ✅ Tests run against production build (`next start`) - faster, more stable
- ✅ Build is cached by Turbo - subsequent runs skip rebuild if code unchanged
- ✅ Can run 3-4 parallel workers (vs 1 in dev mode)
- ✅ Expected runtime: ~8-12 minutes (vs 20-25 min in dev mode)

### Direct Commands (Without Turbo)

```bash
# Run integration tests
pnpm test:int

# Run E2E tests (uses production build by default)
pnpm test:e2e

# Run E2E tests in CI mode
pnpm test:e2e:ci

# Run E2E against dev server (slower, for debugging)
E2E_USE_PROD=false pnpm test:e2e
```

## Test Setup

### Integration Tests
- Use Vitest with React testing environment
- Require a running Payload instance
- Create isolated test data for each test suite

### E2E Tests
- Use Playwright for browser automation
- Require the Next.js dev server to be running (or `PW_SKIP_WEB_SERVER=1` if already running)
- `test:e2e:local` runs the same trimmed e2e suite as CI (app-smoke, multi-booking-manage, Stripe/fees, admin access, tenant routing/slugs, cross-tenant).
- Worker-scoped fixtures (`setupE2ETestData`) create tenants, users, etc.; no seed required for e2e.

## Notes

- Integration tests mock Payload's `auth()` method to simulate authenticated users
- E2E smoke uses fixture-created data; full e2e suite may use additional seeded data
- Both test types clean up their test data after execution where applicable
