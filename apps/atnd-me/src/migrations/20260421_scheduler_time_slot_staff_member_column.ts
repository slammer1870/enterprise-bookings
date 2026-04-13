import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Align `scheduler_week_days_time_slot` with Payload's `staffMember` relationship
 * (`staff_member_id` column).
 *
 * `20260409000001_roles_data_and_booking_table_renames` only renames `staffMember_id`
 * → `staff_member_id`. Older atnd-me / bookings-plugin DBs still have `instructor_id`
 * on this table (see e.g. `20260211_180330.json`), which breaks admin scheduler queries
 * with: column ... staff_member_id does not exist (42703).
 *
 * Idempotent. Drops only FK constraints whose single local column is `instructor_id` or
 * `staffMember_id` (never `_parent_id` / `event_type_id`). Then renames or adds the
 * column, nulls orphan IDs, and adds FK + index when `staff_members` exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      con text;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) THEN
        RETURN;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
          AND column_name = 'staff_member_id'
      ) THEN
        RETURN;
      END IF;

      FOR con IN
        SELECT c.conname::text
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE ns.nspname = 'public'
          AND rel.relname = 'scheduler_week_days_time_slot'
          AND c.contype = 'f'
          AND array_length(c.conkey, 1) = 1
          AND EXISTS (
            SELECT 1
            FROM pg_attribute a
            WHERE a.attrelid = c.conrelid
              AND a.attnum = c.conkey[1]
              AND NOT a.attisdropped
              AND a.attname IN ('instructor_id', 'staffMember_id')
          )
      LOOP
        EXECUTE format(
          'ALTER TABLE "scheduler_week_days_time_slot" DROP CONSTRAINT IF EXISTS %I',
          con
        );
      END LOOP;

      DROP INDEX IF EXISTS "scheduler_week_days_time_slot_instructor_idx";
      DROP INDEX IF EXISTS "scheduler_week_days_time_slot_staffMember_idx";

      IF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'scheduler_week_days_time_slot'
          AND a.attname = 'instructor_id'
          AND NOT a.attisdropped
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot"
          RENAME COLUMN "instructor_id" TO "staff_member_id";
      ELSIF EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'scheduler_week_days_time_slot'
          AND a.attname = 'staffMember_id'
          AND NOT a.attisdropped
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot"
          RENAME COLUMN "staffMember_id" TO "staff_member_id";
      ELSE
        ALTER TABLE "scheduler_week_days_time_slot"
          ADD COLUMN IF NOT EXISTS "staff_member_id" integer;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      )
      OR NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      )
      OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
          AND column_name = 'staff_member_id'
      ) THEN
        RETURN;
      END IF;

      UPDATE "scheduler_week_days_time_slot" s
      SET staff_member_id = NULL
      WHERE s.staff_member_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "staff_members" sm WHERE sm.id = s.staff_member_id);

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'scheduler_week_days_time_slot'
          AND constraint_name = 'scheduler_week_days_time_slot_staff_member_id_staff_members_id_fk'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot"
          ADD CONSTRAINT "scheduler_week_days_time_slot_staff_member_id_staff_members_id_fk"
          FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'scheduler_week_days_time_slot'
          AND indexname = 'scheduler_week_days_time_slot_staff_member_idx'
      ) THEN
        CREATE INDEX IF NOT EXISTS "scheduler_week_days_time_slot_staff_member_idx"
          ON "scheduler_week_days_time_slot" USING btree ("staff_member_id");
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only repair migration.
}
