import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z',
  	"end_date" timestamp(3) with time zone DEFAULT '2025-03-27T10:25:43.437Z',
  	"lock_out_time" numeric DEFAULT 0,
  	"default_class_option_id" integer,
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
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-27T10:25:43.436Z';
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
  CREATE INDEX IF NOT EXISTS "scheduler_default_class_option_idx" ON "scheduler" USING btree ("default_class_option_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
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
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-03-25T14:21:19.562Z';`)
}
