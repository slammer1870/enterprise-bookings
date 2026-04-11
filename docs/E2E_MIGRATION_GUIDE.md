# E2E Testing Migration Guide

## Migrating Apps to Production Build Strategy

This guide helps you migrate each app from dev-mode e2e tests to production-build e2e tests for 3-5x speed improvement.

## Why Migrate?

| Metric | Dev Mode | Production Mode |
|--------|----------|-----------------|
| Runtime | 15-30 min | 5-15 min |
| Workers | 1 (sequential) | 3-4 (parallel) |
| Turbo cacheable | ❌ | ✅ |
| CI stability | Medium | High |

## Migration Steps

### Step 1: Update Package Scripts

Add a `start:e2e` script if your app needs custom test environment variables:

```json
// apps/your-app/package.json
{
  "scripts": {
    "start": "cross-env NODE_OPTIONS=--no-deprecation next start",
    "start:e2e": "cross-env NODE_OPTIONS=\"--no-deprecation --experimental-loader ./scripts/payload-auth-loader.mjs\" ENABLE_TEST_MAGIC_LINKS=true ENABLE_TEST_WEBHOOKS=true next start"
  }
}
```

**Note:** Most apps can use the default `start` command. Only add `start:e2e` if you need:
- Custom loader scripts
- Test-specific environment variables
- Special configuration

### Step 2: Update Playwright Config (if using shared config)

If your app uses `createPlaywrightConfig`, it's already compatible! No changes needed.

```typescript
// apps/your-app/playwright.config.ts
import { createPlaywrightConfig } from '@repo/testing-config/src/playwright'

export default createPlaywrightConfig({
  testDir: './tests/e2e',
  webServerCommand: 'pnpm dev',  // Used in dev mode (E2E_USE_PROD=false)
  // Production mode will use 'pnpm start' automatically
})
```

**Optional overrides:**

```typescript
export default createPlaywrightConfig({
  testDir: './tests/e2e',
  webServerCommand: 'pnpm dev',
  
  // Optional: custom production server command
  productionServerCommand: 'pnpm start:e2e',
  
  // Optional: force production mode on/off
  useProductionBuild: true,
  
  // Optional: override worker count (default: 3 in CI, 4 locally for production)
  workers: 2,  // Use if your app needs fewer workers
})
```

### Step 3: Test Locally

```bash
# Test with production build
cd apps/your-app
E2E_USE_PROD=true turbo run test:e2e --filter=your-app

# First run: Build + tests (~12-15 min)
# Subsequent runs: Cached build + tests (~8-10 min)
```

**Verify:**
- ✅ Server starts successfully (`next start`)
- ✅ Tests run in parallel (check worker IDs in output)
- ✅ All tests pass
- ✅ No timeouts or connection errors

### Step 4: Debug Issues (if any)

#### Issue: "Build required" error

```bash
Error: Could not find a production build in .next directory
```

**Solution:**
```bash
# Build manually first
turbo run build --filter=your-app

# Then run tests
E2E_USE_PROD=true turbo run test:e2e --filter=your-app
```

#### Issue: Server won't start

```bash
Error: Port 3000 is already in use
```

**Solution:**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Retry
E2E_USE_PROD=true turbo run test:e2e --filter=your-app
```

#### Issue: Tests timeout frequently

```bash
Test timeout of 60000ms exceeded
```

**Solutions:**
1. Reduce worker count:
```typescript
// playwright.config.ts
workers: 2  // Down from 3-4
```

2. Increase timeout:
```typescript
timeout: 90000  // Up from 60000
```

3. Check for slow database queries or N+1 problems

#### Issue: Tests pass in dev mode but fail in production mode

**Common causes:**
- Environment variables missing in production
- HMR-dependent test logic
- Dev-only features being tested

**Solution:**
1. Check test environment setup
2. Verify env vars are set for production server
3. Update tests to work with both modes

### Step 5: Update CI (Optional)

If your app is in the CI matrix, it's already using production builds! Verify by checking:

```yaml
# .github/workflows/ci.yml
- name: Run E2E tests for ${{ matrix.app.name }}
  run: turbo run test:e2e:ci --filter=${{ matrix.app.name }}
  env:
    E2E_USE_PROD: "true"  # Should be set
```

### Step 6: Document App-Specific Notes

Add any app-specific notes to your app's README:

```markdown
## E2E Testing

