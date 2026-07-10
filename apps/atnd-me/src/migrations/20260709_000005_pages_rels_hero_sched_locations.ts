import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Hero schedule `location` hasMany is stored on pages_rels / _pages_v_rels (not hero_sched_sanc_rels).
 * Adds locations_id and backfills from hero_sched_sanc_rels where present.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_rels"
      ADD COLUMN IF NOT EXISTS "locations_id" integer;

    DO $$ BEGIN
      ALTER TABLE "pages_rels"
        ADD CONSTRAINT "pages_rels_locations_fk"
          FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "pages_rels_locations_id_idx"
      ON "pages_rels" USING btree ("locations_id");

    ALTER TABLE "_pages_v_rels"
      ADD COLUMN IF NOT EXISTS "locations_id" integer;

    DO $$ BEGIN
      ALTER TABLE "_pages_v_rels"
        ADD CONSTRAINT "_pages_v_rels_locations_fk"
          FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "_pages_v_rels_locations_id_idx"
      ON "_pages_v_rels" USING btree ("locations_id");

    INSERT INTO "pages_rels" ("order", "parent_id", "path", "locations_id")
    SELECT
      COALESCE(hsr."order", 1),
      hss."_parent_id",
      hss."_path" || '.location',
      hsr."locations_id"
    FROM "hero_sched_sanc_rels" hsr
    INNER JOIN "hero_sched_sanc" hss ON hss."id" = hsr."parent_id"
    WHERE hsr."path" = 'location'
      AND hsr."locations_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "pages_rels" pr
        WHERE pr."parent_id" = hss."_parent_id"
          AND pr."path" = hss."_path" || '.location'
          AND pr."locations_id" = hsr."locations_id"
      );

    INSERT INTO "_pages_v_rels" ("order", "parent_id", "path", "locations_id")
    SELECT
      COALESCE(hsr."order", 1),
      hsv."_parent_id",
      hsv."_path" || '.location',
      hsr."locations_id"
    FROM "_hero_sched_sanc_v_rels" hsr
    INNER JOIN "_hero_sched_sanc_v" hsv ON hsv."id" = hsr."parent_id"
    WHERE hsr."path" = 'location'
      AND hsr."locations_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "_pages_v_rels" pr
        WHERE pr."parent_id" = hsv."_parent_id"
          AND pr."path" = hsv."_path" || '.location'
          AND pr."locations_id" = hsr."locations_id"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_pages_v_rels_locations_id_idx";
    ALTER TABLE "_pages_v_rels"
      DROP CONSTRAINT IF EXISTS "_pages_v_rels_locations_fk";
    ALTER TABLE "_pages_v_rels"
      DROP COLUMN IF EXISTS "locations_id";

    DROP INDEX IF EXISTS "pages_rels_locations_id_idx";
    ALTER TABLE "pages_rels"
      DROP CONSTRAINT IF EXISTS "pages_rels_locations_fk";
    ALTER TABLE "pages_rels"
      DROP COLUMN IF EXISTS "locations_id";
  `)
}
