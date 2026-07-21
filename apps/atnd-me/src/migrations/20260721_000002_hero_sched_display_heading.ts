import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Hero & Schedule block: optional `displayHeading` above the schedule panel.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'hero_sched_sanc'
          AND column_name = 'display_heading'
      ) THEN
        ALTER TABLE "hero_sched_sanc"
          ADD COLUMN "display_heading" varchar;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '_hero_sched_sanc_v'
          AND column_name = 'display_heading'
      ) THEN
        ALTER TABLE "_hero_sched_sanc_v"
          ADD COLUMN "display_heading" varchar;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "hero_sched_sanc" DROP COLUMN IF EXISTS "display_heading";
    ALTER TABLE "_hero_sched_sanc_v" DROP COLUMN IF EXISTS "display_heading";
  `)
}
