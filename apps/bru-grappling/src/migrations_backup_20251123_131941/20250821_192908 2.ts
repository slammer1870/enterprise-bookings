import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_plans_type" ADD VALUE 'family';
  CREATE TABLE "pages_blocks_faqs_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-21T19:29:08.398Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-21T19:29:08.398Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-21T19:29:08.398Z';
  ALTER TABLE "pages_blocks_faqs_faqs" ADD CONSTRAINT "pages_blocks_faqs_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faqs" ADD CONSTRAINT "pages_blocks_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_faqs_faqs_order_idx" ON "pages_blocks_faqs_faqs" USING btree ("_order");
  CREATE INDEX "pages_blocks_faqs_faqs_parent_id_idx" ON "pages_blocks_faqs_faqs" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faqs_order_idx" ON "pages_blocks_faqs" USING btree ("_order");
  CREATE INDEX "pages_blocks_faqs_parent_id_idx" ON "pages_blocks_faqs" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faqs_path_idx" ON "pages_blocks_faqs" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_faqs_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_faqs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_faqs_faqs" CASCADE;
  DROP TABLE "pages_blocks_faqs" CASCADE;
  ALTER TABLE "plans" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "plans" ALTER COLUMN "type" SET DEFAULT 'adult'::text;
  DROP TYPE "public"."enum_plans_type";
  CREATE TYPE "public"."enum_plans_type" AS ENUM('adult', 'child');
  ALTER TABLE "plans" ALTER COLUMN "type" SET DEFAULT 'adult'::"public"."enum_plans_type";
  ALTER TABLE "plans" ALTER COLUMN "type" SET DATA TYPE "public"."enum_plans_type" USING "type"::"public"."enum_plans_type";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-21T17:26:39.032Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-21T17:26:39.032Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-21T17:26:39.032Z';`)
}
