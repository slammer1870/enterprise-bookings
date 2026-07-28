import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Event page marketing fields on timeslots: cover image + Lexical about body.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "timeslots"
      ADD COLUMN IF NOT EXISTS "cover_image_id" integer;

    ALTER TABLE "timeslots"
      ADD COLUMN IF NOT EXISTS "about" jsonb;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timeslots_cover_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "timeslots"
          ADD CONSTRAINT "timeslots_cover_image_id_media_id_fk"
          FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "timeslots_cover_image_idx"
      ON "timeslots" USING btree ("cover_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "timeslots" DROP CONSTRAINT IF EXISTS "timeslots_cover_image_id_media_id_fk";
    DROP INDEX IF EXISTS "timeslots_cover_image_idx";
    ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "cover_image_id";
    ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "about";
  `)
}
