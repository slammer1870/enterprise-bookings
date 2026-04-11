import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure `bookings.timeslot_id` uses the snake_case name Drizzle expects.
 * `20260409000001` renames `lessons` → `timeslots` but does not rename booking FK
 * columns; legacy DBs may still have `lesson_id` or Payload-style `timeslotId_id`.
 * Without this, nested selects fail with: column "timeslot_id" does not exist (42703).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'timeslot_id'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'timeslotId_id'
      ) THEN
        ALTER TABLE "bookings" RENAME COLUMN "timeslotId_id" TO "timeslot_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'lesson_id'
      ) THEN
        ALTER TABLE "bookings" RENAME COLUMN "lesson_id" TO "timeslot_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'lessonId_id'
      ) THEN
        ALTER TABLE "bookings" RENAME COLUMN "lessonId_id" TO "timeslot_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bookings'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) THEN
        ALTER TABLE "bookings" ADD COLUMN "timeslot_id" integer;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'bookings'
            AND constraint_name = 'bookings_timeslot_id_timeslots_id_fk'
        ) THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "bookings_timeslot_id_timeslots_id_fk"
            FOREIGN KEY ("timeslot_id") REFERENCES "public"."timeslots"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslot_idx'
        ) THEN
          CREATE INDEX "bookings_timeslot_idx" ON "bookings" USING btree ("timeslot_id");
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslotId_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslot_idx'
      ) THEN
        ALTER INDEX "bookings_timeslotId_idx" RENAME TO "bookings_timeslot_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_lesson_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslot_idx'
      ) THEN
        ALTER INDEX "bookings_lesson_idx" RENAME TO "bookings_timeslot_idx";
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslot_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'bookings_timeslotId_idx'
      ) THEN
        ALTER INDEX "bookings_timeslot_idx" RENAME TO "bookings_timeslotId_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'timeslot_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'timeslotId_id'
      ) THEN
        ALTER TABLE "bookings" RENAME COLUMN "timeslot_id" TO "timeslotId_id";
      END IF;
    END $$;
  `)
}
