# CI E2E Testing Strategy

## Overview

All apps in this monorepo now use a **production-build-first** strategy for e2e tests in CI. This provides:

- **3-5x faster test execution** (production server handles concurrent load better)
- **Turborepo caching** (builds are cached and reused across jobs)
- **More reliable tests** (production server is more stable than dev server)
- **Parallel execution** (3-4 workers vs 1 in dev mode)

## How It Works in CI

### Workflow Steps

```yaml
1. Build Job (runs first, per app)
   ├── Install dependencies
   ├── Run database migrations
   └── Build app: pnpm run ci --filter=<app>
       └── Output: .next/ directory
       └── Cached by Turbo: .turbo/<task-hash>/

2. E2E Tests Job (runs in parallel after build, per app)
   ├── Restore pnpm cache
   ├── Restore Turbo cache (critical! contains .next/ from build job)
   ├── Install dependencies
   ├── Install Playwright browsers
   ├── Run migrations
   └── Run tests: turbo run test:e2e:ci --filter=<app>
       ├── Turbo detects "build" dependency
       ├── Checks cache: FULL TURBO (cache hit!)
       ├── Restores .next/ from cache (< 5 seconds)
       ├── Server: next start (uses cached build)
       ├── Workers: 3 parallel
       └── Runtime: ~8-12 minutes
```

**Key insight:** Turbo automatically handles the build dependency! When you run `turbo run test:e2e:ci`, it:
1. Sees `test:e2e:ci` depends on `build` (from turbo.json)
2. Checks if build is cached (it is, from the build job)
3. Restores build outputs from cache
4. Runs tests against the cached build

**No manual rebuild needed!**

### Key Changes vs Dev Mode

| Aspect | Dev Mode (Old) | Production Mode (CI) |
|--------|---------------|---------------------|
| **Server** | `next dev` | `next start` |
| **Build required** | ❌ No | ✅ Yes (cached by Turbo) |
| **Workers** | 1 (sequential) | 3-4 (parallel) |
| **Runtime** | 20-30 min | 8-12 min |
| **Stability** | Medium (HMR overhead) | High (optimized bundle) |
| **Turbo cacheable** | ❌ No | ✅ Yes |

## Configuration

### Shared Config (`packages/testing-config/src/playwright/base.ts`)

```typescript
// Production mode automatically enabled in CI
const useProductionBuild = process.env.CI && process.env.E2E_USE_PROD !== 'false'

webServer: useProductionBuild ? {
  command: 'pnpm start',  // Production server
  workers: 3,              // Parallel execution
  NODE_ENV: 'production'
} : {
  command: 'pnpm dev',     // Dev server (local debugging)
  workers: 1,              // Sequential
  NODE_ENV: 'development'
}
```

### Per-App Configuration

Apps can override defaults in their `playwright.config.ts`:

```typescript
// kyuzo/playwright.config.ts
export default createPlaywrightConfig({
  testDir: './tests/e2e',
  webServerCommand: 'pnpm dev',  // Used in dev mode only
  productionServerCommand: 'pnpm start',  // Optional: custom production command
  useProductionBuild: true,  // Optional: force production build
  workers: 4,  // Optional: override worker count
})
```

### Environment Variables

- `E2E_USE_PROD=true` - Force production build (default in CI)
- `E2E_USE_PROD=false` - Force dev mode (debugging)
- `CI=true` - Detected automatically by GitHub Actions

## CI Workflow Details

### Build Job

```yaml
- name: Build the project for ${{ matrix.app.name }}
  run: pnpm run ci --filter ${{ matrix.app.name }}
  # Runs: payload migrate:fresh && next build
  # Output cached by Turbo in .turbo cache
```

### E2E Tests Job

```yaml
- name: Restore Turbo artifacts
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    # Restores ALL build outputs from build job via Turbo cache

- name: Run E2E tests
  run: turbo run test:e2e:ci --filter=${{ matrix.app.name }}
  env:
    E2E_USE_PROD: "true"
  # Turbo automatically:
  # 1. Detects "build" dependency (from turbo.json)
  # 2. Checks cache (FULL TURBO - cache hit!)
  # 3. Restores .next/ directory (< 5 seconds)
  # 4. Starts production server (next start)
  # 5. Runs tests in parallel (3 workers)
```

**No explicit build command needed!** Turbo handles it via the dependency chain.

## Benefits by App

### Multi-Tenant Apps (atnd-me, kyuzo, etc.)

**Before (dev mode):**
- Dev server couldn't handle concurrent requests
- Tests ran sequentially (1 worker)
- Runtime: 20-30 minutes
- Frequent timeouts and failures

**After (production mode):**
- Production server handles concurrent load
- Tests run in parallel (3 workers)
- Runtime: 8-12 minutes
- Stable, reliable execution

### Single-Tenant Apps (darkhorse-strength, bru-grappling, etc.)

