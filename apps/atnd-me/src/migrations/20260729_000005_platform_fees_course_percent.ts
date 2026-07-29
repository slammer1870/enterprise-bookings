import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add course platform fee percent to platform-fees defaults and overrides.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "platform_fees"
      ADD COLUMN IF NOT EXISTS "defaults_course_percent" numeric DEFAULT 3 NOT NULL;

    ALTER TABLE "platform_fees_overrides"
      ADD COLUMN IF NOT EXISTS "course_percent" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "platform_fees_overrides"
      DROP COLUMN IF EXISTS "course_percent";

    ALTER TABLE "platform_fees"
      DROP COLUMN IF EXISTS "defaults_course_percent";
  `)
}
