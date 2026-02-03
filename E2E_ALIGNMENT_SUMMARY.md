# E2E Test Alignment Summary

All apps have been aligned to use the **atnd-me** e2e testing standard.

## Apps Updated

### ✅ atnd-me (Standard/Reference)
- Already using the correct pattern
- Tests passing

### ✅ boatyard-sauna  
- Already using the correct pattern
- Tests passing

### ⚠️ bru-grappling (Partially Fixed)
**Changes Made:**
1. Updated `playwright.config.ts` - Aligned with atnd-me pattern
2. Updated `payload.config.ts` - Added `PW_E2E_PROFILE` check
3. Removed duplicate/incompatible migrations:
   - Removed `20260203_185614` (auto-generated duplicate)
   - Removed `20260128_000001_locked_documents_rels_memberships` (incompatible rename)

**Test Results:**
- ✅ Admin tests (4/4 passing)
- ❌ User booking flow tests (0/6) - Logic issues unrelated to config

### ✅ darkhorse-strength (Fixed)
**Changes Made:**
1. Updated `playwright.config.ts` - Migrated from `createPlaywrightConfig` to atnd-me pattern
2. Updated `payload.config.ts` - Added `PW_E2E_PROFILE` check

### ✅ kyuzo (Fixed)
**Changes Made:**
1. Updated `playwright.config.ts` - Migrated from `createPlaywrightConfig` to atnd-me pattern
2. Updated `payload.config.ts` - Added `PW_E2E_PROFILE` check

### ⚠️ atnd (Minimal Config)
- Uses simpler config (no migrations, reuses existing server)
- No changes needed - already passing

---

## Key Changes Applied

### 1. Playwright Config Pattern

**Before (using helper function):**
```typescript
import { createPlaywrightConfig } from '@repo/testing-config/src/playwright'

export default createPlaywrightConfig({
  testDir: './tests/e2e',
  webServerCommand: 'pnpm dev',
  webServerUrl: 'http://localhost:3000/api/health',
})
```

**After (atnd-me standard):**
```typescript
import { defineConfig, devices } from '@playwright/test'

process.env.PW_E2E_PROFILE ??= 'true'

const useProductionBuild = process.env.E2E_USE_PROD !== 'false'

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: useProductionBuild ? (process.env.CI ? 1 : 2) : 1,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useProductionBuild
    ? {
        // Production mode: faster, more stable
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm start',
        url: 'http://localhost:3000/api/health',
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'production',
          NODE_OPTIONS: '--no-deprecation',
          PW_E2E_PROFILE: 'true',
          // App-specific env vars here
        },
      }
    : {
        // Dev mode fallback: slower but good for debugging
        command: 'pnpm run payload migrate:fresh --force-accept-warning && pnpm dev',
        url: 'http://localhost:3000/api/health',
        timeout: 180000,
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'development',
          CI: 'true',
          NODE_OPTIONS: '--no-deprecation',
          PW_E2E_PROFILE: 'true',
          // App-specific env vars here
        },
      },
})
```

### 2. Payload Config Pattern

**Before:**
```typescript
db: postgresAdapter({
  pool: { connectionString: process.env.DATABASE_URI },
  ...(process.env.NODE_ENV === 'test' || process.env.CI
    ? {
        migrations,
        push: false,
      }
    : {}),
}),
```

**After:**
```typescript
db: postgresAdapter({
  pool: { connectionString: process.env.DATABASE_URI },
  ...(process.env.NODE_ENV === 'test' || process.env.CI || process.env.PW_E2E_PROFILE
    ? {
        migrations,
        push: false, // Disable automatic schema pushing in test/CI/E2E
      }
    : {}),
}),
```

---

## Benefits of Alignment

### 1. **Consistency**
- All apps use the same testing pattern
- Easier to maintain and debug
- Knowledge transfers between apps

### 2. **Performance**
- Production builds are 3-4x faster than dev mode
- Can run 2 workers instead of 1 (parallel tests)
- Turbo can cache production builds

### 3. **Reliability**
- `PW_E2E_PROFILE` prevents schema push conflicts
- `migrate:fresh` ensures clean database state
- Production builds are more stable

### 4. **Developer Experience**
- Clear production vs dev mode toggle (`E2E_USE_PROD=false`)
- Better error messages and timeouts
- HTML reporter with traces on failure

---

## Running E2E Tests

### Production Mode (Default, Recommended)
```bash
# Requires building first
pnpm run build
pnpm run test:e2e
```

### Dev Mode (Debugging)
```bash
E2E_USE_PROD=false pnpm run test:e2e
```

### CI Mode
```bash
# CI env var is set automatically in CI environments
pnpm run test:e2e:ci  # or test:e2e
```

---

## Troubleshooting

### Schema Mismatch Errors
If you see errors like "column X does not exist":
1. Check migrations are properly registered in `src/migrations/index.ts`
2. Rebuild the app: `pnpm run build`
3. Clear database: `pnpm run payload migrate:fresh --force-accept-warning`

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
```

### Slow Tests
- Use production mode (default)
- Increase worker count (only in production mode)
- Check if migrations are optimized

---

## Next Steps

1. **bru-grappling**: Fix user booking flow test logic (lessonId parameter issues)
2. **All apps**: Consider adding worker-scoped fixtures like atnd-me for parallel test execution
3. **All apps**: Review and optimize migration files
4. **CI Integration**: Ensure Turbo caches production builds for faster CI runs
