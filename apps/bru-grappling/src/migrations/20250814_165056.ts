import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE IF EXISTS "pages_blocks_about_sections_content" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "pages_blocks_about_sections" ADD COLUMN IF NOT EXISTS "content" jsonb NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_about_sections_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"link_url" varchar,
  	"link_text" varchar
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-07T13:39:30.379Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-07T13:39:30.379Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-07T13:39:30.379Z';
  ALTER TABLE "pages_blocks_about_sections_content" ADD CONSTRAINT "pages_blocks_about_sections_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_about_sections"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_about_sections_content_order_idx" ON "pages_blocks_about_sections_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_about_sections_content_parent_id_idx" ON "pages_blocks_about_sections_content" USING btree ("_parent_id");
  ALTER TABLE "pages_blocks_about_sections" DROP COLUMN "content";`)
}
