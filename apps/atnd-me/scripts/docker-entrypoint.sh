#!/bin/sh
set -e

# Optional: run Payload migrations before starting the app.
# The Next.js standalone image does not include the Payload CLI or app config,
# so migrations are not run automatically. Run them as a one-off in Coolify
# (e.g. "Run Command" with: pnpm payload migrate run) or use a separate job.
# See apps/atnd-me/DEPLOYMENT.md for details.

exec "$@"
