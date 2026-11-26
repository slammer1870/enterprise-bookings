#!/usr/bin/env node
/**
 * CI-safe migrate:fresh wrapper.
 *
 * Payload occasionally exits 0 from `migrate:fresh` without logging
 * "Dropping database" / applying migrations, leaving an empty schema.
 * Retry a few times and require `public.tenants` before succeeding.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, '..')
const maxAttempts = Number(process.env.DB_PREPARE_MAX_ATTEMPTS ?? 3)
const databaseUri = process.env.DATABASE_URI

if (!databaseUri) {
  console.error('[db-prepare] DATABASE_URI is required')
  process.exit(1)
}

async function hasTenantsTable() {
  const client = new pg.Client({ connectionString: databaseUri })
  try {
    await client.connect()
    const result = await client.query("SELECT to_regclass('public.tenants') AS reg")
    const reg = result.rows[0]?.reg
    return typeof reg === 'string' && reg.length > 0
  } finally {
    await client.end().catch(() => {})
  }
}

function runMigrateFresh() {
  const nodeOptions = [
    process.env.NODE_OPTIONS,
    '--no-deprecation',
    '--import',
    './scripts/register-payload-auth-loader.mjs',
  ]
    .filter(Boolean)
    .join(' ')

  const result = spawnSync(
    'pnpm',
    ['exec', 'payload', 'migrate:fresh', '--force-accept-warning'],
    {
      cwd: appDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions,
      },
    },
  )
  return result.status ?? 1
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`[db-prepare] migrate:fresh attempt ${attempt}/${maxAttempts}`)
  const status = runMigrateFresh()
  if (status !== 0) {
    console.error(`[db-prepare] migrate:fresh exited ${status}`)
    if (attempt === maxAttempts) process.exit(status)
    continue
  }

  const ok = await hasTenantsTable()
  if (ok) {
    console.log('[db-prepare] public.tenants present — schema ready')
    process.exit(0)
  }

  console.error(
    '[db-prepare] migrate:fresh exited 0 but public.tenants is missing; retrying…',
  )
}

process.exit(1)
