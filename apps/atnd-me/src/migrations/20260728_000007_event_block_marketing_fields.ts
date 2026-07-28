import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Event block marketing fields: cover image, about rich text, Google Maps URL.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event"
      ADD COLUMN IF NOT EXISTS "cover_image_id" integer,
      ADD COLUMN IF NOT EXISTS "about" jsonb,
      ADD COLUMN IF NOT EXISTS "map_url" varchar;

    ALTER TABLE "_pages_v_blocks_event"
      ADD COLUMN IF NOT EXISTS "cover_image_id" integer,
      ADD COLUMN IF NOT EXISTS "about" jsonb,
      ADD COLUMN IF NOT EXISTS "map_url" varchar;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_event_cover_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_event"
          ADD CONSTRAINT "pages_blocks_event_cover_image_id_media_id_fk"
          FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_pages_v_blocks_event_cover_image_id_media_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_event"
          ADD CONSTRAINT "_pages_v_blocks_event_cover_image_id_media_id_fk"
          FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_event_cover_image_idx"
      ON "pages_blocks_event" USING btree ("cover_image_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_cover_image_idx"
      ON "_pages_v_blocks_event" USING btree ("cover_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event" DROP CONSTRAINT IF EXISTS "pages_blocks_event_cover_image_id_media_id_fk";
    ALTER TABLE "_pages_v_blocks_event" DROP CONSTRAINT IF EXISTS "_pages_v_blocks_event_cover_image_id_media_id_fk";
    DROP INDEX IF EXISTS "pages_blocks_event_cover_image_idx";
    DROP INDEX IF EXISTS "_pages_v_blocks_event_cover_image_idx";
    ALTER TABLE "pages_blocks_event"
      DROP COLUMN IF EXISTS "cover_image_id",
      DROP COLUMN IF EXISTS "about",
      DROP COLUMN IF EXISTS "map_url";
    ALTER TABLE "_pages_v_blocks_event"
      DROP COLUMN IF EXISTS "cover_image_id",
      DROP COLUMN IF EXISTS "about",
      DROP COLUMN IF EXISTS "map_url";
  `)
}
