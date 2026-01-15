import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Kyuzo lessons are provided by @repo/bookings-plugin and include lockout fields.
 * Some environments (notably e2e fresh DB) were missing the `original_lock_out_time`
 * column, causing lesson creation to fail with:
 *   column "original_lock_out_time" of relation "lessons" does not exist
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF to_regclass('public.lessons') IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'lessons'
            AND column_name = 'original_lock_out_time'
        ) THEN
          ALTER TABLE "lessons" ADD COLUMN "original_lock_out_time" numeric DEFAULT 0;
        END IF;

        -- Backfill: if the column exists and any rows are NULL, use current lock_out_time.
        UPDATE "lessons"
          SET "original_lock_out_time" = COALESCE("original_lock_out_time", "lock_out_time", 0);
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "original_lock_out_time";
  `)
}


