import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Ensure booking_transactions.booking_id FK is ON DELETE CASCADE.
 *
 * Symptom in production:
 * - deleting bookings (via timeslot clear / timeslot delete)
 * - fails with:
 *   "null value in column \"booking_id\" of relation \"booking_transactions\" violates not-null constraint"
 *
 * This indicates the FK was not applied as ON DELETE CASCADE (e.g. left as SET NULL).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      DROP CONSTRAINT IF EXISTS "booking_transactions_booking_id_bookings_id_fk";
  `)

  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
      ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      DROP CONSTRAINT IF EXISTS "booking_transactions_booking_id_bookings_id_fk";
  `)

  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id")
      ON DELETE set null ON UPDATE no action;
  `)
}

