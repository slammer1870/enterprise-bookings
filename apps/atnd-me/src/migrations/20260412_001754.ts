import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Schema sync migration: safe when `20260410_rename_dh_dashboard_to_two_column_layout`
 * already created `pages_blocks_two_column_layout` tables, and when posts tenant/slug
 * migrations already ran (duplicate columns/constraints/indexes are skipped).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "pages_blocks_two_column_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"left_column_heading" varchar DEFAULT 'Column one',
  	"right_column_heading" varchar DEFAULT 'Column two',
  	"block_name" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_two_column_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"left_column_heading" varchar DEFAULT 'Column one',
  	"right_column_heading" varchar DEFAULT 'Column two',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  DROP TABLE IF EXISTS "pages_blocks_dh_dashboard_layout" CASCADE;
  DROP TABLE IF EXISTS "_pages_v_blocks_dh_dashboard_layout" CASCADE;
  DROP TABLE IF EXISTS "users_roles" CASCADE;
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('heroWithLocation', 'marketingHero', 'location', 'healthBenefits', 'sectionTagline', 'missionElements', 'faqs', 'features', 'caseStudies', 'marketingCta', 'mediaBlock', 'archive', 'formBlock', 'bruHero', 'bruAbout', 'bruSchedule', 'bruLearning', 'bruMeetTheTeam', 'bruTestimonials', 'bruContact', 'bruHeroWaitlist', 'dhHero', 'dhTeam', 'dhTimetable', 'dhTestimonials', 'dhPricing', 'dhContact', 'dhGroups', 'dhLiveSchedule', 'dhLiveMembership', 'clHeroLoc', 'threeColumnLayout', 'twoColumnLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  DROP INDEX IF EXISTS "posts_slug_idx";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-04-12T00:17:54.588Z';
  DO $$ BEGIN
    ALTER TABLE "posts" ADD COLUMN "tenant_id" integer;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_posts_v" ADD COLUMN "version_tenant_id" integer;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "pages_blocks_two_column_layout" ADD CONSTRAINT "pages_blocks_two_column_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_pages_v_blocks_two_column_layout" ADD CONSTRAINT "_pages_v_blocks_two_column_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX IF NOT EXISTS "pages_blocks_two_column_layout_order_idx" ON "pages_blocks_two_column_layout" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_two_column_layout_parent_id_idx" ON "pages_blocks_two_column_layout" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_two_column_layout_path_idx" ON "pages_blocks_two_column_layout" USING btree ("_path");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_two_column_layout_order_idx" ON "_pages_v_blocks_two_column_layout" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_two_column_layout_parent_id_idx" ON "_pages_v_blocks_two_column_layout" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_two_column_layout_path_idx" ON "_pages_v_blocks_two_column_layout" USING btree ("_path");
  DO $$ BEGIN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$;
  CREATE INDEX IF NOT EXISTS "posts_tenant_idx" ON "posts" USING btree ("tenant_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_version_version_tenant_idx" ON "_posts_v" USING btree ("version_tenant_id");
  CREATE INDEX IF NOT EXISTS "startTime_tenant_idx" ON "timeslots" USING btree ("start_time","tenant_id");
  CREATE INDEX IF NOT EXISTS "timeslot_status_idx" ON "bookings" USING btree ("timeslot_id","status");
  CREATE INDEX IF NOT EXISTS "tenant_timeslot_status_idx" ON "bookings" USING btree ("tenant_id","timeslot_id","status");
  CREATE INDEX IF NOT EXISTS "posts_slug_idx" ON "posts" USING btree ("slug");
  DO $$ BEGIN
    ALTER TABLE "pages_blocks_dh_live_schedule" DROP COLUMN "tenant_id";
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_pages_v_blocks_dh_live_schedule" DROP COLUMN "tenant_id";
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "posts" DROP COLUMN "generate_slug";
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "_posts_v" DROP COLUMN "version_generate_slug";
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END $$;
  DROP TYPE IF EXISTS "public"."enum_users_roles";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_roles" AS ENUM('user', 'staff', 'admin', 'super-admin');
  CREATE TABLE "pages_blocks_dh_dashboard_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"schedule_heading" varchar DEFAULT 'Schedule',
  	"membership_heading" varchar DEFAULT 'Membership Options',
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_dh_dashboard_layout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"schedule_heading" varchar DEFAULT 'Schedule',
  	"membership_heading" varchar DEFAULT 'Membership Options',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "pages_blocks_two_column_layout" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_two_column_layout" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_two_column_layout" CASCADE;
  DROP TABLE "_pages_v_blocks_two_column_layout" CASCADE;
  ALTER TABLE "posts" DROP CONSTRAINT "posts_tenant_id_tenants_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk";
  
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_allowed_blocks";
  CREATE TYPE "public"."enum_tenants_allowed_blocks" AS ENUM('heroWithLocation', 'marketingHero', 'location', 'healthBenefits', 'sectionTagline', 'missionElements', 'faqs', 'features', 'caseStudies', 'marketingCta', 'mediaBlock', 'archive', 'formBlock', 'bruHero', 'bruAbout', 'bruSchedule', 'bruLearning', 'bruMeetTheTeam', 'bruTestimonials', 'bruContact', 'bruHeroWaitlist', 'dhHero', 'dhTeam', 'dhTimetable', 'dhTestimonials', 'dhPricing', 'dhContact', 'dhGroups', 'dhLiveSchedule', 'dhLiveMembership', 'clHeroLoc', 'threeColumnLayout', 'dhDashboardLayout');
  ALTER TABLE "tenants_allowed_blocks" ALTER COLUMN "value" SET DATA TYPE "public"."enum_tenants_allowed_blocks" USING "value"::"public"."enum_tenants_allowed_blocks";
  DROP INDEX "posts_tenant_idx";
  DROP INDEX "_posts_v_version_version_tenant_idx";
  DROP INDEX "startTime_tenant_idx";
  DROP INDEX "timeslot_status_idx";
  DROP INDEX "tenant_timeslot_status_idx";
  DROP INDEX "posts_slug_idx";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-04-09T15:24:19.314Z';
  ALTER TABLE "pages_blocks_dh_live_schedule" ADD COLUMN "tenant_id" numeric;
  ALTER TABLE "_pages_v_blocks_dh_live_schedule" ADD COLUMN "tenant_id" numeric;
  ALTER TABLE "posts" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "_posts_v" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  ALTER TABLE "pages_blocks_dh_dashboard_layout" ADD CONSTRAINT "pages_blocks_dh_dashboard_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_dh_dashboard_layout" ADD CONSTRAINT "_pages_v_blocks_dh_dashboard_layout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_dh_dashboard_layout_order_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_order");
  CREATE INDEX "pages_blocks_dh_dashboard_layout_parent_id_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_dh_dashboard_layout_path_idx" ON "pages_blocks_dh_dashboard_layout" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_dh_dashboard_layout_order_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_dh_dashboard_layout_parent_id_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_dh_dashboard_layout_path_idx" ON "_pages_v_blocks_dh_dashboard_layout" USING btree ("_path");
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  ALTER TABLE "posts" DROP COLUMN "tenant_id";
  ALTER TABLE "_posts_v" DROP COLUMN "version_tenant_id";`)
}
