# Turborepo Build Cache Optimization

## The Problem

By default, Turborepo uses `$TURBO_DEFAULT$` for the `build` task's inputs, which includes **ALL files in the workspace**. This means:

```
❌ Before Optimization:
┌──────────────────────────────────────┐
│ Edit test file:                      │
│ tests/e2e/admin-panel.spec.ts        │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ Turbo detects input change           │
│ → Invalidates build cache            │
│ → Rebuilds entire app (2-3 min) ❌   │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ Runs e2e tests (4.6 min)             │
└──────────────────────────────────────┘
Total: 6-8 minutes per test iteration
```

This is wasteful because **test changes don't affect the build output**!

## The Solution

Explicitly define `build` task inputs to exclude test directories:

```json
// turbo.json
{
  "tasks": {
    "build": {
      "inputs": [
        "src/**",           // Application source code
        "public/**",        // Static assets
        "package.json",     // Dependencies
        "tsconfig*.json",   // TypeScript configuration
        "next.config.*",    // Next.js configuration
        "tailwind.config.*",// Tailwind configuration
        ".env*",            // Environment variables
        "!src/**/*.test.*", // Exclude unit tests
        "!src/**/*.spec.*"  // Exclude test specs
      ]
      // Notably MISSING:
      // - tests/e2e/**
      // - tests/int/**
      // - playwright.config.ts
      // - vitest.config.ts
    }
  }
}
```

## The Result

```
✅ After Optimization:
┌──────────────────────────────────────┐
│ Edit test file:                      │
│ tests/e2e/admin-panel.spec.ts        │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ Turbo checks build inputs            │
│ → No application files changed       │
│ → Uses cached build (< 5 sec) ✅     │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ Runs e2e tests (4.6 min)             │
└──────────────────────────────────────┘
Total: 4.6 minutes per test iteration
```

**Time savings: 2-3 minutes per iteration!**

## When Build WILL Rebuild

The build cache is invalidated (rebuild triggered) when:

| File Changed | Rebuilds? | Why? |
|--------------|-----------|------|
| `src/app/page.tsx` | ✅ Yes | Application source code |
| `src/components/Button.tsx` | ✅ Yes | Application source code |
| `package.json` | ✅ Yes | Dependencies changed |
| `next.config.js` | ✅ Yes | Build configuration |
| `tsconfig.json` | ✅ Yes | TypeScript settings |
| `.env.local` | ✅ Yes | Environment variables |
| `public/logo.png` | ✅ Yes | Static assets |

## When Build WON'T Rebuild (Cache Preserved)

| File Changed | Rebuilds? | Why Not? |
|--------------|-----------|----------|
| `tests/e2e/admin.spec.ts` | ❌ No | Not in build inputs |
| `tests/int/api.test.ts` | ❌ No | Not in build inputs |
| `playwright.config.ts` | ❌ No | Not in build inputs |
| `vitest.config.ts` | ❌ No | Not in build inputs |
| `tests/README.md` | ❌ No | Not in build inputs |
| `src/app/page.test.tsx` | ❌ No | Excluded by `!**/*.test.*` |

## Practical Impact

### Developer Workflow (Local)

**Typical TDD cycle:**

1. Write failing test → Run e2e → **4.6 min** (uses cached build)
2. Fix application code → Run e2e → **6-8 min** (rebuilds, then tests)
3. Adjust test assertion → Run e2e → **4.6 min** (uses cached build)
4. Refactor test helper → Run e2e → **4.6 min** (uses cached build)
5. Add new test case → Run e2e → **4.6 min** (uses cached build)

**Result:** Most iterations take 4.6 min instead of 6-8 min!

### CI Workflow

**Scenario: PR with only test changes**

```yaml
# Before optimization:
- Build job: 2-3 min (full rebuild)
- E2E job: 4.6 min
Total: 6-8 min

# After optimization:
- Build job: < 5 sec (cache hit)
- E2E job: 4.6 min
Total: ~5 min
```

**Scenario: PR with app + test changes**

```yaml
# Both before and after:
- Build job: 2-3 min (needed rebuild)
- E2E job: 4.6 min
Total: 6-8 min
```

The optimization only helps when tests change without app changes, but that's **very common**!

## Verification

To verify the optimization is working:

```bash
# 1. Run e2e tests (will build)
turbo run test:e2e --filter=atnd-me

# 2. Change a test file
echo "// comment" >> tests/e2e/admin-panel.spec.ts

# 3. Run e2e tests again
turbo run test:e2e --filter=atnd-me

# Look for this output:
# atnd-me:build: cache hit, replaying logs [took 123ms]
#                ^^^^^^^^^^  ← Should see cache hit!
```

## Best Practices

### ✅ DO Include in Build Inputs

- All source code directories (`src/**`, `app/**`, `lib/**`)
- Configuration files that affect build output
- Static assets that get bundled
- Dependency manifests (`package.json`, `pnpm-lock.yaml`)
- Environment files that affect build (`.env*`)

### ❌ DON'T Include in Build Inputs

- Test files (`tests/**`, `**/*.test.*`, `**/*.spec.*`)
- Test configuration (`playwright.config.ts`, `vitest.config.ts`, `jest.config.js`)
- Documentation (`*.md`, `docs/**`)
- Development tools (`scripts/**` that don't affect build)
- CI/CD configuration (`.github/**`)

### ⚠️ Edge Cases

**Q: What if my tests import application code?**  
A: That's fine! The application code is in the build inputs, so changes to it will still trigger rebuilds.

**Q: What if I have test utilities in `src/test-utils/`?**  
A: If these utilities are imported by application code, they're included in `src/**`. If they're only used by tests, consider moving them to `tests/`.

**Q: What about Playwright fixtures that seed data?**  
A: Fixture code doesn't affect the build output, so it correctly doesn't trigger rebuilds.

## Summary

**Problem:** Test file changes triggered unnecessary 2-3 min rebuilds  
**Solution:** Explicitly define build inputs to exclude test directories  
**Result:** 2-3 min time savings per test iteration  
**Impact:** Faster TDD cycles, cheaper CI runs, happier developers! 🎉
