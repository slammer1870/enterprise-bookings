import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add allowMultipleBookingsPerTimeslot to plans.sessionsInformation.
 * When true (and sessions is defined), subscribers can use multiple session credits on the same timeslot.
 * Only alter if plans table exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
        ALTER TABLE "plans"
          ADD COLUMN IF NOT EXISTS "sessions_information_allow_multiple_bookings_per_timeslot" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
        ALTER TABLE "plans"
          DROP COLUMN IF EXISTS "sessions_information_allow_multiple_bookings_per_timeslot";
      END IF;
    END $$;
  `)
}
