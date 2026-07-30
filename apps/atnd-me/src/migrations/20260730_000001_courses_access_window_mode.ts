import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Admin either/or for course access: fixed dates vs duration from purchase.
 * Backfills access_window_mode from existing start/end or duration fields.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_courses_access_window_mode" AS ENUM('fixed', 'duration');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "access_window_mode" "enum_courses_access_window_mode";
  `)

  await db.execute(sql`
    UPDATE "courses"
    SET "access_window_mode" = 'fixed'
    WHERE "access_window_mode" IS NULL
      AND "start_date" IS NOT NULL
      AND "end_date" IS NOT NULL;
  `)

  await db.execute(sql`
    UPDATE "courses"
    SET "access_window_mode" = 'duration'
    WHERE "access_window_mode" IS NULL
      AND "duration_length" IS NOT NULL;
  `)

  await db.execute(sql`
    UPDATE "courses"
    SET "access_window_mode" = 'duration'
    WHERE "access_window_mode" IS NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "courses"
      ALTER COLUMN "access_window_mode" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses"
      DROP COLUMN IF EXISTS "access_window_mode";
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_courses_access_window_mode";
  `)
}
