import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Courses feature: courses + course-enrollments tables, allowedCourses / allowedEventTypes rels,
 * and bookings.course_enrollment_id_used.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'open', 'closed', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_courses_duration_unit" AS ENUM('days', 'weeks');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_course_enrollments_status" AS ENUM('active', 'cancelled', 'completed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "courses" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "about" varchar,
      "start_date" timestamp(3) with time zone,
      "end_date" timestamp(3) with time zone,
      "duration_length" numeric,
      "duration_unit" "enum_courses_duration_unit" DEFAULT 'weeks',
      "max_enrollments" numeric,
      "stripe_product_id" varchar,
      "price_information_price" numeric,
      "status" "enum_courses_status" DEFAULT 'draft' NOT NULL,
      "tenant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "courses_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "event_types_id" integer
    );

    CREATE TABLE IF NOT EXISTS "course_enrollments" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "course_id" integer NOT NULL,
      "status" "enum_course_enrollments_status" DEFAULT 'active' NOT NULL,
      "purchased_at" timestamp(3) with time zone NOT NULL,
      "access_starts_at" timestamp(3) with time zone NOT NULL,
      "access_ends_at" timestamp(3) with time zone NOT NULL,
      "transaction_id" varchar,
      "tenant_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "courses"
        ADD CONSTRAINT "courses_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "courses_rels"
        ADD CONSTRAINT "courses_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "courses_rels"
        ADD CONSTRAINT "courses_rels_event_types_fk"
        FOREIGN KEY ("event_types_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_enrollments"
        ADD CONSTRAINT "course_enrollments_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_enrollments"
        ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk"
        FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      ALTER TABLE "course_enrollments"
        ADD CONSTRAINT "course_enrollments_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "courses_slug_idx" ON "courses" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "courses_tenant_idx" ON "courses" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "courses_created_at_idx" ON "courses" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "courses_rels_order_idx" ON "courses_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "courses_rels_parent_idx" ON "courses_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "courses_rels_path_idx" ON "courses_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "courses_rels_event_types_id_idx" ON "courses_rels" USING btree ("event_types_id");
    CREATE INDEX IF NOT EXISTS "course_enrollments_user_idx" ON "course_enrollments" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "course_enrollments_course_idx" ON "course_enrollments" USING btree ("course_id");
    CREATE INDEX IF NOT EXISTS "course_enrollments_tenant_idx" ON "course_enrollments" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "course_enrollments_updated_at_idx" ON "course_enrollments" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "course_enrollments_created_at_idx" ON "course_enrollments" USING btree ("created_at");
  `)

  await db.execute(sql`
    ALTER TABLE "event_types_rels" ADD COLUMN IF NOT EXISTS "courses_id" integer;
    DO $$ BEGIN
      ALTER TABLE "event_types_rels"
        ADD CONSTRAINT "event_types_rels_courses_fk"
        FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "event_types_rels_courses_id_idx" ON "event_types_rels" USING btree ("courses_id");

    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "course_enrollment_id_used" integer;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "courses_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "course_enrollments_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_courses_fk"
        FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_course_enrollments_fk"
        FOREIGN KEY ("course_enrollments_id") REFERENCES "public"."course_enrollments"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_courses_id_idx"
      ON "payload_locked_documents_rels" USING btree ("courses_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_course_enrollments_id_idx"
      ON "payload_locked_documents_rels" USING btree ("course_enrollments_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_course_enrollments_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_courses_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_course_enrollments_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_courses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "course_enrollments_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "courses_id";

    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "course_enrollment_id_used";

    ALTER TABLE "event_types_rels" DROP CONSTRAINT IF EXISTS "event_types_rels_courses_fk";
    DROP INDEX IF EXISTS "event_types_rels_courses_id_idx";
    ALTER TABLE "event_types_rels" DROP COLUMN IF EXISTS "courses_id";

    DROP TABLE IF EXISTS "course_enrollments" CASCADE;
    DROP TABLE IF EXISTS "courses_rels" CASCADE;
    DROP TABLE IF EXISTS "courses" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_course_enrollments_status";
    DROP TYPE IF EXISTS "public"."enum_courses_duration_unit";
    DROP TYPE IF EXISTS "public"."enum_courses_status";
  `)
}
