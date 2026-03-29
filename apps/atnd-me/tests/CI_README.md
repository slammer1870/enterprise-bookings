# CI/CD Test Configuration

## Current Status

The tests are **mostly ready** for CI/CD, but require a few additions to the GitHub Actions workflow.

## What's Already Configured ✅

1. **Integration Tests (`test:int`)**:
   - Uses `DATABASE_URI` from environment (set by CI)
   - Uses Payload config that reads from `process.env.DATABASE_URI`
   - Properly handles test data cleanup
   - Uses Vitest with Node environment

2. **E2E Tests (`test:e2e`)**:
   - Playwright config respects `CI` environment variable
   - Retries configured for CI (2 retries)
   - Workers set to 1 in CI (serial execution)
   - Web server timeout increased for CI

3. **Package Scripts**:
   - ✅ `test:e2e:ci` - Added for CI-specific e2e test execution
   - ✅ `ci` - Added for database migrations and build

## Required CI/CD Workflow Changes

To enable `atnd-me` tests in CI/CD, add it to the e2e test matrix in `.github/workflows/ci.yml`:

```yaml
e2e-tests:
  strategy:
    matrix:
      app:
        # ... existing apps ...
        - name: atnd-me
          db: e2e_atnd_me
          app_path: apps/atnd-me
```

## Environment Variables Required

The CI workflow should set these environment variables for `atnd-me`:

- `DATABASE_URI` - PostgreSQL connection string (set by CI matrix)
- `PAYLOAD_SECRET` - Payload secret key
- `NEXT_PUBLIC_SERVER_URL` - Server URL (defaults to `http://localhost:3000`)
- `CI=true` - Enables CI-specific test behavior

## Test Execution Flow in CI

1. **Database Setup**: PostgreSQL service container starts
2. **Migrations**: `pnpm ci` runs `payload migrate:fresh` to set up schema
3. **Build**: Next.js app is built
4. **E2E Tests**: `pnpm test:e2e:ci` runs Playwright tests
   - Web server starts automatically via `webServer` config
   - Tests run serially (1 worker) to avoid race conditions
   - HTML report is generated but not opened (`PW_TEST_HTML_REPORT_OPEN=never`)

## Integration Tests in CI

Integration tests can be run in CI but are not currently in the workflow. To add them:

```yaml
- name: Run Integration tests for ${{ matrix.app.name }}
  run: pnpm test:int
  working-directory: ${{ matrix.app.app_path }}
```

## Potential Issues & Solutions

### Issue: Database Connection
- **Problem**: Tests fail to connect to database
- **Solution**: Ensure `DATABASE_URI` is set correctly in CI workflow

### Issue: Test Timeouts
- **Problem**: Tests timeout in CI
- **Solution**: Timeouts are already increased (180s for web server, 60s for test timeouts)

### Issue: Race Conditions
- **Problem**: Tests interfere with each other
- **Solution**: Workers set to 1 in CI, tests run serially

### Issue: First User Creation
- **Problem**: Multiple tests trying to create first admin user
- **Solution**: Tests use `overrideAccess: true` for setup, avoiding access control issues

## Local Testing

To test CI behavior locally:

```bash
# Set CI environment
export CI=true
export DATABASE_URI="postgres://postgres:password@localhost:5432/atnd_me_test"

# Run migrations
pnpm ci

# Run tests
pnpm test:e2e:ci
pnpm test:int
```
