# E2E Testing Quick Reference

## Quick start

All CI and local test orchestration goes through **Turbo**. Root `ci:*` scripts mirror GitHub Actions jobs.

```bash
# E2E (production build, Turbo-cached)
pnpm ci:atnd-me:build
pnpm ci:atnd-me:e2e

# Or via turbo directly
turbo run test:e2e --filter=atnd-me

# Integration tests (sharded locally)
VITEST_SHARD=1/8 pnpm ci:atnd-me:int

# Unit tests (no DB)
pnpm ci:atnd-me:unit

# Package tests (all or affected)
pnpm ci:packages
pnpm ci:packages:affected
```

## CI architecture (Turbo-first)

| Job | Turbo command | Notes |
|-----|---------------|-------|
| `quality` | `turbo run lint check-types --filter=@repo/*` | Affected on PRs |
| `unit-tests` | `turbo run test:unit --filter=atnd-me` | Always runs |
| `package-tests` | `turbo run test --filter=@repo/* --continue` | Affected on PRs; TestContainers |
| `atnd-me-db` | `turbo run db:prepare --filter=atnd-me` | Single migrate + pg_dump artifact |
| `int-tests` | `turbo run test:int:shard --filter=atnd-me` | 8 shards via `VITEST_SHARD` env |
| `e2e-build` | `turbo run build --filter=atnd-me` | Once per run |
| `e2e-tests` | `turbo run test:e2e:shard --filter=atnd-me` | 4 shards via `PLAYWRIGHT_SHARD` env |

Shard flags are passed via **environment variables** (`VITEST_SHARD`, `PLAYWRIGHT_SHARD`), not CLI args after `--`, so Turbo does not swallow them.

## Performance at a glance

| Mode | Workers | Runtime | Use case |
|------|---------|---------|----------|
| Production (Turbo) | 1–2 | ~8–12 min | Default, CI/CD |
| Dev mode | 1 | ~20–25 min | Debugging only |

## Common commands

```bash
# Production mode (recommended)
turbo run test:e2e --filter=atnd-me

# CI parity (sharded E2E)
PLAYWRIGHT_SHARD=1/4 pnpm ci:atnd-me:e2e

# CI parity (sharded int)
VITEST_SHARD=1/8 pnpm ci:atnd-me:int

# Dev mode (debugging)
cd apps/atnd-me
E2E_USE_PROD=false pnpm test:e2e

# Specific test
E2E_USE_PROD=false pnpm test:e2e --grep "test name"

# Force rebuild
turbo run build --filter=atnd-me --force
```

## Tuning shard counts

Edit workflow env in `.github/workflows/ci.yml`:

- `INT_TEST_SHARD_COUNT` — default `8` (OOM-safe for Payload int suites). Lower to `4` only after benchmarking wall-clock vs memory on CI.
- `E2E_TEST_SHARD_COUNT` — default `4`.

When changing int shard count, update the `int-tests` matrix `shard` list to match.

## Troubleshooting

```bash
# Port 3000 in use
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
cd apps/atnd-me && rm -rf .next

# Clear Turbo cache
turbo run build --filter=atnd-me --force

# Playwright browsers
pnpm exec playwright install chromium
```

## Related docs

- Full guide: `apps/atnd-me/tests/E2E_OPTIMIZATION_GUIDE.md`
- Test documentation: `apps/atnd-me/tests/README.md`
- Turborepo config: `turbo.json`
- Shared test config: `packages/testing-config/src/vitest/README.md`
- CI workflow: `.github/workflows/ci.yml`
- Setup action: `.github/actions/setup-monorepo/action.yml`

**Default command:**

```bash
turbo run test:e2e --filter=atnd-me
```
