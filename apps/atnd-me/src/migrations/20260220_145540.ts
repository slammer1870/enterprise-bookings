import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-20T14:55:39.944Z';
  ALTER TABLE "pages_blocks_hero_with_location" ADD COLUMN "image_overlay_hex" varchar;
  ALTER TABLE "pages_blocks_hero_with_location" ADD COLUMN "image_overlay_opacity" numeric DEFAULT 70;
  ALTER TABLE "_pages_v_blocks_hero_with_location" ADD COLUMN "image_overlay_hex" varchar;
  ALTER TABLE "_pages_v_blocks_hero_with_location" ADD COLUMN "image_overlay_opacity" numeric DEFAULT 70;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeslots" ALTER COLUMN "date" SET DEFAULT '2026-02-19T18:08:12.105Z';
  ALTER TABLE "pages_blocks_hero_with_location" DROP COLUMN "image_overlay_hex";
  ALTER TABLE "pages_blocks_hero_with_location" DROP COLUMN "image_overlay_opacity";
  ALTER TABLE "_pages_v_blocks_hero_with_location" DROP COLUMN "image_overlay_hex";
  ALTER TABLE "_pages_v_blocks_hero_with_location" DROP COLUMN "image_overlay_opacity";`)
}
