import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Supporting indexes for confirmed-booking analytics:
 * - tenant + status scopes summary/trend reads
 * - user + status scopes churn and membership usage reads
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "bookings_status_tenant_timeslot_idx"
      ON "bookings" USING btree ("status", "tenant_id", "timeslot_id");

    CREATE INDEX IF NOT EXISTS "bookings_status_user_timeslot_idx"
      ON "bookings" USING btree ("status", "user_id", "timeslot_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "bookings_status_user_timeslot_idx";
    DROP INDEX IF EXISTS "bookings_status_tenant_timeslot_idx";
  `)
}
