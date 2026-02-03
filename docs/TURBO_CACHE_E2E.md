# How Turbo Cache Works with E2E Tests in CI

## TL;DR

**You asked: "Why rebuild again?"**

**Answer: We don't!** Turbo automatically restores the build from cache. Here's how:

```yaml
# Build Job (runs first)
turbo run build --filter=atnd-me
  → Creates .next/ directory
  → Turbo caches it in .turbo/<hash>/

# E2E Job (runs after)
turbo run test:e2e:ci --filter=atnd-me
  → Turbo sees dependency: test:e2e:ci depends on build
  → Checks cache: FULL TURBO (cache hit!)
  → Restores .next/ from cache (< 5 seconds)
  → Starts next start (uses cached build)
  → Runs tests
```

**No explicit rebuild command needed!** Turbo handles it automatically via the dependency chain.

## The Flow

### 1. Build Job (Per App)

```yaml
jobs:
  build:
    strategy:
      matrix:
        app: [atnd-me, kyuzo, bru-grappling, ...]
    steps:
      - name: Build the project for ${{ matrix.app.name }}
        run: pnpm run ci --filter ${{ matrix.app.name }}
        # Runs: payload migrate:fresh && next build
        
      - name: Cache Turbo artifacts
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
```

**What happens:**
1. Next.js builds the app → `.next/` directory created
2. Turbo saves task output → `.turbo/<task-hash>/` directory
3. GitHub Actions caches `.turbo/` → Saved for later jobs

### 2. E2E Tests Job (Per App)

```yaml
jobs:
  e2e-tests:
    needs: build  # Waits for build job to complete
    strategy:
      matrix:
        app: [atnd-me, kyuzo, ...]
    steps:
      - name: Restore Turbo artifacts
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
        # Restores .turbo/ from build job
        
      - name: Run E2E tests for ${{ matrix.app.name }}
        run: turbo run test:e2e:ci --filter=${{ matrix.app.name }}
```

**What happens when `turbo run test:e2e:ci` executes:**

```
1. Turbo reads turbo.json:
   {
     "test:e2e:ci": {
       "dependsOn": ["build"]  ← Key line!
     }
   }

2. Turbo checks if "build" is in cache:
   - Computes hash of inputs (source files, env vars, etc.)
   - Looks in .turbo/<hash>/
   - ✅ FOUND! (from build job)

3. Turbo restores build outputs:
   - Copies .next/ directory from .turbo/<hash>/ to apps/atnd-me/.next/
   - Takes < 5 seconds (just file copy)

4. Turbo runs test:e2e:ci:
   - Playwright config starts: pnpm start (next start)
   - Next.js finds .next/ directory → Starts immediately
   - Tests run against production build
```

**Key insight:** The `dependsOn: ["build"]` in `turbo.json` tells Turbo to ensure the build exists before running tests. Turbo automatically checks the cache and restores it if found.

## Why This Is Fast

### Without Turbo Cache

```
Build Job:
  next build → 2-3 minutes

E2E Job:
  next build → 2-3 minutes (rebuild!)
  next start → 10 seconds
  tests → 8-10 minutes
  Total: ~13 minutes per app
```

### With Turbo Cache

```
Build Job:
  next build → 2-3 minutes
  Save to .turbo/ → 5 seconds

E2E Job:
  Restore from .turbo/ → 5 seconds (not 2-3 minutes!)
  next start → 10 seconds
  tests → 8-10 minutes
  Total: ~10 minutes per app
```

**Savings: 2-3 minutes per app × 5 apps = 10-15 minutes total**

## Verifying It Works

### Check CI Logs

Look for this in the e2e-tests job output:

```bash
>>> turbo run test:e2e:ci --filter=atnd-me

• Packages in scope: atnd-me
• Running test:e2e:ci in 1 packages
• Remote caching disabled

atnd-me:build: cache hit, replaying logs ✓  ← This means cache worked!
atnd-me:test:e2e:ci: cache miss, executing...

Tasks:    1 successful, 1 total
Cached:   1 cached, 1 total  ← Build was cached!
Time:     8m32s
```

