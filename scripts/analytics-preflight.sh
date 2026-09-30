#!/usr/bin/env bash
# Runs the full local CI gate with only staging-analytics variables added, then asks for
# manual confirmation in Umami. Normal local CI remains non-interactive and self-contained.
set -euo pipefail

cd "$(dirname "$0")/.."

ANALYTICS_ENV_FILE="apps/atnd-me/.env.analytics-local"
ANALYTICS_DASHBOARD_URL="https://bru.donal.me/websites/59da8e2a-f114-432d-9551-d50f04d4e13a/realtime"

if [[ ! -t 0 ]]; then
  echo "The analytics preflight requires an interactive terminal for dashboard confirmation."
  exit 1
fi

if [[ ! -f "$ANALYTICS_ENV_FILE" ]]; then
  echo "Missing $ANALYTICS_ENV_FILE."
  echo "Copy apps/atnd-me/.env.analytics-local.example to $ANALYTICS_ENV_FILE first."
  exit 1
fi

read_analytics_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
    }
    END {
      sub(/\r$/, "", value)
      print value
    }
  ' "$ANALYTICS_ENV_FILE"
}

UMAMI_SCRIPT_URL="$(read_analytics_value UMAMI_SCRIPT_URL)"
UMAMI_WEBSITE_ID="$(read_analytics_value UMAMI_WEBSITE_ID)"
UMAMI_DOMAINS="$(read_analytics_value UMAMI_DOMAINS)"
NEXT_PUBLIC_APP_ENVIRONMENT="$(read_analytics_value NEXT_PUBLIC_APP_ENVIRONMENT)"

if [[ "$UMAMI_SCRIPT_URL" != "https://bru.donal.me/u.js" ]]; then
  echo "$ANALYTICS_ENV_FILE must point UMAMI_SCRIPT_URL at https://bru.donal.me/u.js"
  exit 1
fi
if [[ "$UMAMI_WEBSITE_ID" != "59da8e2a-f114-432d-9551-d50f04d4e13a" ]]; then
  echo "$ANALYTICS_ENV_FILE must contain the staging UMAMI_WEBSITE_ID"
  exit 1
fi
if [[ "$UMAMI_DOMAINS" != *"*.localhost"* ]]; then
  echo "$ANALYTICS_ENV_FILE must allow *.localhost so tenant E2E traffic reaches Umami"
  exit 1
fi

export UMAMI_SCRIPT_URL UMAMI_WEBSITE_ID UMAMI_DOMAINS
export NEXT_PUBLIC_APP_ENVIRONMENT="${NEXT_PUBLIC_APP_ENVIRONMENT:-local-test}"

bash scripts/ci-local-full.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " analytics — manually confirm real local E2E events"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Open or refresh: $ANALYTICS_DASHBOARD_URL"
echo "Confirm that Realtime/Events shows traffic from localhost or a *.localhost tenant"
echo "and at least one event produced by the browser E2E flows."
echo ""

read -r -p "Are the real local test events visible in Umami? [y/N] " analytics_confirmed
case "$analytics_confirmed" in
  y|Y|yes|Yes|YES) ;;
  *)
    echo "Analytics verification was not confirmed; preflight failed."
    exit 1
    ;;
esac

echo "✅ Analytics deployment preflight finished successfully"
