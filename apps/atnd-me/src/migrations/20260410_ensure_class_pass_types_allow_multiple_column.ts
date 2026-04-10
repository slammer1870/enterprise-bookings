import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensures allow_multiple_bookings_per_timeslot exists on class_pass_types.
 * Fixes prod (and any DB) where the table predates 20260128 or was created via
 * CREATE TABLE IF NOT EXISTS without this column.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          ADD COLUMN IF NOT EXISTS "allow_multiple_bookings_per_timeslot" boolean DEFAULT true NOT NULL;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          DROP COLUMN IF EXISTS "allow_multiple_bookings_per_timeslot";
      END IF;
    END $$;
  `)
}
