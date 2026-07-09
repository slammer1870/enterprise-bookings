import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Converts hero_sched_sanc `location` from a single FK to a hasMany relationship
 * (hero_sched_sanc_rels / _hero_sched_sanc_v_rels).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "hero_sched_sanc_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" varchar NOT NULL,
      "path" varchar NOT NULL,
      "locations_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "hero_sched_sanc_rels"
        ADD CONSTRAINT "hero_sched_sanc_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."hero_sched_sanc"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "hero_sched_sanc_rels"
        ADD CONSTRAINT "hero_sched_sanc_rels_locations_fk"
          FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_rels_order_idx"
      ON "hero_sched_sanc_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_rels_parent_idx"
      ON "hero_sched_sanc_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_rels_path_idx"
      ON "hero_sched_sanc_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_rels_locations_id_idx"
      ON "hero_sched_sanc_rels" USING btree ("locations_id");

    INSERT INTO "hero_sched_sanc_rels" ("order", "parent_id", "path", "locations_id")
    SELECT 1, "id", 'location', "location_id"
    FROM "hero_sched_sanc"
    WHERE "location_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "hero_sched_sanc_rels" r
        WHERE r."parent_id" = "hero_sched_sanc"."id" AND r."path" = 'location'
      );

    DROP INDEX IF EXISTS "hero_sched_sanc_location_idx";
    ALTER TABLE "hero_sched_sanc"
      DROP CONSTRAINT IF EXISTS "hero_sched_sanc_location_id_locations_id_fk";
    ALTER TABLE "hero_sched_sanc"
      DROP COLUMN IF EXISTS "location_id";

    CREATE TABLE IF NOT EXISTS "_hero_sched_sanc_v_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "locations_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "_hero_sched_sanc_v_rels"
        ADD CONSTRAINT "_hero_sched_sanc_v_rels_parent_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."_hero_sched_sanc_v"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_hero_sched_sanc_v_rels"
        ADD CONSTRAINT "_hero_sched_sanc_v_rels_locations_fk"
          FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id")
          ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_rels_order_idx"
      ON "_hero_sched_sanc_v_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_rels_parent_idx"
      ON "_hero_sched_sanc_v_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_rels_path_idx"
      ON "_hero_sched_sanc_v_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_rels_locations_id_idx"
      ON "_hero_sched_sanc_v_rels" USING btree ("locations_id");

    INSERT INTO "_hero_sched_sanc_v_rels" ("order", "parent_id", "path", "locations_id")
    SELECT 1, "id", 'location', "location_id"
    FROM "_hero_sched_sanc_v"
    WHERE "location_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "_hero_sched_sanc_v_rels" r
        WHERE r."parent_id" = "_hero_sched_sanc_v"."id" AND r."path" = 'location'
      );

    DROP INDEX IF EXISTS "_hero_sched_sanc_v_location_idx";
    ALTER TABLE "_hero_sched_sanc_v"
      DROP CONSTRAINT IF EXISTS "_hero_sched_sanc_v_location_id_locations_id_fk";
    ALTER TABLE "_hero_sched_sanc_v"
      DROP COLUMN IF EXISTS "location_id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "hero_sched_sanc"
      ADD COLUMN IF NOT EXISTS "location_id" integer;

    UPDATE "hero_sched_sanc" h
    SET "location_id" = sub."locations_id"
    FROM (
      SELECT DISTINCT ON ("parent_id") "parent_id", "locations_id"
      FROM "hero_sched_sanc_rels"
      WHERE "path" = 'location' AND "locations_id" IS NOT NULL
      ORDER BY "parent_id", "order" ASC NULLS LAST, "id" ASC
    ) sub
    WHERE h."id" = sub."parent_id";

    ALTER TABLE "_hero_sched_sanc_v"
      ADD COLUMN IF NOT EXISTS "location_id" integer;

    UPDATE "_hero_sched_sanc_v" h
    SET "location_id" = sub."locations_id"
    FROM (
      SELECT DISTINCT ON ("parent_id") "parent_id", "locations_id"
      FROM "_hero_sched_sanc_v_rels"
      WHERE "path" = 'location' AND "locations_id" IS NOT NULL
      ORDER BY "parent_id", "order" ASC NULLS LAST, "id" ASC
    ) sub
    WHERE h."id" = sub."parent_id";

    DROP TABLE IF EXISTS "_hero_sched_sanc_v_rels" CASCADE;
    DROP TABLE IF EXISTS "hero_sched_sanc_rels" CASCADE;
  `)
}
