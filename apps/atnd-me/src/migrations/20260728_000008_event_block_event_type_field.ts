import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Event block: event type picker to narrow timeslot selection in admin.
 * Backfills event_type_id from the linked timeslot where possible.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event"
      ADD COLUMN IF NOT EXISTS "event_type_id" integer;

    ALTER TABLE "_pages_v_blocks_event"
      ADD COLUMN IF NOT EXISTS "event_type_id" integer;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pages_blocks_event_event_type_id_event_types_id_fk'
      ) THEN
        ALTER TABLE "pages_blocks_event"
          ADD CONSTRAINT "pages_blocks_event_event_type_id_event_types_id_fk"
          FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '_pages_v_blocks_event_event_type_id_event_types_id_fk'
      ) THEN
        ALTER TABLE "_pages_v_blocks_event"
          ADD CONSTRAINT "_pages_v_blocks_event_event_type_id_event_types_id_fk"
          FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "pages_blocks_event_event_type_idx"
      ON "pages_blocks_event" USING btree ("event_type_id");
    CREATE INDEX IF NOT EXISTS "_pages_v_blocks_event_event_type_idx"
      ON "_pages_v_blocks_event" USING btree ("event_type_id");
  `)

  await db.execute(sql`
    UPDATE "pages_blocks_event" AS b
    SET "event_type_id" = t."event_type_id"
    FROM "timeslots" AS t
    WHERE b."timeslot_id" = t."id"
      AND b."event_type_id" IS NULL
      AND t."event_type_id" IS NOT NULL;

    UPDATE "_pages_v_blocks_event" AS b
    SET "event_type_id" = t."event_type_id"
    FROM "timeslots" AS t
    WHERE b."timeslot_id" = t."id"
      AND b."event_type_id" IS NULL
      AND t."event_type_id" IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event" DROP CONSTRAINT IF EXISTS "pages_blocks_event_event_type_id_event_types_id_fk";
    ALTER TABLE "_pages_v_blocks_event" DROP CONSTRAINT IF EXISTS "_pages_v_blocks_event_event_type_id_event_types_id_fk";
    DROP INDEX IF EXISTS "pages_blocks_event_event_type_idx";
    DROP INDEX IF EXISTS "_pages_v_blocks_event_event_type_idx";
    ALTER TABLE "pages_blocks_event" DROP COLUMN IF EXISTS "event_type_id";
    ALTER TABLE "_pages_v_blocks_event" DROP COLUMN IF EXISTS "event_type_id";
  `)
}
