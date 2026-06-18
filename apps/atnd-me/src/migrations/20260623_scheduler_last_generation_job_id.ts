import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Track the most recent timeslot generation job per scheduler document so the admin UI
 * can show generation status after save.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "scheduler"
      ADD COLUMN IF NOT EXISTS "last_generation_job_id" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "scheduler"
      DROP COLUMN IF EXISTS "last_generation_job_id";
  `)
}
