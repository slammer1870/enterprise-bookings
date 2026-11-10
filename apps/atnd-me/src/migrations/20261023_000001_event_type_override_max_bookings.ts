import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Optional per-event-type max bookings per timeslot on class pass types and membership plans.
 * Blank keeps the product cap. A number replaces it for that event type only.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.class_pass_types_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "class_pass_types_event_type_overrides"
          ADD COLUMN IF NOT EXISTS "max_bookings_per_timeslot" numeric;
      END IF;

      IF to_regclass('public.plans_sessions_information_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          ADD COLUMN IF NOT EXISTS "max_bookings_per_timeslot" numeric;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.class_pass_types_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "class_pass_types_event_type_overrides"
          DROP COLUMN IF EXISTS "max_bookings_per_timeslot";
      END IF;

      IF to_regclass('public.plans_sessions_information_event_type_overrides') IS NOT NULL THEN
        ALTER TABLE "plans_sessions_information_event_type_overrides"
          DROP COLUMN IF EXISTS "max_bookings_per_timeslot";
      END IF;
    END $$;
  `)
}
