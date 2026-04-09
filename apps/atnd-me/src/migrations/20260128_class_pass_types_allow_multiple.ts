import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add allowMultipleBookingsPerTimeslot to class_pass_types (default true).
 * When true, users can use multiple credits from this pass type on the same timeslot.
 * Table may not exist yet if migrate:fresh runs before Payload has created it; only alter if present.
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
