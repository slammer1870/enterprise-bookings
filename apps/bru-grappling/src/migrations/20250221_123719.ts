import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('customer', 'admin');
  CREATE TYPE "public"."enum_subscriptions_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');
  CREATE TYPE "public"."enum_plans_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'cancelled', 'waiting');
  CREATE TYPE "public"."enum_drop_ins_price_type" AS ENUM('trial', 'normal');
  CREATE TABLE IF NOT EXISTS "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
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
  	"date" timestamp(3) with time zone DEFAULT '2025-02-21T12:37:18.791Z' NOT NULL,
  	"start_time" timestamp(3) with time zone NOT NULL,
  	"end_time" timestamp(3) with time zone NOT NULL,
  	"lock_out_time" numeric DEFAULT 60 NOT NULL,
  	"location" varchar,
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
  
  CREATE TABLE IF NOT EXISTS "class_options_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"drop_ins_id" integer,
  	"plans_id" integer
  );
  
  CREATE TABLE IF NOT EXISTS "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"status" "enum_bookings_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "drop_ins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"price_type" "enum_drop_ins_price_type" DEFAULT 'normal' NOT NULL,
  	"active" boolean DEFAULT true,
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
  
  ALTER TABLE "users" ADD COLUMN "name" varchar DEFAULT '' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscriptions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lessons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "class_options_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drop_ins_id" integer;
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
   ALTER TABLE "lessons" ADD CONSTRAINT "lessons_class_option_id_class_options_id_fk" FOREIGN KEY ("class_option_id") REFERENCES "public"."class_options"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_drop_ins_fk" FOREIGN KEY ("drop_ins_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
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
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drop_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "drop_ins_rels" ADD CONSTRAINT "drop_ins_rels_class_options_fk" FOREIGN KEY ("class_options_id") REFERENCES "public"."class_options"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx" ON "subscriptions" USING btree ("plan_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");
  CREATE INDEX IF NOT EXISTS "subscriptions_updated_at_idx" ON "subscriptions" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "subscriptions_created_at_idx" ON "subscriptions" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "lessons_class_option_idx" ON "lessons" USING btree ("class_option_id");
  CREATE INDEX IF NOT EXISTS "lessons_updated_at_idx" ON "lessons" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "lessons_created_at_idx" ON "lessons" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "class_options_updated_at_idx" ON "class_options" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "class_options_created_at_idx" ON "class_options" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "class_options_rels_order_idx" ON "class_options_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "class_options_rels_parent_idx" ON "class_options_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_path_idx" ON "class_options_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "class_options_rels_drop_ins_id_idx" ON "class_options_rels" USING btree ("drop_ins_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_plans_id_idx" ON "class_options_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "bookings_user_idx" ON "bookings" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "bookings_lesson_idx" ON "bookings" USING btree ("lesson_id");
  CREATE INDEX IF NOT EXISTS "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_updated_at_idx" ON "drop_ins" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_created_at_idx" ON "drop_ins" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_order_idx" ON "drop_ins_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_parent_idx" ON "drop_ins_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_path_idx" ON "drop_ins_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "drop_ins_rels_class_options_id_idx" ON "drop_ins_rels" USING btree ("class_options_id");
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
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("subscriptions_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_lessons_id_idx" ON "payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_options_id_idx" ON "payload_locked_documents_rels" USING btree ("class_options_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drop_ins_id_idx" ON "payload_locked_documents_rels" USING btree ("drop_ins_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lessons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "class_options_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drop_ins_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "subscriptions" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "lessons" CASCADE;
  DROP TABLE "class_options" CASCADE;
  DROP TABLE "class_options_rels" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "drop_ins" CASCADE;
  DROP TABLE "drop_ins_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscriptions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lessons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_class_options_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bookings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drop_ins_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_subscriptions_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_plans_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lessons_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_class_options_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bookings_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_drop_ins_id_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "name";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "subscriptions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "plans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "lessons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "class_options_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bookings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "drop_ins_id";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_subscriptions_status";
  DROP TYPE "public"."enum_plans_interval";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_drop_ins_price_type";`)
}
