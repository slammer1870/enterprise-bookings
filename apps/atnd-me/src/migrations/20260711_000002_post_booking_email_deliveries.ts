import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_post_booking_email_deliveries_send_timing" AS ENUM(
        'after_all_bookings',
        'after_first_booking',
        'next_day_after_first_booking'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_post_booking_email_deliveries_status" AS ENUM('scheduled', 'sent');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "post_booking_email_deliveries" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "user_id" integer NOT NULL,
      "timeslot_id" integer NOT NULL,
      "event_type_id" integer NOT NULL,
      "send_timing" "enum_post_booking_email_deliveries_send_timing" NOT NULL,
      "status" "enum_post_booking_email_deliveries_status" DEFAULT 'scheduled' NOT NULL,
      "scheduled_for" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "trigger_booking_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "post_booking_email_deliveries"
        ADD CONSTRAINT "post_booking_email_deliveries_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "post_booking_email_deliveries"
        ADD CONSTRAINT "post_booking_email_deliveries_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "post_booking_email_deliveries"
        ADD CONSTRAINT "post_booking_email_deliveries_timeslot_id_timeslots_id_fk"
        FOREIGN KEY ("timeslot_id") REFERENCES "public"."timeslots"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "post_booking_email_deliveries"
        ADD CONSTRAINT "post_booking_email_deliveries_event_type_id_event_types_id_fk"
        FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "post_booking_email_deliveries"
        ADD CONSTRAINT "post_booking_email_deliveries_trigger_booking_id_bookings_id_fk"
        FOREIGN KEY ("trigger_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_idx"
      ON "post_booking_email_deliveries" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "post_booking_email_deliveries_user_idx"
      ON "post_booking_email_deliveries" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "post_booking_email_deliveries_timeslot_idx"
      ON "post_booking_email_deliveries" USING btree ("timeslot_id");
    CREATE INDEX IF NOT EXISTS "post_booking_email_deliveries_updated_at_idx"
      ON "post_booking_email_deliveries" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "post_booking_email_deliveries_created_at_idx"
      ON "post_booking_email_deliveries" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "post_booking_email_deliveries_tenant_user_timeslot_send_timing_idx"
      ON "post_booking_email_deliveries" USING btree ("tenant_id", "user_id", "timeslot_id", "send_timing");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "post_booking_email_deliveries_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_post_booking_email_deliveries_fk"
        FOREIGN KEY ("post_booking_email_deliveries_id")
        REFERENCES "public"."post_booking_email_deliveries"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_post_booking_email_deliveries_id_idx"
      ON "payload_locked_documents_rels" USING btree ("post_booking_email_deliveries_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_post_booking_email_deliveries_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_post_booking_email_deliveries_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "post_booking_email_deliveries_id";

    DROP TABLE IF EXISTS "post_booking_email_deliveries" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_post_booking_email_deliveries_status";
    DROP TYPE IF EXISTS "public"."enum_post_booking_email_deliveries_send_timing";
  `)
}
