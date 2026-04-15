import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Speeds up tenant-scoped Users admin access: DISTINCT user_id for bookings WHERE tenant_id IN (...).
 * Complements existing analytics indexes on (tenant_id, timeslot_id, status).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "bookings_tenant_id_user_id_idx"
      ON "bookings" USING btree ("tenant_id", "user_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "bookings_tenant_id_user_id_idx";
  `)
}
