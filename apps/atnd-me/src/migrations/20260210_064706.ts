import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN CREATE TYPE "public"."enum_plans_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_plans_price_information_interval" AS ENUM('day', 'week', 'month', 'year'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_plans_status" AS ENUM('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TYPE "public"."enum_bookings_payment_method_used" ADD VALUE 'subscription'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TYPE "public"."enum_booking_transactions_payment_method" ADD VALUE 'subscription'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE TABLE IF NOT EXISTS "bookings_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"booking_transactions_id" integer
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
  	"sessions_information_allow_multiple_bookings_per_timeslot" boolean DEFAULT false,
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
  
  DO $$ BEGIN ALTER TABLE "memberships_features" DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "memberships" DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "header_nav_items" DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "header" DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "header_rels" DISABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
  DROP TABLE IF EXISTS "memberships_features" CASCADE;
  DROP TABLE IF EXISTS "memberships" CASCADE;
  DROP TABLE IF EXISTS "header_nav_items" CASCADE;
  DROP TABLE IF EXISTS "header" CASCADE;
  DROP TABLE IF EXISTS "header_rels" CASCADE;
  DO $$ BEGIN ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_parent_1_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  
  DO $$ BEGIN ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_pages_1_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_posts_1_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" DROP CONSTRAINT "class_options_rels_memberships_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_memberships_id_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_memberships_fk"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
  
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  DROP TYPE "public"."enum_admin_invitations_role";
  CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'tenant-admin', 'user');
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_admin_invitations_role";
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE "public"."enum_admin_invitations_role" USING "role"::"public"."enum_admin_invitations_role";
  ALTER TABLE "users_role" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'tenant-admin', 'user');
  ALTER TABLE "users_role" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_role" USING "value"::"public"."enum_users_role";
  DROP INDEX IF EXISTS "footer_logo_1_idx";
  DROP INDEX IF EXISTS "footer_rels_order_1_idx";
  DROP INDEX IF EXISTS "footer_rels_parent_1_idx";
  DROP INDEX IF EXISTS "footer_rels_path_1_idx";
  DROP INDEX IF EXISTS "footer_rels_pages_id_1_idx";
  DROP INDEX IF EXISTS "footer_rels_posts_id_1_idx";
  DROP INDEX IF EXISTS "class_options_rels_memberships_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_memberships_id_idx";
  ALTER TABLE "footer" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "footer" ALTER COLUMN "updated_at" SET NOT NULL;
  ALTER TABLE "footer" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "footer" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-10T06:47:06.223Z';
  DO $$ BEGIN ALTER TABLE "footer" ADD COLUMN "tenant_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" ADD COLUMN "plans_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "bookings" ADD COLUMN "subscription_id_used" numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_pass_types" ADD COLUMN "price_information_price" numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "booking_transactions" ADD COLUMN "subscription_id" numeric; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "bookings_rels" ADD CONSTRAINT "bookings_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "plans_features" ADD CONSTRAINT "plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "bookings_rels_order_idx" ON "bookings_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "bookings_rels_parent_idx" ON "bookings_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "bookings_rels_path_idx" ON "bookings_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "bookings_rels_booking_transactions_id_idx" ON "bookings_rels" USING btree ("booking_transactions_id");
  CREATE INDEX IF NOT EXISTS "plans_features_order_idx" ON "plans_features" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "plans_features_parent_id_idx" ON "plans_features" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "plans_tenant_idx" ON "plans" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "plans_created_at_idx" ON "plans" USING btree ("created_at");
  DO $$ BEGIN ALTER TABLE "footer" ADD CONSTRAINT "footer_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE UNIQUE INDEX IF NOT EXISTS "footer_tenant_idx" ON "footer" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "footer_logo_idx" ON "footer" USING btree ("logo_id");
  CREATE INDEX IF NOT EXISTS "footer_updated_at_idx" ON "footer" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "footer_created_at_idx" ON "footer" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "footer_rels_order_idx" ON "footer_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "footer_rels_parent_idx" ON "footer_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "footer_rels_path_idx" ON "footer_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "footer_rels_pages_id_idx" ON "footer_rels" USING btree ("pages_id");
  CREATE INDEX IF NOT EXISTS "footer_rels_posts_id_idx" ON "footer_rels" USING btree ("posts_id");
  CREATE INDEX IF NOT EXISTS "class_options_rels_plans_id_idx" ON "class_options_rels" USING btree ("plans_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  DO $$ BEGIN ALTER TABLE "class_options" DROP COLUMN "payment_methods_payments_enabled"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_options_rels" DROP COLUMN "memberships_id"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "class_pass_types" DROP COLUMN "price_information_price_cents"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "memberships_id"; EXCEPTION WHEN undefined_column THEN NULL; END $$;
  DROP TYPE IF EXISTS "public"."enum_memberships_sessions_information_interval";
  DROP TYPE IF EXISTS "public"."enum_memberships_price_information_interval";
  DROP TYPE IF EXISTS "public"."enum_memberships_status";
  DROP TYPE IF EXISTS "public"."enum_header_nav_items_link_type";
  DROP TYPE IF EXISTS "public"."enum_header_nav_items_button_variant";
  DROP TYPE IF EXISTS "public"."enum_header_styling_padding";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_memberships_sessions_information_interval" AS ENUM('day', 'week', 'month', 'quarter', 'year');
  CREATE TYPE "public"."enum_memberships_price_information_interval" AS ENUM('day', 'week', 'month', 'year');
  CREATE TYPE "public"."enum_memberships_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_header_nav_items_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_header_nav_items_button_variant" AS ENUM('default', 'outline', 'secondary', 'ghost');
  CREATE TYPE "public"."enum_header_styling_padding" AS ENUM('small', 'medium', 'large');
  CREATE TABLE "memberships_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"sessions_information_sessions" numeric,
  	"sessions_information_interval_count" numeric,
  	"sessions_information_interval" "enum_memberships_sessions_information_interval",
  	"stripe_product_id" varchar,
  	"price_information_price" numeric,
  	"price_information_interval_count" numeric,
  	"price_information_interval" "enum_memberships_price_information_interval" DEFAULT 'month',
  	"price_j_s_o_n" varchar,
  	"status" "enum_memberships_status" DEFAULT 'active' NOT NULL,
  	"skip_sync" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "header_nav_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_header_nav_items_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL,
  	"render_as_button" boolean DEFAULT false,
  	"button_variant" "enum_header_nav_items_button_variant" DEFAULT 'default'
  );
  
  CREATE TABLE "header" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"logo_link" varchar DEFAULT '/',
  	"styling_background_color" varchar,
  	"styling_text_color" varchar,
  	"styling_sticky" boolean DEFAULT false,
  	"styling_padding" "enum_header_styling_padding" DEFAULT 'medium',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "header_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  ALTER TABLE "bookings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bookings_rels" CASCADE;
  DROP TABLE "plans_features" CASCADE;
  DROP TABLE "plans" CASCADE;
  ALTER TABLE "footer" DROP CONSTRAINT "footer_tenant_id_tenants_id_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_parent_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_pages_fk";
  
  ALTER TABLE "footer_rels" DROP CONSTRAINT "footer_rels_posts_fk";
  
  ALTER TABLE "class_options_rels" DROP CONSTRAINT "class_options_rels_plans_fk";
  
  ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_plans_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_plans_fk";
  
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::text;
  DROP TYPE "public"."enum_admin_invitations_role";
  CREATE TYPE "public"."enum_admin_invitations_role" AS ENUM('admin', 'user', 'tenant-admin');
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DEFAULT 'admin'::"public"."enum_admin_invitations_role";
  ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET DATA TYPE "public"."enum_admin_invitations_role" USING "role"::"public"."enum_admin_invitations_role";
  ALTER TABLE "bookings" ALTER COLUMN "payment_method_used" SET DATA TYPE text;
  DROP TYPE "public"."enum_bookings_payment_method_used";
  CREATE TYPE "public"."enum_bookings_payment_method_used" AS ENUM('stripe', 'class_pass');
  ALTER TABLE "bookings" ALTER COLUMN "payment_method_used" SET DATA TYPE "public"."enum_bookings_payment_method_used" USING "payment_method_used"::"public"."enum_bookings_payment_method_used";
  ALTER TABLE "booking_transactions" ALTER COLUMN "payment_method" SET DATA TYPE text;
  DROP TYPE "public"."enum_booking_transactions_payment_method";
  CREATE TYPE "public"."enum_booking_transactions_payment_method" AS ENUM('stripe', 'class_pass');
  ALTER TABLE "booking_transactions" ALTER COLUMN "payment_method" SET DATA TYPE "public"."enum_booking_transactions_payment_method" USING "payment_method"::"public"."enum_booking_transactions_payment_method";
  ALTER TABLE "users_role" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user', 'tenant-admin');
  ALTER TABLE "users_role" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_role" USING "value"::"public"."enum_users_role";
  DROP INDEX "footer_tenant_idx";
  DROP INDEX "footer_logo_idx";
  DROP INDEX "footer_updated_at_idx";
  DROP INDEX "footer_created_at_idx";
  DROP INDEX "footer_rels_order_idx";
  DROP INDEX "footer_rels_parent_idx";
  DROP INDEX "footer_rels_path_idx";
  DROP INDEX "footer_rels_pages_id_idx";
  DROP INDEX "footer_rels_posts_id_idx";
  DROP INDEX "class_options_rels_plans_id_idx";
  DROP INDEX "payload_locked_documents_rels_plans_id_idx";
  ALTER TABLE "footer" ALTER COLUMN "updated_at" DROP DEFAULT;
  ALTER TABLE "footer" ALTER COLUMN "updated_at" DROP NOT NULL;
  ALTER TABLE "footer" ALTER COLUMN "created_at" DROP DEFAULT;
  ALTER TABLE "footer" ALTER COLUMN "created_at" DROP NOT NULL;
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-01-29T09:52:04.867Z';
  ALTER TABLE "class_options" ADD COLUMN "payment_methods_payments_enabled" boolean DEFAULT false;
  ALTER TABLE "class_options_rels" ADD COLUMN "memberships_id" integer;
  ALTER TABLE "class_pass_types" ADD COLUMN "price_information_price_cents" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "memberships_id" integer;
  ALTER TABLE "memberships_features" ADD CONSTRAINT "memberships_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "header_nav_items" ADD CONSTRAINT "header_nav_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header" ADD CONSTRAINT "header_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."header"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "header_rels" ADD CONSTRAINT "header_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "memberships_features_order_idx" ON "memberships_features" USING btree ("_order");
  CREATE INDEX "memberships_features_parent_id_idx" ON "memberships_features" USING btree ("_parent_id");
  CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("tenant_id");
  CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
  CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
  CREATE INDEX "header_nav_items_order_idx" ON "header_nav_items" USING btree ("_order");
  CREATE INDEX "header_nav_items_parent_id_idx" ON "header_nav_items" USING btree ("_parent_id");
  CREATE INDEX "header_logo_idx" ON "header" USING btree ("logo_id");
  CREATE INDEX "header_rels_order_idx" ON "header_rels" USING btree ("order");
  CREATE INDEX "header_rels_parent_idx" ON "header_rels" USING btree ("parent_id");
  CREATE INDEX "header_rels_path_idx" ON "header_rels" USING btree ("path");
  CREATE INDEX "header_rels_pages_id_idx" ON "header_rels" USING btree ("pages_id");
  CREATE INDEX "header_rels_posts_id_idx" ON "header_rels" USING btree ("posts_id");
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_parent_1_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_pages_1_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_rels" ADD CONSTRAINT "footer_rels_posts_1_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "class_options_rels" ADD CONSTRAINT "class_options_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_memberships_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_booking_transactions_fk" FOREIGN KEY ("booking_transactions_id") REFERENCES "public"."booking_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "footer_logo_1_idx" ON "footer" USING btree ("logo_id");
  CREATE INDEX "footer_rels_order_1_idx" ON "footer_rels" USING btree ("order");
  CREATE INDEX "footer_rels_parent_1_idx" ON "footer_rels" USING btree ("parent_id");
  CREATE INDEX "footer_rels_path_1_idx" ON "footer_rels" USING btree ("path");
  CREATE INDEX "footer_rels_pages_id_1_idx" ON "footer_rels" USING btree ("pages_id");
  CREATE INDEX "footer_rels_posts_id_1_idx" ON "footer_rels" USING btree ("posts_id");
  CREATE INDEX "class_options_rels_memberships_id_idx" ON "class_options_rels" USING btree ("memberships_id");
  CREATE INDEX "payload_locked_documents_rels_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("memberships_id");
  ALTER TABLE "footer" DROP COLUMN "tenant_id";
  ALTER TABLE "class_options_rels" DROP COLUMN "plans_id";
  ALTER TABLE "bookings" DROP COLUMN "subscription_id_used";
  ALTER TABLE "class_pass_types" DROP COLUMN "price_information_price";
  ALTER TABLE "booking_transactions" DROP COLUMN "subscription_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plans_id";
  DROP TYPE "public"."enum_plans_sessions_information_interval";
  DROP TYPE "public"."enum_plans_price_information_interval";
  DROP TYPE "public"."enum_plans_status";`)
}
