import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure `class_pass_types.max_bookings_per_timeslot` is truly nullable with no default.
 *
 * Semantics:
 * - NULL => no per-user cap (unlimited; bounded by event type capacity)
 * - number => explicit per-user cap
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_pass_types'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'class_pass_types'
            AND column_name = 'max_bookings_per_timeslot'
        ) THEN
          ALTER TABLE "class_pass_types"
            ALTER COLUMN "max_bookings_per_timeslot" DROP DEFAULT;

          ALTER TABLE "class_pass_types"
            ALTER COLUMN "max_bookings_per_timeslot" DROP NOT NULL;
        END IF;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_pass_types'
      ) THEN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'class_pass_types'
            AND column_name = 'max_bookings_per_timeslot'
        ) THEN
          -- Revert to legacy-ish behavior: non-null default of 1.
          ALTER TABLE "class_pass_types"
            ALTER COLUMN "max_bookings_per_timeslot" SET DEFAULT 1;

          ALTER TABLE "class_pass_types"
            ALTER COLUMN "max_bookings_per_timeslot" SET NOT NULL;
        END IF;
      END IF;
    END $$;
  `)
}

