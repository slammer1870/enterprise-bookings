import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Persist Event block timeslotDate so draft autosave does not wipe the admin
 * day filter (virtual fields are dropped on rehydrate).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event"
      ADD COLUMN IF NOT EXISTS "timeslot_date" timestamp(3) with time zone;

    ALTER TABLE "_pages_v_blocks_event"
      ADD COLUMN IF NOT EXISTS "timeslot_date" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_event" DROP COLUMN IF EXISTS "timeslot_date";
    ALTER TABLE "_pages_v_blocks_event" DROP COLUMN IF EXISTS "timeslot_date";
  `)
}
