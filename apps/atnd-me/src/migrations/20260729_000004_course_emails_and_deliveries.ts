import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Course emails array on courses + course-email-deliveries + sendCourseEmail job enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_courses_course_emails_send_timing" AS ENUM(
        'after_purchase',
        'one_week_before_start',
        'one_day_before_start',
        'one_day_after_start',
        'one_day_before_end',
        'one_day_after_end'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "courses_course_emails" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "cc" varchar,
      "bcc" varchar,
      "reply_to" varchar,
      "email_from" varchar,
      "subject" varchar NOT NULL,
      "message" jsonb,
      "send_timing" "enum_courses_course_emails_send_timing" DEFAULT 'after_purchase' NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "courses_course_emails"
        ADD CONSTRAINT "courses_course_emails_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "courses_course_emails_order_idx"
      ON "courses_course_emails" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "courses_course_emails_parent_id_idx"
      ON "courses_course_emails" USING btree ("_parent_id");

    DO $$ BEGIN
      CREATE TYPE "public"."enum_course_email_deliveries_send_timing" AS ENUM(
        'after_purchase',
        'one_week_before_start',
        'one_day_before_start',
        'one_day_after_start',
        'one_day_before_end',
        'one_day_after_end'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_course_email_deliveries_status" AS ENUM(
        'scheduled',
        'sent',
        'cancelled'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "course_email_deliveries" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "user_id" integer NOT NULL,
      "enrollment_id" integer NOT NULL,
      "course_id" integer NOT NULL,
      "email_config_id" varchar NOT NULL,
      "send_timing" "enum_course_email_deliveries_send_timing" NOT NULL,
      "status" "enum_course_email_deliveries_status" DEFAULT 'scheduled' NOT NULL,
      "payload_job_id" numeric,
      "scheduled_for" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "course_email_deliveries"
        ADD CONSTRAINT "course_email_deliveries_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_email_deliveries"
        ADD CONSTRAINT "course_email_deliveries_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_email_deliveries"
        ADD CONSTRAINT "course_email_deliveries_enrollment_id_course_enrollments_id_fk"
        FOREIGN KEY ("enrollment_id") REFERENCES "public"."course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_email_deliveries"
        ADD CONSTRAINT "course_email_deliveries_course_id_courses_id_fk"
        FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "course_email_deliveries_tenant_user_enrollment_course_email_c_idx"
      ON "course_email_deliveries" USING btree (
        "tenant_id",
        "user_id",
        "enrollment_id",
        "course_id",
        "email_config_id"
      );

    CREATE INDEX IF NOT EXISTS "course_email_deliveries_user_idx"
      ON "course_email_deliveries" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "course_email_deliveries_enrollment_idx"
      ON "course_email_deliveries" USING btree ("enrollment_id");
    CREATE INDEX IF NOT EXISTS "course_email_deliveries_course_idx"
      ON "course_email_deliveries" USING btree ("course_id");
    CREATE INDEX IF NOT EXISTS "course_email_deliveries_tenant_idx"
      ON "course_email_deliveries" USING btree ("tenant_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "course_email_deliveries_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_course_email_deliveries_fk"
        FOREIGN KEY ("course_email_deliveries_id")
        REFERENCES "public"."course_email_deliveries"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_course_email_deliveries_id_idx"
      ON "payload_locked_documents_rels" USING btree ("course_email_deliveries_id");
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'sendCourseEmail'
          AND enumtypid = 'public.enum_payload_jobs_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendCourseEmail';
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'sendCourseEmail'
          AND enumtypid = 'public.enum_payload_jobs_log_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendCourseEmail';
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_course_email_deliveries_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_course_email_deliveries_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "course_email_deliveries_id";

    DROP TABLE IF EXISTS "course_email_deliveries" CASCADE;
    DROP TABLE IF EXISTS "courses_course_emails" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_course_email_deliveries_status";
    DROP TYPE IF EXISTS "public"."enum_course_email_deliveries_send_timing";
    DROP TYPE IF EXISTS "public"."enum_courses_course_emails_send_timing";
  `)
}
