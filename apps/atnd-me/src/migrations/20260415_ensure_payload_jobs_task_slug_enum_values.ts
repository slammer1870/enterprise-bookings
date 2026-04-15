import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  // Payload stores job task identifiers in Postgres enums.
  // If production DB missed an enum value (schema drift), queueing the job will fail with:
  //   invalid input value for enum_payload_jobs_task_slug
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'generateTimeslotsFromSchedule'
          AND enumtypid = 'public.enum_payload_jobs_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'generateTimeslotsFromSchedule';
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'generateTimeslotsFromSchedule'
          AND enumtypid = 'public.enum_payload_jobs_log_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'generateTimeslotsFromSchedule';
      END IF;
    END
    $$;
  `)
}

export async function down({ db: _db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  // Postgres enum values cannot be reliably removed.
  // This migration is intentionally one-way.
}

