import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fix booking_transactions.booking_id FK to use ON DELETE CASCADE.
 * It was ON DELETE SET NULL but booking_id is NOT NULL, so deleting a booking
 * caused: null value in column "booking_id" of relation "booking_transactions" violates not-null constraint.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      DROP CONSTRAINT IF EXISTS "booking_transactions_booking_id_bookings_id_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "booking_transactions"
      ADD CONSTRAINT "booking_transactions_booking_id_bookings_id_fk"
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
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
      FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  `)
}
