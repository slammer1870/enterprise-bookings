# E2E Testing Quick Reference

## 🚀 Quick Start

```bash
# Run e2e tests for any app (production build, Turbo-cached)
turbo run test:e2e --filter=<app-name>

# Examples:
turbo run test:e2e --filter=atnd-me        # ~8-12 min (3 workers)
turbo run test:e2e --filter=kyuzo          # ~10-15 min (3 workers)
turbo run test:e2e --filter=bru-grappling  # ~6-8 min (4 workers)

# Run all e2e tests across all apps
turbo run test:e2e
```

## 📊 Performance at a Glance

| Mode | Workers | Runtime | Use Case |
|------|---------|---------|----------|
| **Production (Turbo)** | 3-4 | ~8-12min | ✅ Default, CI/CD |
| Dev Mode | 1 | ~20-25min | Debugging only |
| Before optimization | Unstable | 1h+ (failures) | ❌ Legacy |

## 🔧 Common Commands

```bash
# Production mode (default, recommended)
turbo run test:e2e --filter=atnd-me

# CI mode
turbo run test:e2e:ci --filter=atnd-me

# Dev mode (debugging only)
cd apps/atnd-me
E2E_USE_PROD=false pnpm test:e2e

# Specific test
E2E_USE_PROD=false pnpm test:e2e --grep "test name"

# Force rebuild (bypass cache)
turbo run build --filter=atnd-me --force
turbo run test:e2e --filter=atnd-me
```

## 🎯 When to Use Each Mode

### Production Mode (Default)
✅ CI/CD pipelines  
✅ Pre-commit testing  
✅ Regression testing  
✅ Performance testing

### Dev Mode (`E2E_USE_PROD=false`)
✅ Debugging specific test failures  
✅ Testing dev-only features (HMR, etc)  
✅ Rapid test development

## 💡 Key Benefits

**Turborepo Integration:**
- 🔄 **Cached builds** - Skip rebuild if code unchanged
- ⚡ **3x faster** - Production build more efficient
- 🔀 **Parallel execution** - 3-4 workers vs 1
- 🎯 **More stable** - No dev server overload

**Test Suite Optimization:**
- 📉 **56% fewer tests** - Removed redundant/trivial tests (52 → 23)
- ✅ **100% pass rate** - Eliminated flaky tests
- 🎨 **Better coverage** - Focus on critical user flows

## 🐛 Troubleshooting

```bash
# Port 3000 in use
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
cd apps/atnd-me && rm -rf .next

# Clear Turbo cache
turbo run build --filter=atnd-me --force

# Check Playwright browsers installed
pnpm exec playwright install chromium
```

## 📝 Test Coverage

**23 tests across 8 spec files:**
- ✅ Homepage & tenant routing (4 tests)
- ✅ Checkout flows (pay-at-door, Stripe, class-pass) (7 tests)
- ✅ Multi-booking management (6 tests)
- ✅ Admin panel access & Stripe Connect (6 tests)

## 🔗 Related Docs

- Full guide: `apps/atnd-me/tests/E2E_OPTIMIZATION_GUIDE.md`
- Test documentation: `apps/atnd-me/tests/README.md`
- Turborepo config: `turbo.json`
- Playwright config: `apps/atnd-me/playwright.config.ts`

---

**Default command to remember:**
```bash
turbo run test:e2e --filter=atnd-me
```
