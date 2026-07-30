import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Optional cover image for courses (listing + detail hero).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "cover_image_id" integer;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'courses_cover_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "courses"
          ADD CONSTRAINT "courses_cover_image_id_media_id_fk"
          FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "courses_cover_image_idx"
      ON "courses" USING btree ("cover_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_cover_image_id_media_id_fk";
    DROP INDEX IF EXISTS "courses_cover_image_idx";
    ALTER TABLE "courses" DROP COLUMN IF EXISTS "cover_image_id";
  `)
}
