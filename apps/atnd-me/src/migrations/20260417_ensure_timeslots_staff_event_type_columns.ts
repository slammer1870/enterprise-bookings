import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Forward-only repair for databases where earlier migrations (`20260410_*`,
 * `20260416_*`) were recorded as applied before `up` logic added
 * `staff_member_id` / `event_type_id` without the related tables present.
 * Drizzle expects both columns on `public.timeslots`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) THEN
        ALTER TABLE "timeslots" ADD COLUMN IF NOT EXISTS "staff_member_id" integer;
        ALTER TABLE "timeslots" ADD COLUMN IF NOT EXISTS "event_type_id" integer;

        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'staff_members'
        ) THEN
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
            CREATE INDEX IF NOT EXISTS "timeslots_staff_member_idx" ON "timeslots" USING btree ("staff_member_id");
          END IF;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'event_types'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'public'
              AND table_name = 'timeslots'
              AND constraint_name = 'timeslots_event_type_id_event_types_id_fk'
          ) THEN
            ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_event_type_id_event_types_id_fk"
              FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id")
              ON DELETE set null ON UPDATE no action;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_event_type_idx'
          ) THEN
            CREATE INDEX IF NOT EXISTS "timeslots_event_type_idx" ON "timeslots" USING btree ("event_type_id");
          END IF;
        END IF;
      END IF;
    END $$;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Forward-only repair migration.
}
