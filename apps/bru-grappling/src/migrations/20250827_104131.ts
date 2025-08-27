import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_hero_waitlist" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"background_image_id" integer NOT NULL,
  	"logo_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"form_id" integer NOT NULL,
  	"block_name" varchar
  );
  
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-27T10:41:31.725Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-27T10:41:31.725Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-27T10:41:31.725Z';
  ALTER TABLE "pages_blocks_hero_waitlist" ADD CONSTRAINT "pages_blocks_hero_waitlist_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_waitlist" ADD CONSTRAINT "pages_blocks_hero_waitlist_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_waitlist" ADD CONSTRAINT "pages_blocks_hero_waitlist_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_waitlist" ADD CONSTRAINT "pages_blocks_hero_waitlist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_hero_waitlist_order_idx" ON "pages_blocks_hero_waitlist" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_waitlist_parent_id_idx" ON "pages_blocks_hero_waitlist" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_waitlist_path_idx" ON "pages_blocks_hero_waitlist" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_waitlist_background_image_idx" ON "pages_blocks_hero_waitlist" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_hero_waitlist_logo_idx" ON "pages_blocks_hero_waitlist" USING btree ("logo_id");
  CREATE INDEX "pages_blocks_hero_waitlist_form_idx" ON "pages_blocks_hero_waitlist" USING btree ("form_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero_waitlist" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "pages_blocks_hero_waitlist" CASCADE;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-26T18:24:31.015Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-26T18:24:31.015Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-26T18:24:31.015Z';`)
}
