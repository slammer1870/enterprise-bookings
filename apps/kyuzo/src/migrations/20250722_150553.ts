import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_plans_price_information_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TABLE "new_scheduler_week_day_time_slot" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-07-22T15:05:53.070Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-07-22T15:05:53.070Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric
  );
  
  CREATE TABLE "new_scheduler_week_day" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "new_scheduler" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone DEFAULT '2025-07-22T15:05:53.070Z',
  	"end_date" timestamp(3) with time zone DEFAULT '2025-07-22T15:05:53.070Z',
  	"lock_out_time" numeric DEFAULT 0,
  	"default_class_option_id" integer NOT NULL,
  	"week_day_name" varchar,
  	"clear_existing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "plans" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "plans" ALTER COLUMN "type" SET DEFAULT 'adult'::text;
  DROP TYPE "public"."enum_plans_type";
  CREATE TYPE "public"."enum_plans_type" AS ENUM('adult', 'child');
  ALTER TABLE "plans" ALTER COLUMN "type" SET DEFAULT 'adult'::"public"."enum_plans_type";
  ALTER TABLE "plans" ALTER COLUMN "type" SET DATA TYPE "public"."enum_plans_type" USING "type"::"public"."enum_plans_type";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-22T15:05:52.924Z';
  ALTER TABLE "plans" ALTER COLUMN "type" DROP NOT NULL;
  ALTER TABLE "plans" ALTER COLUMN "quantity" SET DEFAULT 1;
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-07-22T15:05:53.070Z';
  ALTER TABLE "plans" ADD COLUMN "sessions_information_sessions" numeric;
  ALTER TABLE "plans" ADD COLUMN "sessions_information_interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "sessions_information_interval" "enum_plans_sessions_information_interval";
  ALTER TABLE "plans" ADD COLUMN "price_information_price" numeric;
  ALTER TABLE "plans" ADD COLUMN "price_information_interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "price_information_interval" "enum_plans_price_information_interval" DEFAULT 'month';
  ALTER TABLE "new_scheduler_week_day_time_slot" ADD CONSTRAINT "new_scheduler_week_day_time_slot_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "new_scheduler_week_day_time_slot" ADD CONSTRAINT "new_scheduler_week_day_time_slot_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "new_scheduler_week_day_time_slot" ADD CONSTRAINT "new_scheduler_week_day_time_slot_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."new_scheduler_week_day"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "new_scheduler_week_day" ADD CONSTRAINT "new_scheduler_week_day_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."new_scheduler"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "new_scheduler" ADD CONSTRAINT "new_scheduler_default_class_option_id_class_options_id_fk" FOREIGN KEY ("default_class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "new_scheduler_week_day_time_slot_order_idx" ON "new_scheduler_week_day_time_slot" USING btree ("_order");
  CREATE INDEX "new_scheduler_week_day_time_slot_parent_id_idx" ON "new_scheduler_week_day_time_slot" USING btree ("_parent_id");
  CREATE INDEX "new_scheduler_week_day_time_slot_class_option_idx" ON "new_scheduler_week_day_time_slot" USING btree ("class_option_id");
  CREATE INDEX "new_scheduler_week_day_time_slot_instructor_idx" ON "new_scheduler_week_day_time_slot" USING btree ("instructor_id");
  CREATE INDEX "new_scheduler_week_day_order_idx" ON "new_scheduler_week_day" USING btree ("_order");
  CREATE INDEX "new_scheduler_week_day_parent_id_idx" ON "new_scheduler_week_day" USING btree ("_parent_id");
  CREATE INDEX "new_scheduler_default_class_option_idx" ON "new_scheduler" USING btree ("default_class_option_id");
  ALTER TABLE "plans" DROP COLUMN "sessions";
  ALTER TABLE "plans" DROP COLUMN "interval_count";
  ALTER TABLE "plans" DROP COLUMN "interval";
  DROP TYPE "public"."enum_plans_interval";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  ALTER TYPE "public"."enum_plans_type" ADD VALUE 'family' BEFORE 'child';
  ALTER TABLE "new_scheduler_week_day_time_slot" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "new_scheduler_week_day" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "new_scheduler" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "new_scheduler_week_day_time_slot" CASCADE;
  DROP TABLE "new_scheduler_week_day" CASCADE;
  DROP TABLE "new_scheduler" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-17T09:35:28.939Z';
  ALTER TABLE "plans" ALTER COLUMN "type" SET NOT NULL;
  ALTER TABLE "plans" ALTER COLUMN "quantity" DROP DEFAULT;
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-07-17T09:35:29.145Z';
  ALTER TABLE "plans" ADD COLUMN "sessions" numeric;
  ALTER TABLE "plans" ADD COLUMN "interval_count" numeric;
  ALTER TABLE "plans" ADD COLUMN "interval" "enum_plans_interval";
  ALTER TABLE "plans" DROP COLUMN "sessions_information_sessions";
  ALTER TABLE "plans" DROP COLUMN "sessions_information_interval_count";
  ALTER TABLE "plans" DROP COLUMN "sessions_information_interval";
  ALTER TABLE "plans" DROP COLUMN "price_information_price";
  ALTER TABLE "plans" DROP COLUMN "price_information_interval_count";
  ALTER TABLE "plans" DROP COLUMN "price_information_interval";
  DROP TYPE "public"."enum_plans_sessions_information_interval";
  DROP TYPE "public"."enum_plans_price_information_interval";`)
}