**If cache is working, you'll see:**
- `cache hit, replaying logs` for build task
- `Cached: 1 cached` in summary
- No actual build compilation (no "Compiled successfully" logs)

### If Cache Misses

```bash
atnd-me:build: cache miss, executing...
atnd-me:build: ▲ Next.js 15.1.6
atnd-me:build: - Building...
atnd-me:build: ✓ Compiled successfully
```

**Causes of cache miss:**
- Different commit SHA (expected on new commits)
- Environment variables changed
- Dependencies changed (pnpm-lock.yaml)
- Source files changed

## Configuration Details

### turbo.json

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"],
      "cache": true  ← Build IS cached
    },
    "test:e2e:ci": {
      "dependsOn": ["build"],  ← Requires build first
      "cache": false  ← Tests are NOT cached (data changes)
    }
  }
}
```

**Why `cache: false` for tests?**
- Test results depend on runtime state (database, external APIs)
- Database state changes between runs
- Would give false positives/negatives if cached

**Why `cache: true` for build?**
- Build output is deterministic (same inputs = same outputs)
- Safe to cache and reuse
- Saves 2-3 minutes per build

### Playwright Config

```typescript
// Production mode (CI)
webServer: {
  command: 'pnpm start',  // Uses .next/ from cache
  NODE_ENV: 'production'
}

// Dev mode (local)
webServer: {
  command: 'pnpm dev',    // Builds on-the-fly
  NODE_ENV: 'development'
}
```

## Common Questions

### Q: Do I need to run `turbo run build` before tests in CI?

**A:** No! The build job already did it. Just run `turbo run test:e2e:ci` and Turbo will restore the build from cache.

### Q: What if the build isn't cached?

**A:** Turbo will build it automatically (because of `dependsOn`). But in CI, it should always be cached from the build job.

### Q: Can I force a rebuild?

**A:** Yes, use `--force`:
```bash
turbo run test:e2e:ci --filter=atnd-me --force
```
This bypasses cache and rebuilds everything.

### Q: What if I want to test against a fresh build?

**A:** The cache is per-commit (SHA), so each commit gets a fresh build. If you change code, the hash changes, and Turbo rebuilds.

### Q: How much disk space does the cache use?

**A:** Each build is ~50-200MB depending on app size. GitHub Actions cache limit is 10GB per repo. With 5 apps × ~100MB = ~500MB, you're well within limits.

### Q: Does this work locally?

**A:** Yes! Run:
```bash
turbo run build --filter=atnd-me
turbo run test:e2e --filter=atnd-me
# Second command uses cached build from first
```

## Troubleshooting

### Cache Not Working

**Check:**
1. Is Turbo cache being restored?
   ```yaml
   - name: Restore Turbo artifacts
     uses: actions/cache@v4
   ```

2. Is the cache key correct?
   ```yaml
   key: ${{ runner.os }}-turbo-${{ github.sha }}
   ```

3. Are build outputs configured?
   ```json
   "outputs": [".next/**", "!.next/cache/**"]
   ```

### Build Still Running

If you see build compilation in e2e job logs:

**Cause:** Cache miss (expected on first run or after code changes)

**Fix:** Not a problem! Turbo will build it. Just verify subsequent runs use cache.

### Wrong Build Being Used

**Cause:** GitHub Actions cache restored from different commit

**Fix:** Cache key includes `github.sha`, so each commit gets unique cache. If seeing wrong build, check:
```yaml
key: ${{ runner.os }}-turbo-${{ github.sha }}  # Should include SHA
restore-keys: |
  ${{ runner.os }}-turbo-  # May restore old build as fallback
```

## Summary

**The Magic:**
1. Build job: Creates `.next/` → Turbo caches it
2. E2E job: Runs `turbo run test:e2e:ci`
3. Turbo: Sees `dependsOn: ["build"]` → Checks cache → Restores `.next/`
4. Tests: Run against cached build (no rebuild!)

**Result:**
- No explicit rebuild needed in e2e job
- 2-3 minutes saved per app
- 10-15 minutes saved across all apps
- Same build tested in both jobs (consistency)

**Key Takeaway:** Trust Turbo! It automatically manages the build dependency chain. Just run `turbo run test:e2e:ci` and let Turbo handle the rest.