### Quick Start
\`\`\`bash
# Production mode (recommended)
turbo run test:e2e --filter=your-app

# Dev mode (debugging)
cd apps/your-app
E2E_USE_PROD=false pnpm test:e2e
\`\`\`

### App-Specific Notes
- This app requires X workers (not the default 3)
- Tests take longer due to Y
- Known issue with Z feature in production mode
```

## App-by-App Status

### ✅ Migrated

- **atnd-me**
  - Custom config (inline, not shared)
  - Workers: 3 (multi-tenant, needs lower count)
  - Runtime: ~8-12 min

### 🟡 Ready (Using Shared Config)

These apps use `createPlaywrightConfig` and are ready for production mode:

- **kyuzo**
  - Workers: 3 (default)
  - Estimated runtime: ~10-15 min
  - No changes needed

- **darkhorse-strength**
  - Workers: 4 (default)
  - Estimated runtime: ~6-8 min
  - No changes needed

- **bru-grappling**
  - Workers: 4 (default)
  - Estimated runtime: ~6-8 min
  - No changes needed

- **atnd** (if has e2e tests)
  - Workers: 3 (multi-tenant)
  - Estimated runtime: TBD
  - May need custom config like atnd-me

### ⏳ To Migrate

None! All apps using the shared config are automatically compatible.

## Testing the Migration

### Smoke Test (All Apps)

```bash
# Test each app locally
for app in atnd-me kyuzo darkhorse-strength bru-grappling; do
  echo "Testing $app..."
  E2E_USE_PROD=true turbo run test:e2e --filter=$app
done
```

### CI Test

Push to a branch and check GitHub Actions:

```bash
git checkout -b test/e2e-production-mode
git push origin test/e2e-production-mode
```

Watch the `e2e-tests` job in GitHub Actions to verify:
- ✅ Build completes successfully
- ✅ Turbo cache is used
- ✅ Tests run in parallel
- ✅ All tests pass
- ✅ Total time is reduced

## Rollback Plan

If you need to revert to dev mode:

### Locally

```bash
# Set env var
E2E_USE_PROD=false pnpm test:e2e
```

### In CI

```yaml
# .github/workflows/ci.yml
- name: Run E2E tests
  run: turbo run test:e2e:ci --filter=${{ matrix.app.name }}
  env:
    E2E_USE_PROD: "false"  # Force dev mode
```

### In Shared Config

```typescript
// packages/testing-config/src/playwright/base.ts
const useProductionBuild = false  // Force dev mode globally
```

## FAQ

### Q: Do I need to update my test code?

**A:** No! Tests remain exactly the same. Only the server mode changes.

### Q: Will this work with my custom test fixtures?

**A:** Yes! Production mode doesn't affect test logic, only server startup.

### Q: Can I use production mode locally?

**A:** Yes! Set `E2E_USE_PROD=true` or it will default to production mode if you're using the shared config.

### Q: What if my tests require dev-only features (HMR, etc)?

**A:** Use `E2E_USE_PROD=false` for those specific tests, or add a separate test file that explicitly runs in dev mode.

### Q: How do I know if Turbo cache is working?

**A:** Look for this in the output:
```
>>> FULL TURBO
cache hit, replaying logs...
```

### Q: Can I mix production and dev mode tests?

**A:** Not recommended. Choose one mode per app. Use dev mode exceptions only for specific test files if needed.

## Best Practices

1. **Default to production mode** - Faster, more reliable, cacheable
2. **Use dev mode for debugging** - When you need to inspect HMR or dev-only features
3. **Monitor CI performance** - Track build times and test runtimes
4. **Adjust workers per app** - Multi-tenant apps may need fewer workers
5. **Document exceptions** - If your app needs special config, document why

## Support

Questions? Check:
- [CI E2E Testing Strategy](./CI_E2E_TESTING.md)
- [E2E Optimization Guide](../apps/atnd-me/tests/E2E_OPTIMIZATION_GUIDE.md)
- [Quick Reference](./.github/E2E_QUICK_REFERENCE.md)

## Summary

**Migration is simple:**

1. Apps using `createPlaywrightConfig` → Already compatible ✅
2. Apps with custom configs → Update to use shared config or inline production logic
3. Test locally with `E2E_USE_PROD=true`
4. Push to CI and verify
5. Document any app-specific notes

**Result:**
- 3-5x faster e2e tests
- Turborepo caching enabled
- More stable CI runs
- Better production representation
