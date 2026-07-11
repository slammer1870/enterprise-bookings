import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "post_booking_email_deliveries"
      ADD COLUMN IF NOT EXISTS "email_config_id" varchar;

    UPDATE "post_booking_email_deliveries"
    SET "email_config_id" = COALESCE("email_config_id", 'legacy-' || "id"::text)
    WHERE "email_config_id" IS NULL;

    ALTER TABLE "post_booking_email_deliveries"
      ALTER COLUMN "email_config_id" SET NOT NULL;

    DROP INDEX IF EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_send_timing_idx";

    CREATE UNIQUE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_email_config_idx"
      ON "post_booking_email_deliveries" USING btree (
        "tenant_id",
        "user_id",
        "timeslot_id",
        "event_type_id",
        "email_config_id"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_email_config_idx";

    CREATE UNIQUE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_user_timeslot_event_type_send_timing_idx"
      ON "post_booking_email_deliveries" USING btree (
        "tenant_id",
        "user_id",
        "timeslot_id",
        "event_type_id",
        "send_timing"
      );

    ALTER TABLE "post_booking_email_deliveries"
      DROP COLUMN IF EXISTS "email_config_id";
  `)
}
