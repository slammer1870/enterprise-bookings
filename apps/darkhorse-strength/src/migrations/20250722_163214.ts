import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_plans_price_information_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'generateLessonsFromSchedule');
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-22T16:32:14.063Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-22T16:32:14.063Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric
  );
  
  CREATE TABLE "scheduler_week_days" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "scheduler_schedule_monday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_monday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_tuesday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_tuesday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_wednesday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_wednesday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_thursday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_thursday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_friday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_friday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_saturday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_saturday_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_sunday_slots_skip_dates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_schedule_sunday_slots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scheduler_schedule_monday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_monday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_tuesday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_tuesday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_wednesday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_wednesday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_thursday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_thursday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_friday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_friday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_saturday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_saturday_slots" CASCADE;
  DROP TABLE "scheduler_schedule_sunday_slots_skip_dates" CASCADE;
  DROP TABLE "scheduler_schedule_sunday_slots" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-22T16:32:14.063Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" DROP DEFAULT;
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" DROP DEFAULT;
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "lock_out_time" SET NOT NULL;
  ALTER TABLE "plans" ADD COLUMN "sessions_information_sessions" numeric;
  ALTER TABLE "plans" ADD COLUMN "sessions_information_interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "sessions_information_interval" "enum_plans_sessions_information_interval";
  ALTER TABLE "plans" ADD COLUMN "price_information_price" numeric;
  ALTER TABLE "plans" ADD COLUMN "price_information_interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "price_information_interval" "enum_plans_price_information_interval" DEFAULT 'month';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_jobs_id" integer;
  ALTER TABLE "scheduler" ADD COLUMN "clear_existing" boolean DEFAULT false;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_week_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_week_days" ADD CONSTRAINT "scheduler_week_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
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
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_payload_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_jobs_id");
  ALTER TABLE "plans" DROP COLUMN "sessions";
  ALTER TABLE "plans" DROP COLUMN "interval_count";
  ALTER TABLE "plans" DROP COLUMN "interval";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_monday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_tuesday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_wednesday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_thursday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_friday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_saturday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "schedule_sunday_is_active";
  ALTER TABLE "scheduler" DROP COLUMN "generate_options_clear_existing";
  ALTER TABLE "scheduler" DROP COLUMN "generation_results_last_generated";
  ALTER TABLE "scheduler" DROP COLUMN "generation_results_created";
  ALTER TABLE "scheduler" DROP COLUMN "generation_results_skipped";
  ALTER TABLE "scheduler" DROP COLUMN "generation_results_conflicts";
  ALTER TABLE "scheduler" DROP COLUMN "generation_results_details";
  DROP TYPE "public"."enum_plans_interval";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TABLE "scheduler_schedule_monday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_monday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_tuesday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_tuesday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_wednesday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_wednesday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.238Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_thursday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_thursday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_friday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_friday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_saturday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_saturday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE "scheduler_schedule_sunday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE "scheduler_schedule_sunday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-17T09:35:29.239Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_week_days_time_slot" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scheduler_week_days" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "scheduler_week_days_time_slot" CASCADE;
  DROP TABLE "scheduler_week_days" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk";
  
  DROP INDEX "payload_locked_documents_rels_payload_jobs_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-17T09:35:29.237Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-07-17T09:35:29.238Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" DROP NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-07-17T09:35:29.238Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" DROP NOT NULL;
  ALTER TABLE "scheduler" ALTER COLUMN "lock_out_time" DROP NOT NULL;
  ALTER TABLE "plans" ADD COLUMN "sessions" numeric;
  ALTER TABLE "plans" ADD COLUMN "interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "interval" "enum_plans_interval";
  ALTER TABLE "scheduler" ADD COLUMN "schedule_monday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_tuesday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_wednesday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_thursday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_friday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_saturday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "schedule_sunday_is_active" boolean DEFAULT true;
  ALTER TABLE "scheduler" ADD COLUMN "generate_options_clear_existing" boolean DEFAULT false;
  ALTER TABLE "scheduler" ADD COLUMN "generation_results_last_generated" timestamp(3) with time zone;
  ALTER TABLE "scheduler" ADD COLUMN "generation_results_created" numeric;
  ALTER TABLE "scheduler" ADD COLUMN "generation_results_skipped" numeric;
  ALTER TABLE "scheduler" ADD COLUMN "generation_results_conflicts" numeric;
  ALTER TABLE "scheduler" ADD COLUMN "generation_results_details" jsonb;
  ALTER TABLE "scheduler_schedule_monday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_monday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_monday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_tuesday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_tuesday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_wednesday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_wednesday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_thursday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_thursday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_thursday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_friday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_friday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_friday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_saturday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_saturday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_saturday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_sunday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_sunday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_sunday_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "scheduler_schedule_monday_slots_skip_dates_order_idx" ON "scheduler_schedule_monday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_monday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_monday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_monday_slots_order_idx" ON "scheduler_schedule_monday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_monday_slots_parent_id_idx" ON "scheduler_schedule_monday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_monday_slots_class_option_idx" ON "scheduler_schedule_monday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_monday_slots_instructor_idx" ON "scheduler_schedule_monday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_tuesday_slots_skip_dates_order_idx" ON "scheduler_schedule_tuesday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_tuesday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_tuesday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_tuesday_slots_order_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_tuesday_slots_parent_id_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_tuesday_slots_class_option_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_tuesday_slots_instructor_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_wednesday_slots_skip_dates_order_idx" ON "scheduler_schedule_wednesday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_wednesday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_wednesday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_wednesday_slots_order_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_wednesday_slots_parent_id_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_wednesday_slots_class_option_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_wednesday_slots_instructor_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_thursday_slots_skip_dates_order_idx" ON "scheduler_schedule_thursday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_thursday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_thursday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_thursday_slots_order_idx" ON "scheduler_schedule_thursday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_thursday_slots_parent_id_idx" ON "scheduler_schedule_thursday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_thursday_slots_class_option_idx" ON "scheduler_schedule_thursday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_thursday_slots_instructor_idx" ON "scheduler_schedule_thursday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_friday_slots_skip_dates_order_idx" ON "scheduler_schedule_friday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_friday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_friday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_friday_slots_order_idx" ON "scheduler_schedule_friday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_friday_slots_parent_id_idx" ON "scheduler_schedule_friday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_friday_slots_class_option_idx" ON "scheduler_schedule_friday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_friday_slots_instructor_idx" ON "scheduler_schedule_friday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_saturday_slots_skip_dates_order_idx" ON "scheduler_schedule_saturday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_saturday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_saturday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_saturday_slots_order_idx" ON "scheduler_schedule_saturday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_saturday_slots_parent_id_idx" ON "scheduler_schedule_saturday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_saturday_slots_class_option_idx" ON "scheduler_schedule_saturday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_saturday_slots_instructor_idx" ON "scheduler_schedule_saturday_slots" USING btree ("instructor_id");
  CREATE INDEX "scheduler_schedule_sunday_slots_skip_dates_order_idx" ON "scheduler_schedule_sunday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_sunday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_sunday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_sunday_slots_order_idx" ON "scheduler_schedule_sunday_slots" USING btree ("_order");
  CREATE INDEX "scheduler_schedule_sunday_slots_parent_id_idx" ON "scheduler_schedule_sunday_slots" USING btree ("_parent_id");
  CREATE INDEX "scheduler_schedule_sunday_slots_class_option_idx" ON "scheduler_schedule_sunday_slots" USING btree ("class_option_id");
  CREATE INDEX "scheduler_schedule_sunday_slots_instructor_idx" ON "scheduler_schedule_sunday_slots" USING btree ("instructor_id");
  ALTER TABLE "plans" DROP COLUMN "sessions_information_sessions";
  ALTER TABLE "plans" DROP COLUMN "sessions_information_interval_count";
  ALTER TABLE "plans" DROP COLUMN "sessions_information_interval";
  ALTER TABLE "plans" DROP COLUMN "price_information_price";
  ALTER TABLE "plans" DROP COLUMN "price_information_interval_count";
  ALTER TABLE "plans" DROP COLUMN "price_information_interval";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_jobs_id";
  ALTER TABLE "scheduler" DROP COLUMN "clear_existing";
  DROP TYPE "public"."enum_plans_sessions_information_interval";
  DROP TYPE "public"."enum_plans_price_information_interval";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
