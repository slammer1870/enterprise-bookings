import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 7 Chunk 12 — Public schedule default location
 *
 * Adds `default_for_schedule` to `locations` so a tenant can optionally configure
 * which location the public schedule should default to when no branch cookie/URL
 * is present.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "locations"
      ADD COLUMN IF NOT EXISTS "default_for_schedule" boolean DEFAULT false;

    CREATE INDEX IF NOT EXISTS "locations_tenant_default_for_schedule_idx"
      ON "locations" USING btree ("tenant_id", "default_for_schedule");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "locations_tenant_default_for_schedule_idx";
    ALTER TABLE "locations"
      DROP COLUMN IF EXISTS "default_for_schedule";
  `)
}

