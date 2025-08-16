import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar DEFAULT 'Brú Grappling Studio' NOT NULL,
  	"logo_id" integer NOT NULL,
  	"email" varchar DEFAULT 'info@brugrappling.ie' NOT NULL,
  	"location_url" varchar DEFAULT 'https://goo.gl/maps/aqepRdNh9YcYNGuEA' NOT NULL,
  	"instagram_url" varchar DEFAULT 'https://www.instagram.com/bru_grappling/' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  DROP TABLE IF EXISTS "pages_blocks_learning_content" CASCADE;
  ALTER TABLE "pages_blocks_meet_the_team_team_members" ALTER COLUMN "bio" SET DATA TYPE jsonb USING 
    CASE 
      WHEN "bio" IS NULL THEN NULL
      WHEN "bio" = '' THEN '[]'::jsonb
      WHEN "bio"::text ~ '^[\[\{]' THEN "bio"::jsonb
      ELSE json_build_array(json_build_object('type', 'paragraph', 'children', json_build_array(json_build_object('text', "bio"))))::jsonb
    END;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-16T12:50:10.952Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-16T12:50:10.952Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-16T12:50:10.952Z';
  ALTER TABLE "pages_blocks_learning" ADD COLUMN IF NOT EXISTS "content" jsonb NOT NULL;
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'footer_logo_id_media_id_fk') THEN
      ALTER TABLE "footer" ADD CONSTRAINT "footer_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  CREATE INDEX IF NOT EXISTS "footer_logo_idx" ON "footer" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_learning_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  ALTER TABLE "footer" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "footer" CASCADE;
  ALTER TABLE "pages_blocks_meet_the_team_team_members" ALTER COLUMN "bio" SET DATA TYPE varchar;
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-14T16:50:56.058Z';
  ALTER TABLE "pages_blocks_learning_content" ADD CONSTRAINT "pages_blocks_learning_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_learning"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_learning_content_order_idx" ON "pages_blocks_learning_content" USING btree ("_order");
  CREATE INDEX "pages_blocks_learning_content_parent_id_idx" ON "pages_blocks_learning_content" USING btree ("_parent_id");
  ALTER TABLE "pages_blocks_learning" DROP COLUMN "content";`)
}
