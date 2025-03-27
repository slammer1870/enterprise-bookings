import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_transactions_currency" AS ENUM('EUR', 'USD');
  CREATE TYPE "public"."enum_transactions_status" AS ENUM('pending', 'completed', 'failed');
  CREATE TYPE "public"."enum_transactions_payment_method" AS ENUM('cash', 'card');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('customer', 'admin');
  CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
  CREATE TYPE "public"."enum_plans_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'waiting');
  CREATE TYPE "public"."enum_drop_ins_discount_tiers_type" AS ENUM('normal', 'trial');
  CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('card');
  CREATE TABLE IF NOT EXISTS "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE IF NOT EXISTS "transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"currency" "enum_transactions_currency" DEFAULT 'EUR' NOT NULL,
  	"status" "enum_transactions_status" NOT NULL,
  	"payment_method" "enum_transactions_payment_method" NOT NULL,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"stripe_customer_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE IF NOT EXISTS "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"plan_id" integer NOT NULL,
  	"status" "enum_subscriptions_status" DEFAULT 'incomplete' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"stripe_subscription_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"sessions" numeric,
  	"interval_count" numeric,
  	"interval" "enum_plans_interval",
  	"stripe_product_id" varchar,
  	"price_j_s_o_n" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.517Z' NOT NULL,
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
  	"payment_methods_allowed_drop_ins_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "class_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"plans_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"status" "enum_bookings_status" NOT NULL,
  	"transaction_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins_discount_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_quantity" numeric DEFAULT 1 NOT NULL,
  	"discount_percent" numeric NOT NULL,
  	"type" "enum_drop_ins_discount_tiers_type" DEFAULT 'normal' NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins_payment_methods" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_drop_ins_payment_methods",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"is_active" boolean DEFAULT true NOT NULL,
  	"price" numeric NOT NULL,
  	"adjustable" boolean DEFAULT false NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"class_options_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"transactions_id" integer,
  	"users_id" integer,
  	"subscriptions_id" integer,
  	"plans_id" integer,
  	"lessons_id" integer,
  	"class_options_id" integer,
  	"bookings_id" integer,
  	"drop_ins_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
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
  	"start_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"end_time" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z' NOT NULL,
  	"class_option_id" integer,
  	"location" varchar,
  	"instructor_id" integer,
  	"lock_out_time" numeric,
  	"notes" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "scheduler" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_date" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z',
  	"end_date" timestamp(3) with time zone DEFAULT '2025-03-27T12:27:53.518Z',
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
  
  DO $$ BEGIN
   ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
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
   ALTER TABLE "class_options" ADD CONSTRAINT "class_options_payment_methods_allowed_drop_ins_id_drop_ins_id_fk" FOREIGN KEY ("payment_methods_allowed_drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
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
   ALTER TABLE "bookings" ADD CONSTRAINT "bookings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_discount_tiers" ADD CONSTRAINT "drop_ins_discount_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_payment_methods" ADD CONSTRAINT "drop_ins_payment_methods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_class_options_fk" FOREIGN KEY ("class_options_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
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
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drop_ins_fk" FOREIGN KEY ("drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
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
  
  CREATE INDEX IF NOT EXISTS "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX IF NOT EXISTS "transactions_created_by_idx" ON "transactions" USING btree ("created_by_id");
  CREATE INDEX IF NOT EXISTS "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "lessons_instructor_idx" ON "lessons" USING btree ("instructor_id");
  CREATE INDEX IF NOT EXISTS "lessons_class_option_idx" ON "lessons" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "lessons_updated_at_idx" ON "lessons" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "lessons_created_at_idx" ON "lessons" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "class_options_name_idx" ON "class_options" USING btree ("name");
  CREATE INDEX IF NOT EXISTS "class_options_payment_methods_payment_methods_allowed_drop_ins_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_ins_id");
  CREATE INDEX IF NOT EXISTS "class_options_updated_at_idx" ON "class_options" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "class_options_created_at_idx" ON "class_options" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "class_options_rels_order_idx" ON "class_options_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "class_options_rels_parent_idx" ON "class_options_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_path_idx" ON "class_options_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "class_options_rels_plans_id_idx" ON "class_options_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "bookings_user_idx" ON "bookings" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "bookings_lesson_idx" ON "bookings" USING btree ("lesson_id");
  CREATE INDEX IF NOT EXISTS "bookings_transaction_idx" ON "bookings" USING btree ("transaction_id");
  CREATE INDEX IF NOT EXISTS "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_order_idx" ON "drop_ins_discount_tiers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_parent_id_idx" ON "drop_ins_discount_tiers" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_payment_methods_order_idx" ON "drop_ins_payment_methods" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "drop_ins_payment_methods_parent_idx" ON "drop_ins_payment_methods" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_updated_at_idx" ON "drop_ins" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_created_at_idx" ON "drop_ins" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_order_idx" ON "drop_ins_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_parent_idx" ON "drop_ins_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_path_idx" ON "drop_ins_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_class_options_id_idx" ON "drop_ins_rels" USING btree ("class_options_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lessons_id_idx" ON "payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_options_id_idx" ON "payload_locked_documents_rels" USING btree ("class_options_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drop_ins_id_idx" ON "payload_locked_documents_rels" USING btree ("drop_ins_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
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
   DROP TABLE "media" CASCADE;
  DROP TABLE "transactions" CASCADE;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "lessons" CASCADE;
  DROP TABLE "class_options" CASCADE;
  DROP TABLE "class_options_rels" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "drop_ins_discount_tiers" CASCADE;
  DROP TABLE "drop_ins_payment_methods" CASCADE;
  DROP TABLE "drop_ins" CASCADE;
  DROP TABLE "drop_ins_rels" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
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
  DROP TYPE "public"."enum_transactions_currency";
  DROP TYPE "public"."enum_transactions_status";
  DROP TYPE "public"."enum_transactions_payment_method";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_plans_interval";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_drop_ins_discount_tiers_type";
  DROP TYPE "public"."enum_drop_ins_payment_methods";`)
}
