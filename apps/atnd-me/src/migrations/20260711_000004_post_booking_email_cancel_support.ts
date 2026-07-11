import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'cancelled'
          AND enumtypid = 'public.enum_post_booking_email_deliveries_status'::regtype
      ) THEN
        ALTER TYPE "public"."enum_post_booking_email_deliveries_status" ADD VALUE 'cancelled';
      END IF;
    END
    $$;

    ALTER TABLE "post_booking_email_deliveries"
      ADD COLUMN IF NOT EXISTS "payload_job_id" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "post_booking_email_deliveries"
      DROP COLUMN IF EXISTS "payload_job_id";
  `)
}
