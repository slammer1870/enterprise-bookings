import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure `timeslots.staff_member_id` exists. Payload 3 + Drizzle use snake_case
 * relationship columns; older rows still have `staffMember_id`. If the rename in
 * `20260409000001_roles_data_and_booking_table_renames` did not run on an environment,
 * admin list queries fail with: column "staff_member_id" does not exist (42703).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staffMember_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "staffMember_id" TO "staff_member_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff_members'
      ) THEN
        ALTER TABLE "timeslots" ADD COLUMN "staff_member_id" integer;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'timeslots'
            AND constraint_name = 'timeslots_staff_member_id_staff_members_id_fk'
        ) THEN
          ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_staff_member_id_staff_members_id_fk"
            FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staff_member_idx'
        ) THEN
          CREATE INDEX "timeslots_staff_member_idx" ON "timeslots" USING btree ("staff_member_id");
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staffMember_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staff_member_idx'
      ) THEN
        ALTER INDEX "timeslots_staffMember_idx" RENAME TO "timeslots_staff_member_idx";
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
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staff_member_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_staffMember_idx'
      ) THEN
        ALTER INDEX "timeslots_staff_member_idx" RENAME TO "timeslots_staffMember_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staff_member_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'staffMember_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "staff_member_id" TO "staffMember_id";
      END IF;
    END $$;
  `)
}
