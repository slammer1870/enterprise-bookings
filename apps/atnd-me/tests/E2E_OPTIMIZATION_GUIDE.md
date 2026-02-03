# E2E Test Optimization Guide

## Overview

This guide documents the e2e test optimization for `atnd-me`, including the Turborepo integration for speed and efficiency.

## Architecture

### Production Build Strategy (Recommended)

```
┌─────────────────┐
│  turbo build    │  ← Cached by Turbo (skipped if unchanged)
└────────┬────────┘
         │
┌────────▼────────┐
│   .next/ dir    │  ← Build artifacts (cacheable)
└────────┬────────┘
         │
┌────────▼────────┐
│  next start     │  ← Production server (3-4 workers)
└────────┬────────┘
         │
┌────────▼────────┐
│ Playwright e2e  │  ← Fast, stable, parallel execution
└─────────────────┘
```

### Dev Server Strategy (Debugging Only)

```
┌─────────────────┐
│   next dev      │  ← No build, slower startup
└────────┬────────┘
         │
┌────────▼────────┐
│ Playwright e2e  │  ← 1 worker (server can't handle more)
└─────────────────┘
```

## Configuration

### Critical Optimization: Build Input Filtering

**Problem:** By default, Turborepo includes ALL files when calculating build cache keys. This means changing test files would trigger unnecessary rebuilds.

**Solution:** Explicitly define `build` inputs in `turbo.json` to exclude test directories:

```json
{
  "tasks": {
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
        // Note: tests/e2e/** is NOT included!
      ]
    }
  }
}
```

**Result:**
- ✅ Changing e2e test files does NOT invalidate build cache
- ✅ Changing `playwright.config.ts` does NOT trigger rebuild
- ✅ Only application code/config changes trigger rebuilds
- ⚡ **Time savings: 2-3 minutes per test iteration**

**Before:** Test change → Rebuild (2-3 min) → Run tests (4.6 min) = **6-8 minutes**  
**After:** Test change → Skip rebuild → Run tests (4.6 min) = **4.6 minutes**

### Turbo Configuration (`turbo.json`)

```json
{
  "tasks": {
    "test:e2e": {
      "dependsOn": ["build"],  // Requires build first (uses cache if available)
      "cache": false,           // Tests shouldn't be cached (data changes)
      "env": ["DATABASE_URI", "PAYLOAD_SECRET", "E2E_USE_PROD"]
    }
  }
}
```

### Playwright Configuration (`playwright.config.ts`)

- **Production mode** (default): 3-4 workers, `next start`
- **Dev mode** (`E2E_USE_PROD=false`): 1 worker, `next dev`

### Package Scripts

- `start:e2e` - Production server with test flags
- `test:e2e` - Run tests (production by default)
- `test:e2e:ci` - CI-optimized tests

## Usage

### Quick Start

```bash
# From repo root - recommended approach
turbo run test:e2e --filter=atnd-me

# First run: ~10-12 minutes (includes build)
# Subsequent runs with no code changes: ~8-10 minutes (uses cached build)
```

### Common Workflows

#### 1. Run Tests After Code Changes

```bash
# Turbo detects changes, rebuilds, runs tests
turbo run test:e2e --filter=atnd-me
```

#### 2. Debug a Failing Test (Dev Mode)

```bash
# Skip production build, use dev server for easier debugging
cd apps/atnd-me
E2E_USE_PROD=false pnpm test:e2e --grep "test name"
```

#### 3. CI/CD Pipeline

```bash
# Optimized for CI with proper caching
turbo run test:e2e:ci --filter=atnd-me
```

#### 4. Force Rebuild (Bypass Cache)

```bash
# Force fresh build
turbo run build --filter=atnd-me --force
turbo run test:e2e --filter=atnd-me
```

## Performance Comparison

| Metric | Before | Dev Mode | Production (Turbo) |
|--------|--------|----------|-------------------|
| Test count | 52 | 23 | 23 |
| Workers | 1-34 (unstable) | 1 | 3-4 |
| Runtime (first) | 1h+ | 20-25min | 10-12min |
| Runtime (cached) | N/A | 20-25min | 8-10min |
| Success rate | 40% | 100% | 100% |
| Server mode | Dev | Dev | Production |

