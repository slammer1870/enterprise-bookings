import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_event_types_post_booking_email_send_timing" AS ENUM(
        'after_all_bookings',
        'after_first_booking',
        'next_day_after_first_booking'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "event_types"
      ADD COLUMN IF NOT EXISTS "post_booking_email_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "post_booking_email_subject" varchar,
      ADD COLUMN IF NOT EXISTS "post_booking_email_body" jsonb,
      ADD COLUMN IF NOT EXISTS "post_booking_email_send_timing" "enum_event_types_post_booking_email_send_timing" DEFAULT 'after_all_bookings';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "event_types"
      DROP COLUMN IF EXISTS "post_booking_email_send_timing",
      DROP COLUMN IF EXISTS "post_booking_email_body",
      DROP COLUMN IF EXISTS "post_booking_email_subject",
      DROP COLUMN IF EXISTS "post_booking_email_enabled";

    DROP TYPE IF EXISTS "public"."enum_event_types_post_booking_email_send_timing";
  `)
}
