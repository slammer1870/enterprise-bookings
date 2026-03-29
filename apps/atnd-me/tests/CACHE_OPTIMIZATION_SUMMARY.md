# Turborepo Cache Optimization - Complete Fix

## Problem Solved ✅

**Issue:** Editing e2e test files triggered unnecessary rebuilds, adding 2-3 minutes to every test iteration.

**Root Cause:** Turborepo's `$TURBO_DEFAULT$` includes ALL workspace files in the build cache key, so test file changes invalidated the build cache.

## Solution Applied

### 1. Build Input Filtering (`turbo.json`)

Changed from:
```json
{
  "build": {
    "inputs": ["$TURBO_DEFAULT$", ".env*"]
  }
}
```

To:
```json
{
  "build": {
    "inputs": [
      "src/**",           // Application source
      "public/**",        // Static assets
      "package.json",     // Dependencies
      "tsconfig*.json",   // TypeScript config
      "next.config.*",    // Next.js config
      "tailwind.config.*",// Tailwind config
      ".env*",            // Environment files
      "!src/**/*.test.*", // Exclude unit tests
      "!src/**/*.spec.*"  // Exclude specs
    ]
    // Note: tests/e2e/** NOT included!
  }
}
```

### 2. Database Schema Push Fix

**Problem:** Parallel test workers tried to create duplicate enum types, causing:
```
Error: type "enum_tenants_stripe_connect_onboarding_status" already exists
```

**Solution:** Added `PW_E2E_PROFILE=true` to Playwright's webServer env, which triggers the existing logic in `payload.config.ts`:

```typescript
// payload.config.ts (already exists)
const disableSchemaPush =
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  Boolean(process.env.PW_E2E_PROFILE)  // ← Playwright workers

db: postgresAdapter({
  ...(disableSchemaPush ? { push: false } : {})
})
```

This ensures:
- ✅ `migrate:fresh` runs once at server startup
- ✅ Test workers don't try to push schema changes
- ✅ No duplicate enum type errors

## Results

### Before Optimization

```
┌─────────────────────────────────┐
│ Edit test file                  │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ turbo run test:e2e              │
│  → Detects input change         │
│  → Invalidates build cache      │
│  → Rebuilds app (2-3 min) ❌    │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ Runs e2e tests (4.6 min)        │
└─────────────────────────────────┘
Total: 6-8 minutes
```

### After Optimization

```
┌─────────────────────────────────┐
│ Edit test file                  │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ turbo run test:e2e              │
│  → Checks build inputs          │
│  → No app files changed         │
│  → Uses cached build ✅         │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│ Runs e2e tests (4.6 min)        │
└─────────────────────────────────┘
Total: 4.6 minutes
```

**Time savings: 2-3 minutes per test iteration!**

## When Build Cache is Used vs Invalidated

### Cache PRESERVED (No Rebuild) ✅

| Change Type | Example | Build? |
|-------------|---------|--------|
| E2E test files | `tests/e2e/admin.spec.ts` | ❌ Cache hit |
| Integration tests | `tests/int/api.test.ts` | ❌ Cache hit |
| Playwright config | `playwright.config.ts` | ❌ Cache hit |
| Test helpers | `tests/e2e/helpers/*.ts` | ❌ Cache hit |
| Unit tests | `src/app/page.test.tsx` | ❌ Cache hit |
| Documentation | `tests/README.md` | ❌ Cache hit |

### Cache INVALIDATED (Rebuild) 🔄

| Change Type | Example | Build? |
|-------------|---------|--------|
| Application code | `src/app/page.tsx` | ✅ Rebuild |
| Components | `src/components/Button.tsx` | ✅ Rebuild |
| Dependencies | `package.json` | ✅ Rebuild |
| Build config | `next.config.js` | ✅ Rebuild |
| TypeScript config | `tsconfig.json` | ✅ Rebuild |
| Static assets | `public/logo.png` | ✅ Rebuild |

## Verification

To verify the optimization is working:

```bash
# 1. Run e2e tests (will build)
turbo run test:e2e --filter=atnd-me

# 2. Edit a test file
echo "// test change" >> tests/e2e/app-smoke.e2e.spec.ts

# 3. Run e2e tests again
turbo run test:e2e --filter=atnd-me

# Expected output:
# atnd-me:build: cache hit, replaying logs [took 123ms]
#                ^^^^^^^^^^  ← Cache hit means no rebuild!
```

## Files Changed

1. **`/turbo.json`** (root)
   - Changed `build.inputs` to exclude test directories
   - Now only app code/config triggers rebuilds

2. **`apps/atnd-me/playwright.config.ts`**
   - Added `PW_E2E_PROFILE=true` to webServer env
   - Triggers existing schema push disable logic

3. **`apps/atnd-me/tests/e2e/helpers/data-helpers.ts`**
   - Removed incorrect `push: false` override attempt
   - Added comment explaining PW_E2E_PROFILE

4. **`apps/atnd-me/package.json`**
   - Added `STRIPE_CONNECT_CLIENT_ID` to `start:e2e` script

## CI Impact

In CI, this optimization helps when:
- Running e2e tests after a test-only change
- Retrying failed e2e tests
- Running multiple test suites in parallel

Example CI workflow:
```yaml
# PR with only test changes:
- Build job: < 5 sec (cache hit from previous run)
- E2E job: 4.6 min
Total: ~5 min (instead of 6-8 min)
```

## Performance Summary

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Edit test file → run tests | 6-8 min | 4.6 min | **2-3 min** |
| Edit app code → run tests | 6-8 min | 6-8 min | N/A (rebuild needed) |
| 10 test iterations | 60-80 min | 46 min | **14-34 min** |

## Monitoring

Watch for these signs that caching is working:

**✅ Good (cache working):**
```
atnd-me:build: cache hit, replaying logs
```

**❌ Bad (cache miss):**
```
atnd-me:build: cache miss, executing <hash>
```

If you see cache misses after test-only changes:
1. Check that test files are NOT in `turbo.json` build inputs
2. Verify no `.env` or config files were modified
3. Check Turbo cache directory: `ls -la .turbo/`

## Related Documentation

- `TURBO_BUILD_CACHE.md` - Detailed explanation of build cache optimization
- `E2E_OPTIMIZATION_GUIDE.md` - Complete e2e testing strategy
- `E2E_RESULTS.md` - Latest test run analysis
- `/docs/TURBO_CACHE_E2E.md` - How Turbo cache works in CI

## Summary

✅ **Problem:** Test file changes triggered unnecessary 2-3 min rebuilds  
✅ **Solution:** Explicitly define build inputs to exclude test directories  
✅ **Result:** 2-3 min time savings per test iteration  
✅ **Bonus:** Fixed parallel worker schema push conflicts  
✅ **Impact:** Faster TDD cycles, cheaper CI runs, happier developers! 🚀
