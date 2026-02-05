#!/usr/bin/env node
/**
 * Run Payload migrations (for one-off use from host or CI).
 * Usage: from repo root with DATABASE_URI set:
 *   pnpm --filter atnd-me exec node apps/atnd-me/scripts/run-migrate.mjs
 * Or from apps/atnd-me with pnpm install done:
 *   node scripts/run-migrate.mjs
 *
 * In Docker/Coolify, run migrations as a one-off "Run Command" instead;
 * see DEPLOYMENT.md.
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, '..')

const result = spawnSync(
  'pnpm',
  ['exec', 'payload', 'migrate', 'run', '--force-accept-warning'],
  {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
  },
)
process.exit(result.status ?? 1)
