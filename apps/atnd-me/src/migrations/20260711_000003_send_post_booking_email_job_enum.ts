import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'sendPostBookingEmail'
          AND enumtypid = 'public.enum_payload_jobs_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendPostBookingEmail';
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'sendPostBookingEmail'
          AND enumtypid = 'public.enum_payload_jobs_log_task_slug'::regtype
      ) THEN
        ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendPostBookingEmail';
      END IF;
    END
    $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Postgres enum values cannot be reliably removed.
}
