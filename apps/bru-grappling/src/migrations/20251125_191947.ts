import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "subscriptions_stripe_subscription_id_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-11-25T19:19:47.014Z';
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_tablet_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_desktop_filename" varchar;
  ALTER TABLE "pages_blocks_hero_waitlist" ADD COLUMN "enable_intro" boolean;
  ALTER TABLE "pages_blocks_hero_waitlist" ADD COLUMN "intro_content" jsonb;
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_tablet_sizes_tablet_filename_idx" ON "media" USING btree ("sizes_tablet_filename");
  CREATE INDEX "media_sizes_desktop_sizes_desktop_filename_idx" ON "media" USING btree ("sizes_desktop_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "media_sizes_card_sizes_card_filename_idx";
  DROP INDEX "media_sizes_tablet_sizes_tablet_filename_idx";
  DROP INDEX "media_sizes_desktop_sizes_desktop_filename_idx";
  ALTER TABLE "lessons" ALTER COLUMN "date" SET DEFAULT '2025-08-27T10:41:31.725Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "start_time" SET DEFAULT '2025-08-27T10:41:31.725Z';
  ALTER TABLE "scheduler_week_days_time_slot" ALTER COLUMN "end_time" SET DEFAULT '2025-08-27T10:41:31.725Z';
  CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_card_url";
  ALTER TABLE "media" DROP COLUMN "sizes_card_width";
  ALTER TABLE "media" DROP COLUMN "sizes_card_height";
  ALTER TABLE "media" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_url";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_width";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_height";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_tablet_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_url";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_width";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_height";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_desktop_filename";
  ALTER TABLE "pages_blocks_hero_waitlist" DROP COLUMN "enable_intro";
  ALTER TABLE "pages_blocks_hero_waitlist" DROP COLUMN "intro_content";`)
}
