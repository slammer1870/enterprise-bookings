import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure `timeslots.event_type_id` (and related scheduler columns) exist with snake_case
 * names. `20260409000001_roles_data_and_booking_table_renames` renames `class_option_id`
 * but not legacy `eventType_id`; Drizzle/Payload 3 expect `event_type_id`. Without this,
 * queries fail with: column "event_type_id" does not exist (42703).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'event_type_id'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'eventType_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "eventType_id" TO "event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'class_option_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "class_option_id" TO "event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'timeslots'
      ) THEN
        ALTER TABLE "timeslots" ADD COLUMN IF NOT EXISTS "event_type_id" integer;
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

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_eventType_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_event_type_idx'
      ) THEN
        ALTER INDEX "timeslots_eventType_idx" RENAME TO "timeslots_event_type_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'event_type_id'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'eventType_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "eventType_id" TO "event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot' AND column_name = 'class_option_id'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" RENAME COLUMN "class_option_id" TO "event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_week_days_time_slot'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types'
      ) THEN
        ALTER TABLE "scheduler_week_days_time_slot" ADD COLUMN "event_type_id" integer;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'scheduler_week_days_time_slot'
            AND constraint_name = 'scheduler_week_days_time_slot_event_type_id_event_types_id_fk'
        ) THEN
          ALTER TABLE "scheduler_week_days_time_slot" ADD CONSTRAINT "scheduler_week_days_time_slot_event_type_id_event_types_id_fk"
            FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'scheduler_week_days_time_slot' AND indexname = 'scheduler_week_days_time_slot_event_type_idx'
        ) THEN
          CREATE INDEX "scheduler_week_days_time_slot_event_type_idx" ON "scheduler_week_days_time_slot" USING btree ("event_type_id");
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'scheduler_week_days_time_slot' AND indexname = 'scheduler_week_days_time_slot_eventType_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'scheduler_week_days_time_slot' AND indexname = 'scheduler_week_days_time_slot_event_type_idx'
      ) THEN
        ALTER INDEX "scheduler_week_days_time_slot_eventType_idx" RENAME TO "scheduler_week_days_time_slot_event_type_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_event_type_id'
      ) THEN
        NULL;
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'defaultEventType_id'
      ) THEN
        ALTER TABLE "scheduler" RENAME COLUMN "defaultEventType_id" TO "default_event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'scheduler' AND column_name = 'default_class_option_id'
      ) THEN
        ALTER TABLE "scheduler" RENAME COLUMN "default_class_option_id" TO "default_event_type_id";
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'event_types'
      ) THEN
        ALTER TABLE "scheduler" ADD COLUMN "default_event_type_id" integer;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = 'public'
            AND table_name = 'scheduler'
            AND constraint_name = 'scheduler_default_event_type_id_event_types_id_fk'
        ) THEN
          ALTER TABLE "scheduler" ADD CONSTRAINT "scheduler_default_event_type_id_event_types_id_fk"
            FOREIGN KEY ("default_event_type_id") REFERENCES "public"."event_types"("id")
            ON DELETE set null ON UPDATE no action;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'scheduler' AND indexname = 'scheduler_default_event_type_idx'
        ) THEN
          CREATE INDEX "scheduler_default_event_type_idx" ON "scheduler" USING btree ("default_event_type_id");
        END IF;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'scheduler' AND indexname = 'scheduler_defaultEventType_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'scheduler' AND indexname = 'scheduler_default_event_type_idx'
      ) THEN
        ALTER INDEX "scheduler_defaultEventType_idx" RENAME TO "scheduler_default_event_type_idx";
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
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_event_type_idx'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'timeslots' AND indexname = 'timeslots_eventType_idx'
      ) THEN
        ALTER INDEX "timeslots_event_type_idx" RENAME TO "timeslots_eventType_idx";
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'event_type_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'timeslots' AND column_name = 'eventType_id'
      ) THEN
        ALTER TABLE "timeslots" RENAME COLUMN "event_type_id" TO "eventType_id";
      END IF;
    END $$;
  `)
}
