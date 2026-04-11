#!/usr/bin/env tsx
/**
 * One-off data repair: remap `tenant-admin` → `admin` in `users_role`.
 *
 * Dev schema push (`PAYLOAD_PUSH_SCHEMA=1`) runs before Payload migrations apply on
 * startup, so Drizzle can fail with:
 *   invalid input value for enum enum_users_role: "tenant-admin"
 *
 * Run this against DATABASE_URI first (no Payload init), then retry dev / push:
 *   pnpm exec tsx scripts/fix-users-role-tenant-admin.ts
 *
 * Equivalent: `pnpm payload migrate run` (applies `20260412_users_role_tenant_admin_to_admin`)
 * when migrations run without going through a failing push first.
 */
import 'dotenv/config'
import { Pool } from 'pg'

async function main() {
  const uri = process.env.DATABASE_URI
  if (!uri?.trim()) {
    console.error('❌ DATABASE_URI is required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: uri })
  try {
    const res = await pool.query(`
      DO $do$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users_role'
        ) THEN
          UPDATE "users_role" SET "value" = 'admin'::"public"."enum_users_role"
          WHERE "value"::text = 'tenant-admin';
        END IF;
      END $do$;
    `)
    console.log('✅ users_role repair executed (tenant-admin → admin where applicable).')
    if (process.env.DEBUG) console.debug(res)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
