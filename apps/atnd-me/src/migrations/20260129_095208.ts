import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN CREATE TYPE "public"."enum_bookings_payment_method_used" AS ENUM('stripe', 'class_pass'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_drop_ins_discount_tiers_type" AS ENUM('normal', 'trial', 'bulk'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('cash', 'card'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_class_pass_types_status" AS ENUM('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_class_passes_status" AS ENUM('active', 'expired', 'used', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_plans_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_plans_price_information_interval" AS ENUM('day', 'week', 'month', 'year'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_plans_status" AS ENUM('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncStripeSubscriptions' BEFORE 'schedulePublish'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncStripeSubscriptions' BEFORE 'schedulePublish'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "tenants_class_pass_settings_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quantity" numeric NOT NULL,
  	"price" numeric NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "class_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"class_pass_types_id" integer,
  	"plans_id" integer
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
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"is_active" boolean DEFAULT true NOT NULL,
  	"price" numeric NOT NULL,
  	"adjustable" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "class_pass_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"quantity" numeric NOT NULL,
  	"allow_multiple_bookings_per_timeslot" boolean DEFAULT true NOT NULL,
  	"stripe_product_id" varchar,
  	"price_information_price_cents" numeric,
  	"price_j_s_o_n" varchar,
  	"status" "enum_class_pass_types_status" DEFAULT 'active' NOT NULL,
  	"skip_sync" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "class_passes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"user_id" integer NOT NULL,
  	"type_id" integer NOT NULL,
  	"quantity" numeric NOT NULL,
  	"expiration_date" timestamp(3) with time zone NOT NULL,
  	"purchased_at" timestamp(3) with time zone NOT NULL,
  	"price" numeric NOT NULL,
  	"transaction_id" varchar,
  	"status" "enum_class_passes_status" DEFAULT 'active' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "booking_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"booking_id" integer NOT NULL,
  	"payment_method" "enum_booking_transactions_payment_method" NOT NULL,
  	"class_pass_id" numeric,
  	"stripe_payment_intent_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
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
  
  CREATE TABLE IF NOT EXISTS "plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"sessions_information_sessions" numeric,
  	"sessions_information_interval_count" numeric,
  	"sessions_information_interval" "enum_plans_sessions_information_interval",
  	"stripe_product_id" varchar,
  	"price_information_price" numeric,
  	"price_information_interval_count" numeric,
  	"price_information_interval" "enum_plans_price_information_interval" DEFAULT 'month',
  	"price_j_s_o_n" varchar,
  	"status" "enum_plans_status" DEFAULT 'active' NOT NULL,
  	"skip_sync" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-01-29T09:52:04.867Z';
  DO $$ BEGIN ALTER TABLE "tenants" ADD COLUMN "class_pass_settings_enabled" boolean DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "tenants" ADD COLUMN "class_pass_settings_default_expiration_days" numeric DEFAULT 365; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options" ADD COLUMN "payment_methods_allowed_drop_in_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "bookings" ADD COLUMN "payment_method_used" "enum_bookings_payment_method_used"; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "bookings" ADD COLUMN "class_pass_id_used" numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drop_ins_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_pass_types_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_passes_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "booking_transactions_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_passes" ADD COLUMN "type_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  ALTER TABLE "class_passes" DROP COLUMN IF EXISTS "original_quantity";
  DO $$ BEGIN ALTER TABLE "tenants_class_pass_settings_pricing" ADD CONSTRAINT "tenants_class_pass_settings_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_class_pass_types_fk" FOREIGN KEY ("class_pass_types_id") REFERENCES "public"."class_pass_types"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "drop_ins_discount_tiers" ADD CONSTRAINT "drop_ins_discount_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "drop_ins_payment_methods" ADD CONSTRAINT "drop_ins_payment_methods_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "drop_ins" ADD CONSTRAINT "drop_ins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_pass_types" ADD CONSTRAINT "class_pass_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_passes" ADD CONSTRAINT "class_passes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_passes" ADD CONSTRAINT "class_passes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_passes" ADD CONSTRAINT "class_passes_type_id_class_pass_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."class_pass_types"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "tenants_class_pass_settings_pricing_order_idx" ON "tenants_class_pass_settings_pricing" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "tenants_class_pass_settings_pricing_parent_id_idx" ON "tenants_class_pass_settings_pricing" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_order_idx" ON "class_options_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "class_options_rels_parent_idx" ON "class_options_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_path_idx" ON "class_options_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "class_options_rels_class_pass_types_id_idx" ON "class_options_rels" USING btree ("class_pass_types_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_plans_id_idx" ON "class_options_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_order_idx" ON "drop_ins_discount_tiers" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "drop_ins_discount_tiers_parent_id_idx" ON "drop_ins_discount_tiers" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_payment_methods_order_idx" ON "drop_ins_payment_methods" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "drop_ins_payment_methods_parent_idx" ON "drop_ins_payment_methods" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_tenant_idx" ON "drop_ins" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_updated_at_idx" ON "drop_ins" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_created_at_idx" ON "drop_ins" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "class_pass_types_tenant_idx" ON "class_pass_types" USING btree ("tenant_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "class_pass_types_slug_idx" ON "class_pass_types" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "class_pass_types_updated_at_idx" ON "class_pass_types" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "class_pass_types_created_at_idx" ON "class_pass_types" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "class_passes_tenant_idx" ON "class_passes" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "class_passes_user_idx" ON "class_passes" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "class_passes_type_idx" ON "class_passes" USING btree ("type_id");
  CREATE INDEX IF NOT EXISTS "class_passes_updated_at_idx" ON "class_passes" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "class_passes_created_at_idx" ON "class_passes" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "booking_transactions_tenant_idx" ON "booking_transactions" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "booking_transactions_booking_idx" ON "booking_transactions" USING btree ("booking_id");
  CREATE INDEX IF NOT EXISTS "booking_transactions_updated_at_idx" ON "booking_transactions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "booking_transactions_created_at_idx" ON "booking_transactions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "plans_tenant_idx" ON "plans" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");
  DO $$ BEGIN ALTER TABLE "class_options" ADD CONSTRAINT "class_options_payment_methods_allowed_drop_in_id_drop_ins_id_fk" FOREIGN KEY ("payment_methods_allowed_drop_in_id") REFERENCES "public"."drop_ins"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drop_ins_fk" FOREIGN KEY ("drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_pass_types_fk" FOREIGN KEY ("class_pass_types_id") REFERENCES "public"."class_pass_types"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_passes_fk" FOREIGN KEY ("class_passes_id") REFERENCES "public"."class_passes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscriptions_fk" FOREIGN KEY ("subscriptions_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "class_options_payment_methods_payment_methods_allowed_dr_idx" ON "class_options" USING btree ("payment_methods_allowed_drop_in_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drop_ins_id_idx" ON "payload_locked_documents_rels" USING btree ("drop_ins_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_pass_types_id_idx" ON "payload_locked_documents_rels" USING btree ("class_pass_types_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_passes_id_idx" ON "payload_locked_documents_rels" USING btree ("class_passes_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_booking_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("booking_transactions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants_class_pass_settings_pricing" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins_discount_tiers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins_payment_methods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_pass_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_passes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "booking_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenants_class_pass_settings_pricing" CASCADE;
  DROP TABLE "class_options_rels" CASCADE;
  DROP TABLE "drop_ins_discount_tiers" CASCADE;
  DROP TABLE "drop_ins_payment_methods" CASCADE;
  DROP TABLE "drop_ins" CASCADE;
  DROP TABLE "class_pass_types" CASCADE;
  DROP TABLE "class_passes" CASCADE;
  DROP TABLE "booking_transactions" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  ALTER TABLE "class_options" DROP CONSTRAINT "class_options_payment_methods_allowed_drop_in_id_drop_ins_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drop_ins_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_class_pass_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_class_passes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'generateTimeslotsFromSchedule', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'generateTimeslotsFromSchedule', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "class_options_payment_methods_payment_methods_allowed_dr_idx";
  DROP INDEX "payload_locked_documents_rels_drop_ins_id_idx";
  DROP INDEX "payload_locked_documents_rels_class_pass_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_class_passes_id_idx";
  DROP INDEX "payload_locked_documents_rels_booking_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_subscriptions_id_idx";
  DROP INDEX "payload_locked_documents_rels_plans_id_idx";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-01-27T13:10:55.694Z';
  ALTER TABLE "tenants" DROP COLUMN "class_pass_settings_enabled";
  ALTER TABLE "tenants" DROP COLUMN "class_pass_settings_default_expiration_days";
  ALTER TABLE "class_options" DROP COLUMN "payment_methods_allowed_drop_in_id";
  ALTER TABLE "bookings" DROP COLUMN "payment_method_used";
  ALTER TABLE "bookings" DROP COLUMN "class_pass_id_used";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drop_ins_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "class_pass_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "class_passes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "booking_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plans_id";
  DROP TYPE "public"."enum_bookings_payment_method_used";
  DROP TYPE "public"."enum_drop_ins_discount_tiers_type";
  DROP TYPE "public"."enum_drop_ins_payment_methods";
  DROP TYPE "public"."enum_class_pass_types_status";
  DROP TYPE "public"."enum_class_passes_status";
  DROP TYPE "public"."enum_booking_transactions_payment_method";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_plans_sessions_information_interval";
  DROP TYPE "public"."enum_plans_price_information_interval";
  DROP TYPE "public"."enum_plans_status";`)
}
