import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "post_booking_email_deliveries_tenant_user_timeslot_send_timing_idx";

    CREATE UNIQUE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_send_timing_idx"
      ON "post_booking_email_deliveries" USING btree (
        "tenant_id",
        "user_id",
        "timeslot_id",
        "event_type_id",
        "send_timing"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_send_timing_idx";

    CREATE UNIQUE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_user_timeslot_send_timing_idx"
      ON "post_booking_email_deliveries" USING btree ("tenant_id", "user_id", "timeslot_id", "send_timing");
  `)
}