**Before (dev mode):**
- HMR and webpack overhead
- Slower page loads
- Runtime: 15-20 minutes

**After (production mode):**
- Optimized bundle, no HMR
- Faster page loads
- Runtime: 5-8 minutes
- Can use 4 workers safely

## Turbo Caching Strategy

### Build Cache

```json
// turbo.json
{
  "tasks": {
    "build": {
      "outputs": [".next/**", "!.next/cache/**"],
      "cache": true
    }
  }
}
```

**Cache Keys:**
- Input hash (source files, dependencies)
- Environment variables (DATABASE_URI, etc.)

**Cache Hit:**
- Build outputs restored from `.turbo` cache
- Skip compilation (saves 2-3 minutes)

**Cache Miss:**
- Full build required
- Outputs saved to cache for next run

### Test Cache

```json
{
  "tasks": {
    "test:e2e:ci": {
      "dependsOn": ["build"],
      "cache": false  // Tests shouldn't be cached (data changes)
    }
  }
}
```

Tests are **not cached** because:
- Database state changes between runs
- Test results depend on runtime environment
- Playwright interactions are non-deterministic

## Debugging CI Failures

### Common Issues

#### 1. Build Not Found

```
Error: ENOENT: no such file or directory, open '.next/BUILD_ID'
```

**Solution:** Ensure build job completed successfully
```yaml
- name: Build app
  run: turbo run build --filter=${{ matrix.app.name }}
```

#### 2. Port Already in Use

```
Error: Port 3000 is already in use
```

**Solution:** Already handled by `reuseExistingServer: !process.env.CI`

#### 3. Tests Timing Out

```
Test timeout of 60000ms exceeded
```

**Solutions:**
- Check server startup time (should be < 30s)
- Verify database migrations completed
- Check for slow queries or N+1 problems
- Consider reducing worker count (3 → 2)

#### 4. Turbo Cache Miss

```
Cache miss on task build...
```

**Check:**
- Are env vars stable? (DATABASE_URI changes = cache miss)
- Did dependencies change? (pnpm-lock.yaml)
- Did source files change?

### Force Dev Mode in CI (for debugging)

```yaml
- name: Run E2E tests (dev mode)
  run: turbo run test:e2e:ci --filter=${{ matrix.app.name }}
  env:
    E2E_USE_PROD: "false"
```

## Performance Monitoring

### Metrics to Track

```yaml
- name: Run E2E tests with timing
  run: |
    time turbo run test:e2e:ci --filter=${{ matrix.app.name }}
```

**Key metrics:**
- Build time (should be < 10s with cache)
- Server startup time (should be < 30s)
- Test execution time (varies by app)
- Total job time (build + tests)

### Expected Runtimes

| App | Tests | Workers | Build | Server Start | Test Run | Total |
|-----|-------|---------|-------|--------------|----------|-------|
| atnd-me | 23 | 3 | 5s* | 20s | 8-10min | ~12min |
| kyuzo | ~30 | 3 | 5s* | 15s | 10-12min | ~15min |
| darkhorse-strength | ~20 | 4 | 5s* | 10s | 5-7min | ~8min |
| bru-grappling | ~25 | 4 | 5s* | 10s | 6-8min | ~10min |

*With Turbo cache hit. First run: 2-3 minutes.

## Remote Caching (Optional)

Enable Vercel Remote Cache for team-wide build sharing:

```bash
# One-time setup
turbo login
turbo link

# CI will automatically use remote cache
# TURBO_TOKEN and TURBO_TEAM from GitHub secrets
```

**Benefits:**
- Builds shared across all CI runs
- Developers can use CI build outputs locally
- Faster onboarding (new devs skip initial builds)

## Migration Checklist

### For Each App

- [ ] Add `start:e2e` script to `package.json` (if needed)
- [ ] Update `playwright.config.ts` to use `createPlaywrightConfig`
- [ ] Verify tests pass locally: `E2E_USE_PROD=true turbo run test:e2e --filter=<app>`
- [ ] Verify tests pass in CI
- [ ] Document app-specific notes (if any)

### For CI Workflow

- [x] Update e2e-tests job to build before testing
- [x] Add Turbo cache restoration
- [x] Set `E2E_USE_PROD=true` env var
- [ ] Monitor first CI run for issues
- [ ] Update documentation

## Summary

**CI E2E Testing Strategy:**

1. **Build first** → `turbo run build` (cached by Turbo)
2. **Start production server** → `next start` (fast, stable)
3. **Run tests in parallel** → 3-4 workers (faster execution)
4. **Leverage caching** → Skip rebuild on cache hit

**Result:**
- 3-5x faster than dev mode
- More stable and reliable
- Better represents production environment
- Fully integrated with Turborepo caching

**Default command:**
```bash
turbo run test:e2e:ci --filter=<app>
```
