import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "event_types_post_booking_emails" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "email_to" varchar,
      "cc" varchar,
      "bcc" varchar,
      "reply_to" varchar,
      "email_from" varchar,
      "subject" varchar NOT NULL,
      "message" jsonb,
      "send_timing" "enum_event_types_post_booking_email_send_timing" NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "event_types_post_booking_emails"
        ADD CONSTRAINT "event_types_post_booking_emails_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "event_types_post_booking_emails_order_idx"
      ON "event_types_post_booking_emails" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "event_types_post_booking_emails_parent_id_idx"
      ON "event_types_post_booking_emails" USING btree ("_parent_id");

    INSERT INTO "event_types_post_booking_emails" (
      "_order",
      "_parent_id",
      "id",
      "subject",
      "message",
      "send_timing"
    )
    SELECT
      0,
      "id",
      md5(random()::text || clock_timestamp()::text),
      "post_booking_email_subject",
      "post_booking_email_body",
      "post_booking_email_send_timing"
    FROM "event_types"
    WHERE "post_booking_email_enabled" = true
      AND "post_booking_email_subject" IS NOT NULL
      AND "post_booking_email_send_timing" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "event_types_post_booking_emails"
        WHERE "_parent_id" = "event_types"."id"
      );

    ALTER TABLE "event_types"
      DROP COLUMN IF EXISTS "post_booking_email_enabled",
      DROP COLUMN IF EXISTS "post_booking_email_subject",
      DROP COLUMN IF EXISTS "post_booking_email_body",
      DROP COLUMN IF EXISTS "post_booking_email_send_timing";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "event_types"
      ADD COLUMN IF NOT EXISTS "post_booking_email_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "post_booking_email_subject" varchar,
      ADD COLUMN IF NOT EXISTS "post_booking_email_body" jsonb,
      ADD COLUMN IF NOT EXISTS "post_booking_email_send_timing" "enum_event_types_post_booking_email_send_timing" DEFAULT 'after_all_bookings';

    UPDATE "event_types" AS et
    SET
      "post_booking_email_enabled" = true,
      "post_booking_email_subject" = pbe."subject",
      "post_booking_email_body" = pbe."message",
      "post_booking_email_send_timing" = pbe."send_timing"
    FROM "event_types_post_booking_emails" AS pbe
    WHERE pbe."_parent_id" = et."id"
      AND pbe."_order" = 0;

    DROP TABLE IF EXISTS "event_types_post_booking_emails" CASCADE;
  `)
}
