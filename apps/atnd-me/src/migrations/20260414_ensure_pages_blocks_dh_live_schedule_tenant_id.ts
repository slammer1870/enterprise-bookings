import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * `20260409_152419` used `CREATE TABLE IF NOT EXISTS` for `pages_blocks_dh_live_schedule`.
 * If the table already existed (e.g. from an earlier schema push) without `tenant_id`,
 * that migration was a no-op for the table body and Payload + multi-tenant then fail
 * selecting `tenant_id`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pages_blocks_dh_live_schedule'
      ) THEN
        ALTER TABLE "public"."pages_blocks_dh_live_schedule"
        ADD COLUMN IF NOT EXISTS "tenant_id" numeric;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_pages_v_blocks_dh_live_schedule'
      ) THEN
        ALTER TABLE "public"."_pages_v_blocks_dh_live_schedule"
        ADD COLUMN IF NOT EXISTS "tenant_id" numeric;
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Repair migration: dropping columns could break a DB already aligned with Payload.
}
