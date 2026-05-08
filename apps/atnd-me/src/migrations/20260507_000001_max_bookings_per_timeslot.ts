import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Replace boolean multi-booking flags with numeric per-user caps:
 * - plans.sessions_information_allow_multiple_bookings_per_timeslot -> sessions_information_max_bookings_per_timeslot
 * - class_pass_types.allow_multiple_bookings_per_timeslot -> max_bookings_per_timeslot
 * - drop_ins.adjustable -> max_bookings_per_timeslot
 *
 * Semantics:
 * - 1 => allow exactly one confirmed booking per timeslot per user
 * - NULL => no per-user limit (bounded by eventType.places / remainingCapacity)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      -- plans
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
        ALTER TABLE "plans"
          ADD COLUMN IF NOT EXISTS "sessions_information_max_bookings_per_timeslot" integer;

        -- Backfill from legacy boolean if present.
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'plans'
            AND column_name = 'sessions_information_allow_multiple_bookings_per_timeslot'
        ) THEN
          UPDATE "plans"
            SET "sessions_information_max_bookings_per_timeslot" = CASE
              WHEN "sessions_information_allow_multiple_bookings_per_timeslot" = true THEN NULL
              ELSE 1
            END;
        ELSE
          UPDATE "plans"
            SET "sessions_information_max_bookings_per_timeslot" = 1;
        END IF;
      END IF;

      -- class_pass_types
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          ADD COLUMN IF NOT EXISTS "max_bookings_per_timeslot" integer;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'class_pass_types'
            AND column_name = 'allow_multiple_bookings_per_timeslot'
        ) THEN
          UPDATE "class_pass_types"
            SET "max_bookings_per_timeslot" = CASE
              WHEN "allow_multiple_bookings_per_timeslot" = true THEN NULL
              ELSE 1
            END;
        ELSE
          UPDATE "class_pass_types"
            SET "max_bookings_per_timeslot" = 1;
        END IF;
      END IF;

      -- drop_ins
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drop_ins') THEN
        ALTER TABLE "drop_ins"
          ADD COLUMN IF NOT EXISTS "max_bookings_per_timeslot" integer;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'drop_ins'
            AND column_name = 'adjustable'
        ) THEN
          UPDATE "drop_ins"
            SET "max_bookings_per_timeslot" = CASE
              WHEN "adjustable" = true THEN NULL
              ELSE 1
            END;
        ELSE
          UPDATE "drop_ins"
            SET "max_bookings_per_timeslot" = 1;
        END IF;
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
          DROP COLUMN IF EXISTS "sessions_information_max_bookings_per_timeslot";
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_pass_types') THEN
        ALTER TABLE "class_pass_types"
          DROP COLUMN IF EXISTS "max_bookings_per_timeslot";
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drop_ins') THEN
        ALTER TABLE "drop_ins"
          DROP COLUMN IF EXISTS "max_bookings_per_timeslot";
      END IF;
    END $$;
  `)
}

