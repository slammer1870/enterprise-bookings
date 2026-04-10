import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Compound indexes declared on bookings / timeslots via Payload `indexes` (see plugins/index.ts).
 * Speeds up analytics: confirmed bookings by timeslot (+ tenant) and timeslots by start_time window (+ tenant).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "bookings_timeslot_status_idx"
      ON "bookings" USING btree ("timeslot_id", "status");

    CREATE INDEX IF NOT EXISTS "bookings_tenant_timeslot_status_idx"
      ON "bookings" USING btree ("tenant_id", "timeslot_id", "status");

    CREATE INDEX IF NOT EXISTS "timeslots_start_time_tenant_idx"
      ON "timeslots" USING btree ("start_time", "tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "timeslots_start_time_tenant_idx";
    DROP INDEX IF EXISTS "bookings_tenant_timeslot_status_idx";
    DROP INDEX IF EXISTS "bookings_timeslot_status_idx";
  `)
}
