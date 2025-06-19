import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('customer', 'admin');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'waiting');
  CREATE TABLE IF NOT EXISTS "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.131Z' NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone NOT NULL,
  	"lock_out_time" numeric DEFAULT 0 NOT NULL,
  	"location" varchar,
  	"instructor_id" integer,
  	"class_option_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "class_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"places" numeric NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"status" "enum_bookings_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_monday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_monday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_tuesday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_tuesday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_wednesday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_wednesday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_thursday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_thursday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_friday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_friday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_saturday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_saturday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_sunday_slots_skip_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler_schedule_sunday_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.279Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.278Z',
  	"end_date" timestamp(3) with time zone DEFAULT '2025-06-19T15:15:03.278Z',
  	"lock_out_time" numeric DEFAULT 0,
  	"default_class_option_id" integer NOT NULL,
  	"schedule_monday_is_active" boolean DEFAULT true,
  	"schedule_tuesday_is_active" boolean DEFAULT true,
  	"schedule_wednesday_is_active" boolean DEFAULT true,
  	"schedule_thursday_is_active" boolean DEFAULT true,
  	"schedule_friday_is_active" boolean DEFAULT true,
  	"schedule_saturday_is_active" boolean DEFAULT true,
  	"schedule_sunday_is_active" boolean DEFAULT true,
  	"generate_options_clear_existing" boolean DEFAULT false,
  	"generation_results_last_generated" timestamp(3) with time zone,
  	"generation_results_created" numeric,
  	"generation_results_skipped" numeric,
  	"generation_results_conflicts" numeric,
  	"generation_results_details" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "name" varchar NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lessons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_options_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  DO $$ BEGIN
   ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "lessons" ADD CONSTRAINT "lessons_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "lessons" ADD CONSTRAINT "lessons_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_monday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_monday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_monday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_monday_slots" ADD CONSTRAINT "scheduler_schedule_monday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_tuesday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_tuesday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_tuesday_slots" ADD CONSTRAINT "scheduler_schedule_tuesday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_wednesday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_wednesday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_wednesday_slots" ADD CONSTRAINT "scheduler_schedule_wednesday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_thursday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_thursday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_thursday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_thursday_slots" ADD CONSTRAINT "scheduler_schedule_thursday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_friday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_friday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_friday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_friday_slots" ADD CONSTRAINT "scheduler_schedule_friday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_saturday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_saturday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_saturday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_saturday_slots" ADD CONSTRAINT "scheduler_schedule_saturday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_sunday_slots_skip_dates" ADD CONSTRAINT "scheduler_schedule_sunday_slots_skip_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler_schedule_sunday_slots"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler_schedule_sunday_slots" ADD CONSTRAINT "scheduler_schedule_sunday_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scheduler"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_default_class_option_id_class_options_id_fk" FOREIGN KEY ("default_class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "lessons_instructor_idx" ON "lessons" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "lessons_class_option_idx" ON "lessons" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "lessons_updated_at_idx" ON "lessons" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "lessons_created_at_idx" ON "lessons" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "class_options_name_idx" ON "class_options" USING btree ("name");
  CREATE INDEX IF NOT EXISTS "class_options_updated_at_idx" ON "class_options" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "class_options_created_at_idx" ON "class_options" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "bookings_user_idx" ON "bookings" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "bookings_lesson_idx" ON "bookings" USING btree ("lesson_id");
  CREATE INDEX IF NOT EXISTS "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_skip_dates_order_idx" ON "scheduler_schedule_monday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_monday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_order_idx" ON "scheduler_schedule_monday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_parent_id_idx" ON "scheduler_schedule_monday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_class_option_idx" ON "scheduler_schedule_monday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_monday_slots_instructor_idx" ON "scheduler_schedule_monday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_skip_dates_order_idx" ON "scheduler_schedule_tuesday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_tuesday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_order_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_parent_id_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_class_option_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_tuesday_slots_instructor_idx" ON "scheduler_schedule_tuesday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_skip_dates_order_idx" ON "scheduler_schedule_wednesday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_wednesday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_order_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_parent_id_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_class_option_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_wednesday_slots_instructor_idx" ON "scheduler_schedule_wednesday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_skip_dates_order_idx" ON "scheduler_schedule_thursday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_thursday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_order_idx" ON "scheduler_schedule_thursday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_parent_id_idx" ON "scheduler_schedule_thursday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_class_option_idx" ON "scheduler_schedule_thursday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_thursday_slots_instructor_idx" ON "scheduler_schedule_thursday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_skip_dates_order_idx" ON "scheduler_schedule_friday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_friday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_order_idx" ON "scheduler_schedule_friday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_parent_id_idx" ON "scheduler_schedule_friday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_class_option_idx" ON "scheduler_schedule_friday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_friday_slots_instructor_idx" ON "scheduler_schedule_friday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_skip_dates_order_idx" ON "scheduler_schedule_saturday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_saturday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_order_idx" ON "scheduler_schedule_saturday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_parent_id_idx" ON "scheduler_schedule_saturday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_class_option_idx" ON "scheduler_schedule_saturday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_saturday_slots_instructor_idx" ON "scheduler_schedule_saturday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_skip_dates_order_idx" ON "scheduler_schedule_sunday_slots_skip_dates" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_skip_dates_parent_id_idx" ON "scheduler_schedule_sunday_slots_skip_dates" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_order_idx" ON "scheduler_schedule_sunday_slots" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_parent_id_idx" ON "scheduler_schedule_sunday_slots" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_class_option_idx" ON "scheduler_schedule_sunday_slots" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "scheduler_schedule_sunday_slots_instructor_idx" ON "scheduler_schedule_sunday_slots" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "scheduler_default_class_option_idx" ON "scheduler" USING btree ("default_class_option_id");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_options_fk" FOREIGN KEY ("class_options_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lessons_id_idx" ON "payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_options_id_idx" ON "payload_locked_documents_rels" USING btree ("class_options_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lessons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;
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
  ALTER TABLE "scheduler" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "lessons" CASCADE;
  DROP TABLE "class_options" CASCADE;
  DROP TABLE "bookings" CASCADE;
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
  DROP TABLE "scheduler" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lessons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_class_options_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bookings_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lessons_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_class_options_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bookings_id_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "name";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "lessons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "class_options_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bookings_id";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_bookings_status";`)
}
