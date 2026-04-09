import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_version_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_class_pass_settings_pricing" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_hero_links" CASCADE;
  DROP TABLE "_pages_v_version_hero_links" CASCADE;
  DROP TABLE "tenants_class_pass_settings_pricing" CASCADE;
  ALTER TABLE "pages" DROP CONSTRAINT "pages_hero_media_id_media_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk";
  
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE text;
  UPDATE "drop_ins_payment_methods" SET "value" = 'card' WHERE "value" = 'cash';
  DROP TYPE "public"."enum_drop_ins_payment_methods";
  CREATE TYPE "public"."enum_drop_ins_payment_methods" AS ENUM('card');
  ALTER TABLE "drop_ins_payment_methods" ALTER COLUMN "value" SET DATA TYPE "public"."enum_drop_ins_payment_methods" USING "value"::"public"."enum_drop_ins_payment_methods";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'generateTimeslotsFromSchedule', 'schedulePublish');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'generateTimeslotsFromSchedule', 'schedulePublish');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "pages_hero_hero_media_idx";
  DROP INDEX "_pages_v_version_hero_version_hero_media_idx";
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-11T14:48:27.176Z';
  DO $$ BEGIN ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
  ALTER TABLE "pages" DROP COLUMN "hero_type";
  ALTER TABLE "pages" DROP COLUMN "hero_rich_text";
  ALTER TABLE "pages" DROP COLUMN "hero_media_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_type";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_rich_text";
  ALTER TABLE "_pages_v" DROP COLUMN "version_hero_media_id";
  ALTER TABLE "tenants" DROP COLUMN "class_pass_settings_enabled";
  ALTER TABLE "tenants" DROP COLUMN "class_pass_settings_default_expiration_days";
  DROP TYPE "public"."enum_pages_hero_links_link_type";
  DROP TYPE "public"."enum_pages_hero_links_link_appearance";
  DROP TYPE "public"."enum_pages_hero_type";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_type";
  DROP TYPE "public"."enum__pages_v_version_hero_links_link_appearance";
  DROP TYPE "public"."enum__pages_v_version_hero_type";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_pages_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_pages_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__pages_v_version_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__pages_v_version_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  ALTER TYPE "public"."enum_drop_ins_payment_methods" ADD VALUE 'cash' BEFORE 'card';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'syncStripeSubscriptions' BEFORE 'schedulePublish';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'syncStripeSubscriptions' BEFORE 'schedulePublish';
  CREATE TABLE "pages_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_pages_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_pages_hero_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "_pages_v_version_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__pages_v_version_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__pages_v_version_hero_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "tenants_class_pass_settings_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quantity" numeric NOT NULL,
  	"price" numeric NOT NULL,
  	"name" varchar NOT NULL
  );
  
  ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-10T06:47:06.223Z';
  ALTER TABLE "pages" ADD COLUMN "hero_type" "enum_pages_hero_type" DEFAULT 'lowImpact';
  ALTER TABLE "pages" ADD COLUMN "hero_rich_text" jsonb;
  ALTER TABLE "pages" ADD COLUMN "hero_media_id" integer;
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_type" "enum__pages_v_version_hero_type" DEFAULT 'lowImpact';
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_rich_text" jsonb;
  ALTER TABLE "_pages_v" ADD COLUMN "version_hero_media_id" integer;
  ALTER TABLE "tenants" ADD COLUMN "class_pass_settings_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "class_pass_settings_default_expiration_days" numeric DEFAULT 365;
  ALTER TABLE "pages_hero_links" ADD CONSTRAINT "pages_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_version_hero_links" ADD CONSTRAINT "_pages_v_version_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants_class_pass_settings_pricing" ADD CONSTRAINT "tenants_class_pass_settings_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_hero_links_order_idx" ON "pages_hero_links" USING btree ("_order");
  CREATE INDEX "pages_hero_links_parent_id_idx" ON "pages_hero_links" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_version_hero_links_order_idx" ON "_pages_v_version_hero_links" USING btree ("_order");
  CREATE INDEX "_pages_v_version_hero_links_parent_id_idx" ON "_pages_v_version_hero_links" USING btree ("_parent_id");
  CREATE INDEX "tenants_class_pass_settings_pricing_order_idx" ON "tenants_class_pass_settings_pricing" USING btree ("_order");
  CREATE INDEX "tenants_class_pass_settings_pricing_parent_id_idx" ON "tenants_class_pass_settings_pricing" USING btree ("_parent_id");
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_hero_hero_media_idx" ON "pages" USING btree ("hero_media_id");
  CREATE INDEX "_pages_v_version_hero_version_hero_media_idx" ON "_pages_v" USING btree ("version_hero_media_id");
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";`)
}
