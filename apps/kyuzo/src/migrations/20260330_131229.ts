import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "instructors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lessons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "booking_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_stripe_customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_week_days_time_slot" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_week_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "instructors" CASCADE;
  DROP TABLE "lessons" CASCADE;
  DROP TABLE "class_options" CASCADE;
  DROP TABLE "class_options_rels" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "bookings_rels" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "booking_transactions" CASCADE;
  DROP TABLE "users_stripe_customers" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "scheduler_week_days_time_slot" CASCADE;
  DROP TABLE "scheduler_week_days" CASCADE;
  DROP TABLE "scheduler" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_parent_user_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_instructors_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lessons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_class_options_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bookings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_transactions_fk";
  
  DROP INDEX IF EXISTS "users_parent_user_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_instructors_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lessons_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_class_options_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bookings_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_subscriptions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_plans_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_booking_transactions_id_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "parent_user_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "instructors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "lessons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "class_options_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bookings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "plans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "booking_transactions_id";
  DROP TYPE "public"."enum_class_options_type";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_plans_sessions_information_interval";
  DROP TYPE "public"."enum_plans_price_information_interval";
  DROP TYPE "public"."enum_plans_status";
  DROP TYPE "public"."enum_plans_type";
  DROP TYPE "public"."enum_booking_transactions_payment_method";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_class_options_type" AS ENUM('adult', 'child');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'waiting');
  CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
  CREATE TYPE "public"."enum_plans_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_plans_price_information_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TYPE "public"."enum_plans_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_plans_type" AS ENUM('adult', 'child');
  CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass', 'subscription');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
  CREATE TABLE "instructors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"name" varchar,
  	"description" varchar,
  	"profile_image_id" integer,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone DEFAULT '2026-03-30T10:50:16.037Z' NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone NOT NULL,
  	"lock_out_time" numeric DEFAULT 0 NOT NULL,
  	"original_lock_out_time" numeric DEFAULT 0,
  	"location" varchar,
  	"instructor_id" integer,
  	"class_option_id" integer NOT NULL,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "class_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"places" numeric NOT NULL,
  	"description" varchar NOT NULL,
  	"type" "enum_class_options_type" DEFAULT 'adult' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "class_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"status" "enum_bookings_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"booking_transactions_id" integer
  );
  
  CREATE TABLE "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"status" "enum_subscriptions_status" DEFAULT 'incomplete' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"cancel_at" timestamp(3) with time zone,
  	"stripe_subscription_id" varchar,
  	"skip_sync" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"sessions_information_sessions" numeric,
  	"sessions_information_interval_count" numeric,
  	"sessions_information_interval" "enum_plans_sessions_information_interval",
  	"sessions_information_allow_multiple_bookings_per_lesson" boolean DEFAULT false NOT NULL,
  	"stripe_product_id" varchar,
  	"price_information_price" numeric,
  	"price_information_interval_count" numeric,
  	"price_information_interval" "enum_plans_price_information_interval" DEFAULT 'month',
  	"price_j_s_o_n" varchar,
  	"status" "enum_plans_status" DEFAULT 'active' NOT NULL,
  	"skip_sync" boolean DEFAULT false,
  	"type" "enum_plans_type" DEFAULT 'adult',
  	"quantity" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "booking_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"booking_id" integer NOT NULL,
  	"payment_method" "enum_booking_transactions_payment_method" NOT NULL,
  	"class_pass_id" numeric,
  	"stripe_payment_intent_id" varchar,
  	"subscription_id" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_stripe_customers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"stripe_account_id" varchar NOT NULL,
  	"stripe_customer_id" varchar NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scheduler_week_days_time_slot" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2026-03-30T10:50:16.167Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2026-03-30T10:50:16.167Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "scheduler_week_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "scheduler" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"lock_out_time" numeric DEFAULT 0 NOT NULL,
  	"default_class_option_id" integer NOT NULL,
  	"clear_existing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "parent_user_id" integer;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar DEFAULT '';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "instructors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lessons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_options_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "booking_transactions_id" integer;
  ALTER TABLE "instructors" ADD CONSTRAINT "instructors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instructors" ADD CONSTRAINT "instructors_profile_image_id_media_id_fk" FOREIGN KEY ("profile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_stripe_customers" ADD CONSTRAINT "users_stripe_customers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_week_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days" ADD CONSTRAINT "scheduler_week_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_default_class_option_id_class_options_id_fk" FOREIGN KEY ("default_class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "instructors_user_idx" ON "instructors" USING btree ("user_id");
  CREATE INDEX "instructors_profile_image_idx" ON "instructors" USING btree ("profile_image_id");
  CREATE INDEX "instructors_updated_at_idx" ON "instructors" USING btree ("updated_at");
  CREATE INDEX "instructors_created_at_idx" ON "instructors" USING btree ("created_at");
  CREATE INDEX "lessons_instructor_idx" ON "lessons" USING btree ("instructor_id");
  CREATE INDEX "lessons_class_option_idx" ON "lessons" USING btree ("class_option_id");
  CREATE INDEX "lessons_updated_at_idx" ON "lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "lessons" USING btree ("created_at");
  CREATE UNIQUE INDEX "class_options_name_idx" ON "class_options" USING btree ("name");
  CREATE INDEX "class_options_updated_at_idx" ON "class_options" USING btree ("updated_at");
  CREATE INDEX "class_options_created_at_idx" ON "class_options" USING btree ("created_at");
  CREATE INDEX "class_options_rels_order_idx" ON "class_options_rels" USING btree ("order");
  CREATE INDEX "class_options_rels_parent_idx" ON "class_options_rels" USING btree ("parent_id");
  CREATE INDEX "class_options_rels_path_idx" ON "class_options_rels" USING btree ("path");
  CREATE INDEX "class_options_rels_plans_id_idx" ON "class_options_rels" USING btree ("plans_id");
  CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");
  CREATE INDEX "bookings_lesson_idx" ON "bookings" USING btree ("lesson_id");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
  CREATE INDEX "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
  CREATE INDEX "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
  CREATE INDEX "bookings_rels_booking_transactions_id_idx" ON "bookings_rels" USING btree ("booking_transactions_id");
  CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
  CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");
  CREATE INDEX "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE INDEX "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE INDEX "booking_transactions_booking_idx" ON "booking_transactions" USING btree ("booking_id");
  CREATE INDEX "booking_transactions_updated_at_idx" ON "booking_transactions" USING btree ("updated_at");
  CREATE INDEX "booking_transactions_created_at_idx" ON "booking_transactions" USING btree ("created_at");
  CREATE INDEX "users_stripe_customers_order_idx" ON "users_stripe_customers" USING btree ("_order");
  CREATE INDEX "users_stripe_customers_parent_id_idx" ON "users_stripe_customers" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "scheduler_week_days_time_slot_order_idx" ON "scheduler_week_days_time_slot" USING btree ("_order");
  CREATE INDEX "scheduler_week_days_time_slot_parent_id_idx" ON "scheduler_week_days_time_slot" USING btree ("_parent_id");
  CREATE INDEX "scheduler_week_days_time_slot_class_option_idx" ON "scheduler_week_days_time_slot" USING btree ("class_option_id");
  CREATE INDEX "scheduler_week_days_time_slot_instructor_idx" ON "scheduler_week_days_time_slot" USING btree ("instructor_id");
  CREATE INDEX "scheduler_week_days_order_idx" ON "scheduler_week_days" USING btree ("_order");
  CREATE INDEX "scheduler_week_days_parent_id_idx" ON "scheduler_week_days" USING btree ("_parent_id");
  CREATE INDEX "scheduler_default_class_option_idx" ON "scheduler" USING btree ("default_class_option_id");
  ALTER TABLE "users" ADD CONSTRAINT "users_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instructors_fk" FOREIGN KEY ("instructors_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_options_fk" FOREIGN KEY ("class_options_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_parent_user_idx" ON "users" USING btree ("parent_user_id");
  CREATE INDEX "payload_locked_documents_rels_instructors_id_idx" ON "payload_locked_documents_rels" USING btree ("instructors_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_class_options_id_idx" ON "payload_locked_documents_rels" USING btree ("class_options_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_booking_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("booking_transactions_id");`)
}
