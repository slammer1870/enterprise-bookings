import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Allow bookings paid for with a course enrollment.
 *
 * The bookings field was added to the application schema before its enum value
 * was added to PostgreSQL, so production rejects course check-ins at insert time.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_bookings_payment_method_used"
    ADD VALUE IF NOT EXISTS 'course_enrollment';
  `)
}

/**
 * PostgreSQL does not support removing an individual enum value safely.
 */
export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentionally left blank.
}
