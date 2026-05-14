import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `default_location_id` column to the `schedule` page-block tables so that
 * the Schedule block can pre-select a branch/location when a page loads on a
 * multi-location tenant site.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "pages_blocks_schedule"
    ADD COLUMN IF NOT EXISTS "default_location_id" integer;
  ALTER TABLE "pages_blocks_schedule"
    ADD CONSTRAINT "pages_blocks_schedule_default_location_id_locations_id_fk"
      FOREIGN KEY ("default_location_id")
      REFERENCES "public"."locations"("id")
      ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "pages_blocks_schedule_default_location_idx"
    ON "pages_blocks_schedule" USING btree ("default_location_id");

  ALTER TABLE "_pages_v_blocks_schedule"
    ADD COLUMN IF NOT EXISTS "default_location_id" integer;
  ALTER TABLE "_pages_v_blocks_schedule"
    ADD CONSTRAINT "_pages_v_blocks_schedule_default_location_id_locations_id_fk"
      FOREIGN KEY ("default_location_id")
      REFERENCES "public"."locations"("id")
      ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_schedule_default_location_idx"
    ON "_pages_v_blocks_schedule" USING btree ("default_location_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "pages_blocks_schedule_default_location_idx";
  ALTER TABLE "pages_blocks_schedule"
    DROP CONSTRAINT IF EXISTS "pages_blocks_schedule_default_location_id_locations_id_fk";
  ALTER TABLE "pages_blocks_schedule"
    DROP COLUMN IF EXISTS "default_location_id";

  DROP INDEX IF EXISTS "_pages_v_blocks_schedule_default_location_idx";
  ALTER TABLE "_pages_v_blocks_schedule"
    DROP CONSTRAINT IF EXISTS "_pages_v_blocks_schedule_default_location_id_locations_id_fk";
  ALTER TABLE "_pages_v_blocks_schedule"
    DROP COLUMN IF EXISTS "default_location_id";`)
}
