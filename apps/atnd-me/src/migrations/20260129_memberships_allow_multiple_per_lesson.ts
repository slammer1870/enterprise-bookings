import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add allowMultipleBookingsPerLesson to memberships.sessionsInformation.
 * When true (and sessions is defined), subscribers can use multiple session credits on the same lesson.
 * Only alter if memberships table exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'memberships') THEN
        ALTER TABLE "memberships"
          ADD COLUMN IF NOT EXISTS "sessions_information_allow_multiple_bookings_per_lesson" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'memberships') THEN
        ALTER TABLE "memberships"
          DROP COLUMN IF EXISTS "sessions_information_allow_multiple_bookings_per_lesson";
      END IF;
    END $$;
  `)
}
