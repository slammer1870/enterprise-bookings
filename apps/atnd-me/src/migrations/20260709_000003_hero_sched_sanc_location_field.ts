import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `location_id` to hero_sched_sanc (Hero & Schedule Multi Location block) so
 * editors can lock each block instance to a specific branch.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "hero_sched_sanc"
      ADD COLUMN IF NOT EXISTS "location_id" integer;

    DO $$ BEGIN
      ALTER TABLE "hero_sched_sanc"
        ADD CONSTRAINT "hero_sched_sanc_location_id_locations_id_fk"
          FOREIGN KEY ("location_id")
          REFERENCES "public"."locations"("id")
          ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "hero_sched_sanc_location_idx"
      ON "hero_sched_sanc" USING btree ("location_id");

    ALTER TABLE "_hero_sched_sanc_v"
      ADD COLUMN IF NOT EXISTS "location_id" integer;

    DO $$ BEGIN
      ALTER TABLE "_hero_sched_sanc_v"
        ADD CONSTRAINT "_hero_sched_sanc_v_location_id_locations_id_fk"
          FOREIGN KEY ("location_id")
          REFERENCES "public"."locations"("id")
          ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "_hero_sched_sanc_v_location_idx"
      ON "_hero_sched_sanc_v" USING btree ("location_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "hero_sched_sanc_location_idx";
    ALTER TABLE "hero_sched_sanc"
      DROP CONSTRAINT IF EXISTS "hero_sched_sanc_location_id_locations_id_fk";
    ALTER TABLE "hero_sched_sanc"
      DROP COLUMN IF EXISTS "location_id";

    DROP INDEX IF EXISTS "_hero_sched_sanc_v_location_idx";
    ALTER TABLE "_hero_sched_sanc_v"
      DROP CONSTRAINT IF EXISTS "_hero_sched_sanc_v_location_id_locations_id_fk";
    ALTER TABLE "_hero_sched_sanc_v"
      DROP COLUMN IF EXISTS "location_id";
  `)
}
