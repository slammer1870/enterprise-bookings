import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Timeslots: denormalized adminTitle for human-readable relationship picker labels.
 * Values are filled by beforeChange; afterRead also computes a fallback for legacy rows.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "timeslots"
      ADD COLUMN IF NOT EXISTS "admin_title" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "timeslots" DROP COLUMN IF EXISTS "admin_title";
  `)
}
