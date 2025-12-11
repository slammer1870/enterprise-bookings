# E2E Test Performance Optimizations

## Summary of Changes

This document outlines the optimizations made to improve e2e test execution speed.

## Key Optimizations

### 1. Parallel Test Execution
- **Before**: 1 worker on CI (sequential execution)
- **After**: Up to 4 workers (50% of CPU cores, max 4)
- **Impact**: Tests can run in parallel, significantly reducing total execution time

### 2. Reduced Timeouts
- **Test timeout**: 90s → 60s
- **Navigation timeout**: 30s → 20s
- **Action timeout**: 15s → 10s
- **Expect timeout**: 10s → 5s
- **Impact**: Faster failure detection, less time wasted on slow operations

### 3. Faster Load Strategy
- **Before**: `waitUntil: 'load'` (waits for all resources)
- **After**: `waitUntil: 'domcontentloaded'` (waits only for DOM)
- **Impact**: Faster page loads, tests start interacting sooner

### 4. Removed Unnecessary Waits
- **Before**: 244+ `waitForTimeout()` calls across test files
- **After**: Replaced with proper waiting strategies
- **Impact**: Tests wait only when necessary, not arbitrary fixed delays

### 5. Optimized Utility Functions
- **admin-setup.ts**: Removed polling loops, use proper URL waits
- **auth.ts**: Reduced timeouts, faster navigation strategies
- **wait-helpers.ts**: New utility for smart waiting
- **Impact**: Common operations are faster and more reliable

## Expected Performance Improvements

- **Parallel execution**: 2-4x faster (depending on CPU cores)
- **Reduced timeouts**: 20-30% faster failure detection
- **Faster loads**: 10-15% faster page navigation
- **Removed waits**: 15-25% faster test execution

**Total expected improvement: 40-60% faster test execution**

## Best Practices Going Forward

1. **Avoid `waitForTimeout()`**: Use proper waits like `waitForURL()`, `waitForSelector()`, or `waitForLoadState()`
2. **Use `domcontentloaded`**: Only use `load` or `networkidle` when absolutely necessary
3. **Reduce timeouts**: Start with lower timeouts and increase only if needed
4. **Use parallel execution**: Ensure tests are independent and can run in parallel

## Migration Guide

When writing new tests or updating existing ones:

```typescript
// ❌ Bad - arbitrary wait
await page.waitForTimeout(2000)

// ✅ Good - wait for specific condition
await page.waitForURL(/\/admin/, { timeout: 5000 })

// ❌ Bad - slow load strategy
await page.goto('/admin', { waitUntil: 'load' })

// ✅ Good - faster load strategy
await page.goto('/admin', { waitUntil: 'domcontentloaded' })

// ❌ Bad - polling loop
while (condition && attempts < 5) {
  await page.waitForTimeout(1000)
  attempts++
}

// ✅ Good - proper wait
await page.waitForURL(url => !url.includes('/login'), { timeout: 5000 })
```
