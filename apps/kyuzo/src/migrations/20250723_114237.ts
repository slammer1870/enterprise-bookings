import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-23T11:42:37.142Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-23T11:42:37.303Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-23T11:42:37.303Z';
  ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_title" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_description" varchar;
  ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "meta_image_id" integer;
  ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_title" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_description" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_meta_image_id" integer;

  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pages_meta_image_id_media_id_fk') THEN
      ALTER TABLE "pages" ADD CONSTRAINT "pages_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_meta_image_id_media_id_fk') THEN
      ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_posts_v_version_meta_image_id_media_id_fk') THEN
      ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS "pages_meta_meta_image_idx" ON "pages" USING btree ("meta_image_id");
  CREATE INDEX IF NOT EXISTS "posts_meta_meta_image_idx" ON "posts" USING btree ("meta_image_id");
  CREATE INDEX IF NOT EXISTS "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v" USING btree ("version_meta_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "pages_meta_image_id_media_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_meta_image_id_media_id_fk";
  
  ALTER TABLE "_posts_v" DROP CONSTRAINT IF EXISTS "_posts_v_version_meta_image_id_media_id_fk";
  
  DROP INDEX IF EXISTS "pages_meta_meta_image_idx";
  DROP INDEX IF EXISTS "posts_meta_meta_image_idx";
  DROP INDEX IF EXISTS "_posts_v_version_meta_version_meta_image_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-07-23T11:02:05.409Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-07-23T11:02:05.555Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-07-23T11:02:05.555Z';
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_title";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_description";
  ALTER TABLE "pages" DROP COLUMN IF EXISTS "meta_image_id";
  ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_title";
  ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_description";
  ALTER TABLE "posts" DROP COLUMN IF EXISTS "meta_image_id";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_title";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_description";
  ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_meta_image_id";`)
}
