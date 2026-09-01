import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Store the course enrollment used by a course-paid booking transaction.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`ALTER TYPE "public"."enum_booking_transactions_payment_method"
      ADD VALUE IF NOT EXISTS 'course_enrollment'`,
  )

  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD COLUMN IF NOT EXISTS "course_enrollment_id" integer;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'booking_transactions_course_enrollment_id_course_enrollments_id_fk'
      ) THEN
        ALTER TABLE "booking_transactions"
          ADD CONSTRAINT "booking_transactions_course_enrollment_id_course_enrollments_id_fk"
          FOREIGN KEY ("course_enrollment_id")
          REFERENCES "public"."course_enrollments"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      DROP CONSTRAINT IF EXISTS "booking_transactions_course_enrollment_id_course_enrollments_id_fk";
    ALTER TABLE "booking_transactions"
      DROP COLUMN IF EXISTS "course_enrollment_id";
  `)
  // PostgreSQL does not support removing an individual enum value safely.
}
