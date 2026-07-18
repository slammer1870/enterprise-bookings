#!/usr/bin/env bash
# Mirrors GitHub Actions CI stages locally with streaming Turbo/Vitest output.
set -euo pipefail

cd "$(dirname "$0")/.."

# Shared CI env (matches GitHub Actions where applicable).
export PAYLOAD_SECRET="${PAYLOAD_SECRET:-test-secret-key-for-ci-builds-only}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_1234567890}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-pk_test_1234567890}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_1234567890}"
export PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY="${PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY:-true}"
export RESEND_API_KEY="${RESEND_API_KEY:-resend_api_key_1234567890}"
export ENABLE_TEST_MAGIC_LINKS="${ENABLE_TEST_MAGIC_LINKS:-true}"
export NEXT_PUBLIC_SERVER_URL="${NEXT_PUBLIC_SERVER_URL:-http://localhost:3000}"
export CI=true
export E2E_USE_PROD=true
export PW_E2E_SKIP_WEBSERVER_MIGRATE=true
export PW_E2E_MAX_FAILURES=0
export PW_E2E_SKIP_DEFAULT_TENANT_DATA=true
# Drop stale loader imports from the parent shell — that path is only valid under apps/atnd-me.
if [[ "${NODE_OPTIONS:-}" == *register-payload-auth-loader* ]]; then
  unset NODE_OPTIONS
fi
export NODE_OPTIONS="${NODE_OPTIONS:---no-deprecation --max-old-space-size=6144}"
export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

ATND_ME_DATABASE_URI="${ATND_ME_DATABASE_URI:-postgres://postgres:brugrappling@localhost:5432/e2e_atnd_me}"

stage() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

wait_for_postgres() {
  until pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; do
    echo "Waiting for Postgres on localhost:5432..."
    sleep 2
  done
}

# Package tests use TestContainers when DATABASE_URI is unset (same as CI).
use_atnd_me_db() {
  export DATABASE_URI="$ATND_ME_DATABASE_URI"
  export FORCE_EXISTING_DB=true
}

use_package_test_db() {
  unset DATABASE_URI FORCE_EXISTING_DB
}

stage "0/9  Prerequisites — Postgres + Docker + Playwright browsers"
wait_for_postgres
docker info >/dev/null 2>&1 || {
  echo "Docker is not running. Package tests need TestContainers."
  exit 1
}
# Cursor/agent shells often set PLAYWRIGHT_BROWSERS_PATH to a sandbox cache that may
# not contain browsers yet; install chromium there (or the default cache) before e2e.
pnpm --filter atnd-me exec playwright install chromium

stage "1/9  quality — lint + check-types (@repo/*)"
use_package_test_db
pnpm ci:quality

stage "2/9  unit-tests — atnd-me unit (verbose)"
use_package_test_db
pnpm test:verbose:unit:atnd-me

stage "3/9  package-tests — all packages (verbose, TestContainers)"
use_package_test_db
pnpm test:verbose:packages

stage "4/9  atnd-me-db — migrate:fresh"
use_atnd_me_db
pnpm ci:atnd-me:db

stage "5/9  int-tests — atnd-me 8 shards (verbose)"
use_atnd_me_db
pnpm test:verbose:int:atnd-me:all-shards

# GitHub CI restores a fresh migrate dump for e2e; locally int tests share the same DB
# and can leave globals (e.g. platform-fees) dirty. Reset before e2e.
stage "6/9  atnd-me-db — migrate:fresh (reset after int)"
use_atnd_me_db
pnpm ci:atnd-me:db

stage "7/9  e2e-build — atnd-me production build"
use_atnd_me_db
export E2E_DISABLE_STANDALONE=true
pnpm ci:atnd-me:build

stage "8/9  e2e-tests — atnd-me 4 shards"
use_atnd_me_db
export E2E_USE_NEXT_START=true
for s in 1 2 3 4; do
  echo ""
  echo "========== E2E SHARD $s/4 =========="
  PLAYWRIGHT_SHARD=$s/4 pnpm ci:atnd-me:e2e
done

stage "9/9  Done"
echo "✅ Full local CI parity run finished successfully"