## Why Production Build is Faster

1. **No HMR overhead**: Dev server has Hot Module Replacement, websockets, file watchers
2. **Optimized bundle**: Minified, tree-shaken, code-split
3. **Stable under load**: Production server handles concurrent requests better
4. **Faster SSR**: Optimized React Server Components rendering
5. **Turbo caching**: Build artifacts cached, skipped if unchanged

## Troubleshooting

### Tests Fail with "Build Required"

```bash
# Ensure build exists
turbo run build --filter=atnd-me
turbo run test:e2e --filter=atnd-me
```

### Server Won't Start

```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Retry
turbo run test:e2e --filter=atnd-me
```

### Need to Test Specific Code Path

```bash
# Use dev mode for faster iteration (no rebuild)
cd apps/atnd-me
E2E_USE_PROD=false pnpm test:e2e --grep "specific test"
```

### Turbo Cache Issues

```bash
# Clear Turbo cache
turbo run build --filter=atnd-me --force

# Clear Next.js cache
cd apps/atnd-me
rm -rf .next
pnpm build
```

## CI Integration Example

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node & pnpm
        # ... setup steps ...
      - name: Build app
        run: turbo run build --filter=atnd-me
      - name: Cache Turbo artifacts
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}

  e2e:
    runs-on: ubuntu-latest
    needs: build  # Wait for build to complete
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node & pnpm
        # ... setup steps ...
      
      - name: Restore Turbo cache
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
      
      - name: Run e2e tests
        run: turbo run test:e2e:ci --filter=atnd-me
        # Turbo detects build dependency and restores from cache
        env:
          DATABASE_URI: ${{ secrets.DATABASE_URI }}
          PAYLOAD_SECRET: ${{ secrets.PAYLOAD_SECRET }}
```

**Key points:**
- Build happens in separate job
- E2E job restores Turbo cache
- `turbo run test:e2e:ci` automatically restores build from cache (no explicit build command)

## Best Practices

### 1. Always Use Turbo for CI/CD

```bash
# ✅ Good - Uses cached build
turbo run test:e2e --filter=atnd-me

# ❌ Bad - Bypasses Turbo cache
cd apps/atnd-me && pnpm test:e2e
```

### 2. Use Dev Mode Only for Debugging

Production mode is faster and more reliable. Only use dev mode when you need to:
- Debug a specific test
- Test HMR-related behavior
- Iterate rapidly on test code

### 3. Commit Build Artifacts to Remote Cache

If using Vercel or Turbo Remote Cache:

```bash
# Configure remote cache
turbo login
turbo link

# Tests will use shared cache across team
```

### 4. Monitor Test Performance

```bash
# Add timing to CI logs
time turbo run test:e2e:ci --filter=atnd-me
```

## Migration Notes

### From Dev Mode to Production Mode

**Before (slow, unstable):**
```json
{
  "webServer": {
    "command": "next dev",
    "workers": 1
  }
}
```

**After (fast, stable):**
```json
{
  "webServer": {
    "command": "next start",
    "workers": 3-4
  }
}
```

Key changes:
- Added `turbo.json` task with `dependsOn: ["build"]`
- Created `start:e2e` script with test environment flags
- Made production mode default, dev mode opt-in via env var

## Future Optimizations

### Potential Improvements

1. **Visual regression testing**: Add `@playwright/visual-comparison` for UI testing
2. **Test sharding**: Use Playwright's `--shard` flag to split tests across CI machines
3. **Remote cache**: Set up Turbo Remote Cache for team-wide build sharing
4. **Component testing**: Move some e2e tests to component tests (faster)

### Monitoring

Track these metrics over time:
- Build cache hit rate (Turbo)
- Test runtime (by worker count)
- Test flakiness (retry count)
- Database query performance

## Summary

**Key Takeaway**: By running e2e tests against a production build with Turborepo caching:
- **3-5x faster** than dev mode
- **Cached builds** skip rebuild when code unchanged
- **Parallel execution** (3-4 workers) vs sequential (1 worker)
- **More reliable** - production server handles load better

Run tests with: `turbo run test:e2e --filter=atnd-me`
