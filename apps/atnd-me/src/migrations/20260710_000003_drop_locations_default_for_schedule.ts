import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Removes `default_for_schedule` from locations. Public schedule picker order and
 * default selection now come from block location config order, or alphabetical.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "locations_tenant_default_for_schedule_idx";
    ALTER TABLE "locations"
      DROP COLUMN IF EXISTS "default_for_schedule";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "locations"
      ADD COLUMN IF NOT EXISTS "default_for_schedule" boolean DEFAULT false;

    CREATE INDEX IF NOT EXISTS "locations_tenant_default_for_schedule_idx"
      ON "locations" USING btree ("tenant_id", "default_for_schedule");
  `)
}
