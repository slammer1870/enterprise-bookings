import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "heading" SET DEFAULT 'Kyuzo Brazilian Jiu Jitsu';
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "subheading" SET DEFAULT 'Sign up today to get started on your Jiu Jitsu Journey!';
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-06-24T17:17:34.245Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-06-24T17:17:34.416Z';
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta1_text" varchar DEFAULT 'Kids' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta1_link" varchar DEFAULT '#kids' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta2_text" varchar DEFAULT 'Adults' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta2_link" varchar DEFAULT '#adults' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "form_title" varchar DEFAULT 'FREE TRIAL CLASS' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "form_description" varchar DEFAULT 'Fill out the short form to try Jiu Jitsu for free' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "form_id" integer NOT NULL;
  ALTER TABLE "pages_blocks_schedule" ADD CONSTRAINT "pages_blocks_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_schedule_order_idx" ON "pages_blocks_schedule" USING btree ("_order");
  CREATE INDEX "pages_blocks_schedule_parent_id_idx" ON "pages_blocks_schedule" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_schedule_path_idx" ON "pages_blocks_schedule" USING btree ("_path");
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_form_idx" ON "pages_blocks_hero" USING btree ("form_id");
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta_link";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta_title";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta_description";`)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_schedule" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_schedule" CASCADE;
  ALTER TABLE "pages_blocks_hero" DROP CONSTRAINT "pages_blocks_hero_form_id_forms_id_fk";
  
  DROP INDEX "pages_blocks_hero_form_idx";
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "heading" SET DEFAULT 'Dark Horse Strength and Performance';
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "subheading" SET DEFAULT 'Small Group Personal Training in a Private Facility located in Bray, Co. Wicklow';
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-06-21T07:41:26.132Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_monday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_tuesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_wednesday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_thursday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_friday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_saturday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "start_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler_schedule_sunday_slots" ALTER COLUMN "end_time" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler" ALTER COLUMN "start_date" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "scheduler" ALTER COLUMN "end_date" SET DEFAULT '2025-06-21T07:41:26.282Z';
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta_link" varchar DEFAULT '/personal-training' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta_title" varchar DEFAULT 'Personal Training' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "cta_description" varchar DEFAULT 'Do you want to become our next success story? Your own program, nutritional support and expert guidance. Achieve the fitness goals you''ve always dreamed of. Results guaranteed.' NOT NULL;
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta1_text";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta1_link";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta2_text";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "cta2_link";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "form_title";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "form_description";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "form_id";`)
}
